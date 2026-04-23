/**
 * Monolith: chạy Python routing (FastAPI) rồi Node server.js trong cùng một container.
 * Dùng path tuyệt đối qua __dirname — tránh lỗi "No such file" khi Railway cwd ≠ thư mục repo.
 *
 * Railway Start Command (khuyến nghị): node scripts/railway-start.js
 * hoặc: npm run start:railway
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const root = path.resolve(__dirname, '..');
const pyDir = path.join(root, 'python_routing');
const pyPort = String(process.env.PYTHON_ROUTING_PORT || '8001').trim() || '8001';
const pyBin = (process.env.PYTHON_BIN || 'python3').trim();

function cleanup(proc) {
    if (!proc || proc.killed) return;
    try {
        proc.kill('SIGTERM');
    } catch {
        /* ignore */
    }
}

function httpGetOk(url) {
    return new Promise((resolve) => {
        const req = http.get(url, { timeout: 5000 }, (res) => {
            res.resume();
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function waitForHealth(maxSeconds = 120) {
    const url = `http://127.0.0.1:${pyPort}/health`;
    for (let i = 0; i < maxSeconds; i++) {
        if (await httpGetOk(url)) {
            console.log('[railway-start] Python routing is up.');
            return;
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Python /health did not become ready in time');
}

(async () => {
    const py = spawn(pyBin, ['main.py'], {
        cwd: pyDir,
        env: process.env,
        stdio: 'inherit'
    });

    const onShutdown = () => cleanup(py);
    process.on('SIGINT', onShutdown);
    process.on('SIGTERM', onShutdown);

    py.on('error', (err) => {
        console.error('[railway-start] Failed to spawn Python:', err.message);
        process.exit(1);
    });

    try {
        await waitForHealth();
    } catch (e) {
        console.error('[railway-start]', e.message);
        cleanup(py);
        process.exit(1);
    }

    await new Promise((resolve) => {
        const node = spawn(process.execPath, [path.join(root, 'server.js')], {
            cwd: root,
            env: process.env,
            stdio: 'inherit'
        });
        node.on('exit', (code) => {
            cleanup(py);
            resolve(code ?? 0);
        });
        node.on('error', (err) => {
            console.error('[railway-start] Node spawn error:', err.message);
            cleanup(py);
            resolve(1);
        });
    }).then((code) => process.exit(Number(code) || 0));
})();

/**
 * Monolith: Python routing (FastAPI) + Node server.js trong một container.
 * Render / Railway: có thể dùng script này HOẶC chỉ `npm start` (Node-only).
 *
 * Nếu Python không lên (Neon quota, lỗi DB): mặc định vẫn chạy Node để API/báo cáo/ảnh không chết.
 * Bắt buộc cả hai: PYTHON_STARTUP_REQUIRED=true
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const root = path.resolve(__dirname, '..');
const pyDir = path.join(root, 'python_routing');
const pyPort = String(process.env.PYTHON_ROUTING_PORT || '8001').trim() || '8001';
const pyBin = (process.env.PYTHON_BIN || 'python3').trim();
const skipPython =
    String(process.env.SKIP_PYTHON_ROUTING || '').toLowerCase() === 'true' ||
    String(process.env.PYTHON_ROUTING_ENABLED || '').toLowerCase() === 'false';
const pythonRequired =
    String(process.env.PYTHON_STARTUP_REQUIRED || 'false').toLowerCase() === 'true';

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
            console.log('[launcher] Python routing is up.');
            return;
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Python /health did not become ready in time');
}

function startNode(pyProc) {
    return new Promise((resolve) => {
        const node = spawn(process.execPath, [path.join(root, 'server.js')], {
            cwd: root,
            env: process.env,
            stdio: 'inherit'
        });
        node.on('exit', (code) => {
            cleanup(pyProc);
            resolve(code ?? 0);
        });
        node.on('error', (err) => {
            console.error('[launcher] Node spawn error:', err.message);
            cleanup(pyProc);
            resolve(1);
        });
    });
}

(async () => {
    let py = null;

    if (skipPython) {
        console.log('[launcher] SKIP_PYTHON_ROUTING — chỉ chạy Node (npm start tương đương).');
        const code = await startNode(null);
        process.exit(Number(code) || 0);
        return;
    }

    py = spawn(pyBin, ['main.py'], {
        cwd: pyDir,
        env: process.env,
        stdio: 'inherit'
    });

    const onShutdown = () => cleanup(py);
    process.on('SIGINT', onShutdown);
    process.on('SIGTERM', onShutdown);

    py.on('error', (err) => {
        console.error('[launcher] Failed to spawn Python:', err.message);
        if (pythonRequired) {
            process.exit(1);
        }
        console.warn('[launcher] Tiếp tục chỉ chạy Node; routing Python không khả dụng.');
        startNode(null).then((code) => process.exit(Number(code) || 0));
    });

    try {
        await waitForHealth();
    } catch (e) {
        console.error('[launcher]', e.message);
        cleanup(py);
        if (pythonRequired) {
            process.exit(1);
        }
        console.warn(
            '[launcher] Python không sẵn sàng (vd Neon quota, DB). Node vẫn khởi động — ' +
                'ROUTING_LEGACY_FALLBACK=true để tìm đường fallback.'
        );
        const code = await startNode(null);
        process.exit(Number(code) || 0);
        return;
    }

    const code = await startNode(py);
    process.exit(Number(code) || 0);
})();

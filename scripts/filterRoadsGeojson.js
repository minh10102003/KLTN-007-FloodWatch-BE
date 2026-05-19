'use strict';

/**
 * Lọc data/roads.geojson (lớn) → file nhỏ hơn cho Neon free (≤512 MB/project).
 * GeoJSON trong repo: mỗi Feature thường nằm trên một dòng → đọc streaming.
 *
 * Usage:
 *   node scripts/filterRoadsGeojson.js
 *   node scripts/filterRoadsGeojson.js --bbox 106.64,10.76,106.78,10.90 --highways major
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { DEFAULT_BBOX, parseBbox, featurePassesFilters } = require('./roadGraphFilters');

function parseArgs(argv) {
    const out = {
        inFile: path.join(__dirname, '..', 'data', 'roads.geojson'),
        outFile: path.join(__dirname, '..', 'data', 'roads_hcm_core.geojson'),
        bbox: DEFAULT_BBOX,
        highwayMode: 'arterial',
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--in') out.inFile = path.resolve(argv[++i]);
        else if (a === '--out') out.outFile = path.resolve(argv[++i]);
        else if (a === '--bbox') {
            const b = parseBbox(argv[++i]);
            if (!b) throw new Error('--bbox cần minLng,minLat,maxLng,maxLat');
            out.bbox = b;
        } else if (a === '--highways') out.highwayMode = String(argv[++i] || 'major').toLowerCase();
        else if (a === '--help' || a === '-h') out.help = true;
    }
    return out;
}

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) {
        console.log(`
Usage: node scripts/filterRoadsGeojson.js [options]

  --in <path>       Input (default: data/roads.geojson)
  --out <path>      Output (default: data/roads_hcm_core.geojson)
  --bbox lng1,lat1,lng2,lat2   (default: vùng S01–S03)
  --highways arterial|major|all|open   arterial = trunk..tertiary (khuyến nghị Neon free)
`);
        return;
    }
    if (!fs.existsSync(args.inFile)) {
        console.error('Không tìm thấy', args.inFile);
        process.exit(1);
    }

    const rl = readline.createInterface({
        input: fs.createReadStream(args.inFile, { encoding: 'utf8' }),
        crlfDelay: Infinity,
    });

    const outStream = fs.createWriteStream(args.outFile, { encoding: 'utf8' });
    outStream.write(
        '{"type":"FeatureCollection","name":"roads_hcm_core","features":[\n'
    );

    let kept = 0;
    let seen = 0;
    let first = true;

    for await (const line of rl) {
        const t = line.trim();
        if (!t.startsWith('{ "type": "Feature"') && !t.startsWith('{"type":"Feature"')) continue;
        seen++;
        let jsonLine = t.replace(/,\s*$/, '');
        let feature;
        try {
            feature = JSON.parse(jsonLine);
        } catch {
            continue;
        }
        if (!featurePassesFilters(feature, { bbox: args.bbox, highwayMode: args.highwayMode })) {
            continue;
        }
        if (!first) outStream.write(',\n');
        first = false;
        outStream.write(JSON.stringify(feature));
        kept++;
        if (kept % 5000 === 0) console.log('  kept', kept, '...');
    }

    outStream.write('\n]}\n');
    await new Promise((resolve, reject) => {
        outStream.end((e) => (e ? reject(e) : resolve()));
    });

    const mb = (fs.statSync(args.outFile).size / 1024 / 1024).toFixed(2);
    console.log(`✅ ${args.outFile} (${mb} MB) — ${kept}/${seen} features`);
    console.log('   Import: npm run import:road-graph:core');
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});

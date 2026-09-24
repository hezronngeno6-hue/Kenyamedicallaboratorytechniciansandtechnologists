#!/usr/bin/env node
'use strict';

/**
 * Generates QR codes that resolve to a practitioner's verification page.
 *
 * The QR encodes a plain URL — no proprietary payload format — so any phone
 * camera, and any scanner app, will open the registry record directly.
 *
 *   node scripts/generate-qr.js KMLTT/MLT/00051
 *   node scripts/generate-qr.js KMLTT/MLT/00051 --url http://localhost:4321
 *   node scripts/generate-qr.js --all
 *
 * Options
 *   --url <base>   Base URL to encode (default: production site)
 *   --out <dir>    Output directory (default: output/qr)
 *   --all          Generate for every record in the registry
 *   --help         Show usage
 *
 * Output: <out>/<REG-SLUG>.png and .svg, plus <out>/index.html gallery.
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const { loadRegistry, findByRegistration } = require('../lib/members');

const DEFAULT_BASE_URL = 'https://kenyamedicallab.vercel.app';

function parseArgs(argv) {
  const opts = { regNumbers: [], url: DEFAULT_BASE_URL, out: path.join(__dirname, '..', 'output', 'qr'), all: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--all') {
      opts.all = true;
    } else if (arg === '--url') {
      opts.url = argv[++i];
    } else if (arg === '--out') {
      opts.out = argv[++i];
    } else if (arg.startsWith('--')) {
      throw new Error('Unknown option: ' + arg);
    } else {
      opts.regNumbers.push(arg);
    }
  }

  if (opts.url) opts.url = String(opts.url).replace(/\/+$/, '');
  return opts;
}

function usage() {
  console.log([
    'Generate verification QR codes',
    '',
    '  node scripts/generate-qr.js <registration number ...>',
    '  node scripts/generate-qr.js --all',
    '',
    'Options',
    '  --url <base>   Base URL to encode (default: ' + DEFAULT_BASE_URL + ')',
    '  --out <dir>    Output directory (default: output/qr)',
    '  --all          Generate for every record in the registry',
    '',
    'Example',
    '  node scripts/generate-qr.js KMLTT/MLT/00051'
  ].join('\n'));
}

/** Filesystem-safe slug for a registration number: KMLTT/MLT/00051 -> KMLTT-MLT-00051 */
function slug(regNumber) {
  return String(regNumber).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function verificationUrl(baseUrl, regNumber) {
  return baseUrl + '/verify?reg=' + encodeURIComponent(regNumber);
}

async function generate(record, opts) {
  const url = verificationUrl(opts.url, record.regNumber);
  const fileBase = slug(record.regNumber);

  fs.mkdirSync(opts.out, { recursive: true });

  const pngPath = path.join(opts.out, fileBase + '.png');
  const svgPath = path.join(opts.out, fileBase + '.svg');

  // 'H' = 30% error correction: stays readable when printed small, creased,
  // or overlaid with a logo. 1024px suits print at ~300dpi up to ~85mm wide.
  await QRCode.toFile(pngPath, url, {
    errorCorrectionLevel: 'H',
    type: 'png',
    width: 1024,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });

  await QRCode.toFile(svgPath, url, {
    errorCorrectionLevel: 'H',
    type: 'svg',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });

  return { record, url, fileBase, pngPath, svgPath };
}

function writeGallery(results, opts) {
  const rows = results
    .map(function (r) {
      return [
        '<article class="card">',
        '<img src="./' + r.fileBase + '.png" alt="QR code for ' + r.record.regNumber + '" width="180" height="180">',
        '<h2>' + r.record.name + '</h2>',
        r.record.designation ? '<p class="des">' + r.record.designation + '</p>' : '',
        '<p class="mono">' + r.record.regNumber + '</p>',
        '<p class="cadre">' + r.record.cadre + ' · ' + (r.record.county || '—') + '</p>',
        '<p><span class="status ' + String(r.record.status).toLowerCase() + '">' + r.record.status + '</span></p>',
        '<p class="url"><a href="' + r.url + '">' + r.url + '</a></p>',
        '<p class="url"><a href="./' + r.fileBase + '.svg">SVG</a> · <a href="./' + r.fileBase + '.png" download>PNG</a></p>',
        '</article>'
      ].join('\n');
    })
    .join('\n');

  const html = [
    '<!DOCTYPE html>',
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Generated verification QR codes</title>',
    '<style>',
    'body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f5f8fa;color:#1f3a52;margin:0;padding:40px 20px}',
    '.wrap{max-width:1100px;margin:0 auto}',
    'h1{color:#0a1c2e;margin:0 0 6px}',
    '.note{background:#fff6e0;border:1px solid #f0dcae;color:#8a5a00;padding:14px 18px;border-radius:8px;margin:18px 0 30px}',
    '.grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}',
    '.card{background:#fff;border:1px solid #dde5ed;border-radius:14px;padding:20px;text-align:center;box-shadow:0 1px 3px rgba(10,28,46,.08)}',
    '.card img{width:180px;height:180px}',
    '.card h2{font-size:1rem;margin:12px 0 2px;color:#0a1c2e}',
    '.card p{margin:2px 0;font-size:.85rem}',
    '.des{font-weight:700;color:#0a7a4c}',
    '.cadre{color:#4a6076}',
    '.mono{font-family:Menlo,Consolas,monospace;font-size:.8rem}',
    '.url{font-size:.72rem;word-break:break-all}',
    '.status{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:700;font-size:.75rem;background:#e3f5ec;color:#0a7a4c}',
    '.status.expired{background:#fff6e0;color:#8a5a00}',
    '.status.suspended{background:#fdecea;color:#b3261e}',
    '.status.provisional{background:#e8f1fb;color:#0b5aa0}',
    '</style></head><body><div class="wrap">',
    '<h1>Verification QR codes</h1>',
    '<p>Encoded base URL: <strong class="mono">' + opts.url + '</strong></p>',
    '<div class="note"><strong>Demonstration build.</strong> These QR codes point at sample registry records. ' +
      'They will only resolve once the site is deployed at the encoded base URL, and the data is placeholder data.</div>',
    '<div class="grid">',
    rows,
    '</div></div></body></html>',
    ''
  ].join('\n');

  const galleryPath = path.join(opts.out, 'index.html');
  fs.writeFileSync(galleryPath, html, 'utf8');
  return galleryPath;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    usage();
    process.exitCode = 1;
    return;
  }

  if (opts.help) {
    usage();
    return;
  }

  let records;

  if (opts.all) {
    records = loadRegistry().members;
  } else if (opts.regNumbers.length) {
    records = [];
    for (const reg of opts.regNumbers) {
      const found = findByRegistration(reg);
      if (!found) {
        console.error('No registry record matches: ' + reg);
        process.exitCode = 1;
        continue;
      }
      records.push(found);
    }
  } else {
    usage();
    process.exitCode = 1;
    return;
  }

  if (!records.length) {
    console.error('Nothing to generate.');
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const record of records) {
    results.push(await generate(record, opts));
  }

  console.log('Encoded base URL: ' + opts.url);
  console.log('');
  for (const r of results) {
    console.log('  ' + r.record.regNumber);
    console.log('    name  : ' + r.record.name + (r.record.designation ? ' (' + r.record.designation + ')' : ''));
    console.log('    status: ' + r.record.status);
    console.log('    url   : ' + r.url);
    console.log('    files : ' + path.relative(process.cwd(), r.pngPath) + ', ' + path.basename(r.svgPath));
    console.log('');
  }

  const gallery = writeGallery(results, opts);
  console.log('Gallery: ' + gallery);
}

main().catch(function (err) {
  console.error('QR generation failed: ' + err.message);
  process.exitCode = 1;
});

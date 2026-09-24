#!/usr/bin/env node
'use strict';

/**
 * Zero-dependency local preview server.
 *
 * Serves `public/` as static files (with clean-URL resolution and the 404 page)
 * and routes `/api/<name>` to the matching serverless function in `api/`.
 * This lets the site be exercised end to end without the Vercel CLI and
 * without a Vercel login.
 *
 *   npm run preview                 # http://localhost:4321
 *   $env:PORT=8080; npm run preview
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const API_DIR = path.join(ROOT, 'api');
const PORT = Number(process.env.PORT) || 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stream = fs.createReadStream(filePath);
  stream.on('error', function () {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Failed to read file');
  });
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  stream.pipe(res);
}

function serveStatic(res, pathname) {
  const resolved = path.resolve(path.join(PUBLIC_DIR, pathname.replace(/^\/+/, '')));

  // Never escape the public directory.
  if (resolved !== PUBLIC_DIR && !resolved.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  const candidates = [];
  if (pathname.endsWith('/')) candidates.push(path.join(resolved, 'index.html'));
  candidates.push(resolved, resolved + '.html', path.join(resolved, 'index.html'));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return sendFile(res, candidate);
    }
  }

  const notFound = path.join(PUBLIC_DIR, '404.html');
  if (fs.existsSync(notFound)) {
    res.writeHead(404, { 'Content-Type': MIME['.html'] });
    return fs.createReadStream(notFound).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

/** Minimal shim reproducing the Vercel Node `res` helpers our functions use. */
function createResponseShim(res) {
  return {
    statusCode: 200,
    headers: {},
    setHeader: function (key, value) {
      this.headers[key] = value;
    },
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (body) {
      this.headers['Content-Type'] = MIME['.json'];
      res.writeHead(this.statusCode, this.headers);
      res.end(JSON.stringify(body, null, 2));
    },
    send: function (body) {
      this.headers['Content-Type'] = this.headers['Content-Type'] || MIME['.txt'];
      res.writeHead(this.statusCode, this.headers);
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    }
  };
}

function handleApi(req, res, pathname, searchParams) {
  const name = pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');

  if (!/^[a-z0-9_-]+$/i.test(name)) {
    res.writeHead(400, { 'Content-Type': MIME['.json'] });
    return res.end(JSON.stringify({ error: 'Invalid endpoint' }));
  }

  const modulePath = path.join(API_DIR, name + '.js');
  if (!fs.existsSync(modulePath)) {
    res.writeHead(404, { 'Content-Type': MIME['.json'] });
    return res.end(JSON.stringify({ error: 'Unknown endpoint: ' + name }));
  }

  let handler;
  try {
    delete require.cache[require.resolve(modulePath)]; // pick up edits without restarting
    handler = require(modulePath);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': MIME['.json'] });
    return res.end(JSON.stringify({ error: 'Failed to load endpoint', detail: err.message }));
  }

  req.query = Object.fromEntries(searchParams.entries());

  try {
    handler(req, createResponseShim(res));
  } catch (err) {
    if (res.headersSent) return res.end();
    res.writeHead(500, { 'Content-Type': MIME['.json'] });
    res.end(JSON.stringify({ error: 'Unhandled function error', detail: err.message }));
  }
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname, url.searchParams);
  }

  serveStatic(res, pathname);
});

server.listen(PORT, function () {
  console.log('KMLTT preview server running');
  console.log('  http://localhost:' + PORT + '/');
  console.log('  http://localhost:' + PORT + '/verify?reg=KMLTT/MLT/00051');
  console.log('  http://localhost:' + PORT + '/members');
  console.log('  http://localhost:' + PORT + '/api/stats');
  console.log('Press Ctrl+C to stop.');
});

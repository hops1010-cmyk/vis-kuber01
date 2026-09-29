'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE = new Set(['.git', 'node_modules', '.vercel']);

function listDirectory(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => !IGNORE.has(e.name))
      .map(e => {
        const fullPath = path.join(dirPath, e.name);
        const stat = fs.statSync(fullPath);
        return {
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
          size: stat.size,
          path: path.relative(ROOT, fullPath).replace(/\\/g, '/')
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return entries;
  } catch {
    return [];
  }
}

function handler(req, res) {
  const url = req.url || '/';
  const sanitized = url.split('?')[0].replace(/^\/+/, '') || '';

  if (sanitized.includes('..') || sanitized.includes('\0')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Invalid path' }));
  }

  const target = sanitized ? path.join(ROOT, sanitized) : ROOT;

  // Security: ensure target is within ROOT
  const resolved = path.resolve(target);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Forbidden' }));
  }

  if (fs.statSync(resolved).isDirectory()) {
    const listing = listDirectory(resolved);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      path: sanitized || '/',
      entries: listing
    }));
  }

  // Serve file
  try {
    const stat = fs.statSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const ct = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
    }[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', ct);
    const stream = fs.createReadStream(resolved);
    stream.pipe(res);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

module.exports = handler;

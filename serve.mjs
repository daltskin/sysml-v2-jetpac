import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, resolve, extname } from 'path';

const DIST = new URL('./dist/', import.meta.url).pathname;
const DIST_RESOLVED = resolve(DIST);
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.map':  'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const filePath = resolve(join(DIST, url));

  // Prevent path traversal
  if (!filePath.startsWith(DIST_RESOLVED)) {
    res.writeHead(403, { 'Content-Type': 'text/plain', 'Connection': 'close' });
    res.end('Forbidden');
    return;
  }
  const ext = extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentType + '; charset=utf-8',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
      'Connection': 'close',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain', 'Connection': 'close' });
    res.end('Not found');
  }
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Serving dist/ at http://localhost:3000');
});

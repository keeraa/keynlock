/** Tiny, dependency-free static server for built Keynlock assets. */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../dist');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.json': 'application/json' };
const server = createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(`${root}${sep}`) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }
  const extension = file.substring(file.lastIndexOf('.'));
  response.setHeader('Content-Type', types[extension] || 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-cache');
  createReadStream(file).pipe(response);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Keynlock preview: http://127.0.0.1:${port}/`);
});

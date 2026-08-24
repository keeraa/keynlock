import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.tsv', 'text/tab-separated-values; charset=utf-8'],
]);

function parseArgs(argv) {
  const out = { host: '127.0.0.1', port: 4173, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--host' && argv[i + 1]) out.host = argv[++i];
    else if (argv[i] === '--port' && argv[i + 1]) out.port = Number(argv[++i]);
    else if (argv[i] === '--quiet') out.quiet = true;
  }
  return out;
}

export async function startServer({ host = '127.0.0.1', port = 4173, quiet = false } = {}) {
  const rootPrefix = projectRoot.endsWith(sep) ? projectRoot : projectRoot + sep;
  const server = createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === '/') pathname = '/index.html';
      const relative = pathname.replace(/^\/+/, '');
      let file = resolve(projectRoot, relative);
      if (file !== projectRoot && !file.startsWith(rootPrefix)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, 'index.html');
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      const type = MIME.get(extname(file).toLowerCase()) || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).pipe(res);
      if (!quiet) console.log(`${req.method || 'GET'} ${pathname}`);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Internal error');
      if (!quiet) console.error(error);
    }
  });

  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, ok);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return { server, url: `http://${host}:${actualPort}/` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const { url } = await startServer(options);
  console.log(`KEYNLOCK dev server: ${url}`);
}

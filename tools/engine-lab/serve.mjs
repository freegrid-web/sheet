import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
export const root = fileURLToPath(new URL('.', import.meta.url));
const vendorFiles = new Map([
  ['/vendor/freesheet.js', fileURLToPath(new URL('../../packages/sheet/dist/freesheet.full.min.js', import.meta.url))],
  ['/vendor/freesheet.css', fileURLToPath(new URL('../../packages/sheet/dist/freesheet.full.min.css', import.meta.url))],
]);
export async function startServer(port = 0) {
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const vendor = vendorFiles.get(path);
      const file = vendor || resolve(root, `.${path === '/' ? '/index.html' : path}`);
      if (!vendor && (!file.startsWith(root + (root.endsWith(sep) ? '' : sep)) ||
          file.split(sep).includes('results') || !['.mjs', '.html', '.css'].includes(extname(file)))) {
        response.writeHead(403).end(); return;
      }
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': ['.mjs', '.js'].includes(extname(file)) ? 'text/javascript' :
        extname(file) === '.css' ? 'text/css' : 'text/html', 'cache-control': 'no-store' });
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(done => server.close(done)) };
}
if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '4184' } } });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const server = await startServer(port); console.log(`TypeScript engine lab: ${server.url}`);
  process.once('SIGINT', async () => { await server.close(); process.exit(0); });
}

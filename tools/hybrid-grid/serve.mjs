import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
export const root = fileURLToPath(new URL('.', import.meta.url));
export const vueFile = createRequire(new URL('../../packages/docs/package.json', import.meta.url))
  .resolve('vue/dist/vue.runtime.esm-browser.prod.js');
export async function startServer(port = 0) {
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const vendor = path === '/vendor/vue.mjs';
      const file = vendor ? vueFile : resolve(root, `.${path === '/' ? '/index.html' : path}`);
      if (!vendor && (!file.startsWith(root + (root.endsWith(sep) ? '' : sep)) ||
          file.split(sep).includes('results') || !['.mjs', '.html', '.css'].includes(extname(file)))) {
        response.writeHead(403).end(); return;
      }
      response.writeHead(200, { 'content-type': vendor || extname(file) === '.mjs' ? 'text/javascript' :
        extname(file) === '.css' ? 'text/css' : 'text/html', 'cache-control': 'no-store' });
      response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(done => server.close(done)) };
}
if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '4183' } } });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const server = await startServer(port); console.log(`Hybrid grid lab: ${server.url}`);
  process.once('SIGINT', async () => { await server.close(); process.exit(0); });
}

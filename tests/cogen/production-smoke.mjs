// Run against a prepared checkout after `yarn build`; no real chain or wallet is contacted.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const source = resolve(process.argv[2] || '');
assert.ok(process.argv[2], 'Usage: node production-smoke.mjs BUILT_FRONTEND_DIRECTORY');
const hash = `0x${'ab'.repeat(32)}`;
const rpc = createServer(async(req, res) => {
  let payload = '';
  for await (const chunk of req) payload += chunk;
  const request = JSON.parse(payload);
  assert.equal(request.method, 'povi_getBlockByNumber');
  assert.deepEqual(request.params, ['0x2a']);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {
    number: '0x2a', executionNumber: '0x2a', executionHash: hash, canonical: true,
    hash: `0x${'cd'.repeat(32)}`, target: `0x${'0f'.repeat(32)}`, totalWork: '0x10000000000000001', fruits: [],
  } }));
});
await new Promise(resolve => rpc.listen(0, '127.0.0.1', resolve));
const reserve = createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: source,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', COGEN_POVI_RPC_URL: `http://127.0.0.1:${rpc.address().port}` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', data => { log += data; });
server.stderr.on('data', data => { log += data; });
const url = `http://127.0.0.1:${port}/node-api/cogen/block?height=42&hash=${hash}`;
try {
  let response;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(log);
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      break;
    } catch { await delay(100); }
  }
  assert.ok(response, `Next server did not start: ${log}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json();
  assert.equal(data.difficulty, '16');
  assert.equal(data.totalWork, '18446744073709551617');
  assert.equal(data.fruitsCount, 0);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  assert.equal((await fetch(url.replace('height=42', 'height=bad'))).status, 400);
  assert.equal((await fetch(url.replace(hash, `0x${'ef'.repeat(32)}`))).status, 409);
  console.log('PASS: production Next route, rewrite, exact difficulty, no-store, GET-only, input validation and reorg guard');
} finally {
  server.kill('SIGTERM');
  await new Promise(resolve => server.once('exit', resolve));
  await new Promise(resolve => rpc.close(resolve));
}

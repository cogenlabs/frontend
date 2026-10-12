import assert from 'node:assert/strict';
import test from 'node:test';

import { CogenError, fetchCogenBlock } from '../../lib/cogen/block.ts';

const hash = `0x${'ab'.repeat(32)}`;
const block = {
  number: '0x2a', executionNumber: '0x2a', executionHash: hash, canonical: true,
  hash: `0x${'cd'.repeat(32)}`, target: `0x${'0f'.repeat(32)}`, totalWork: '0x10000000000000001', fruits: [{}, {}],
};
const rpc = (result, error) => async() => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result, error }));
const rejects = (status) => (error) => error instanceof CogenError && error.status === status;

test('uses PoVI work, preserves large integers, and calls only the read-only block method', async() => {
  const data = await fetchCogenBlock('42', hash, 'http://node:9545', async(url, options) => {
    assert.equal(url, 'http://node:9545');
    assert.deepEqual(JSON.parse(options.body), { jsonrpc: '2.0', id: 1, method: 'povi_getBlockByNumber', params: ['0x2a'] });
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return rpc(block)();
  });
  assert.equal(data.difficulty, '16');
  assert.equal(data.totalWork, '18446744073709551617');
  assert.equal(data.fruitsCount, 2);
  assert.equal(data.hash, block.hash);
});

test('genesis, zero fruits, zero cumulative work and extreme targets stay exact', async() => {
  const genesis = { ...block, number: '0x0', executionNumber: '0x0', fruits: [], totalWork: '0x0' };
  const data = await fetchCogenBlock('0', hash.toUpperCase().replace('0X', '0x'), 'http://node', rpc(genesis));
  assert.equal(data.fruitsCount, 0);
  assert.equal(data.totalWork, '0');
  for (const target of ['0x0', '0x1', `0x${'ff'.repeat(32)}`]) {
    const result = await fetchCogenBlock('0', hash, 'http://node', rpc({ ...genesis, target }));
    assert.equal(result.difficulty, ((2n ** 256n) / (BigInt(target) + 1n)).toString());
  }
});

test('never joins a reorg, different execution hash, or different height by number alone', async() => {
  for (const change of [{ executionHash: block.hash }, { executionNumber: '0x29' }, { number: '0x29' }, { canonical: false }]) {
    await assert.rejects(fetchCogenBlock('42', hash, 'http://node', rpc({ ...block, ...change })), rejects(409));
  }
});

test('rejects malformed inputs without contacting RPC', async() => {
  for (const [height, executionHash] of [['-1', hash], ['latest', hash], [['42'], hash], ['18446744073709551616', hash], ['42', '0x123'], ['042', hash]]) {
    await assert.rejects(fetchCogenBlock(height, executionHash, 'http://node', async() => assert.fail('RPC called')), rejects(400));
  }
});

test('missing config, missing block, RPC error, HTTP error and timeout are explicit failures', async() => {
  await assert.rejects(fetchCogenBlock('42', hash, undefined), rejects(503));
  await assert.rejects(fetchCogenBlock('42', hash, 'http://node', rpc(null)), rejects(404));
  await assert.rejects(fetchCogenBlock('42', hash, 'http://node', rpc(null, { code: -32601 })), rejects(502));
  await assert.rejects(fetchCogenBlock('42', hash, 'http://node', async() => new Response('', { status: 503 })), rejects(502));
  await assert.rejects(fetchCogenBlock('42', hash, 'http://node', async() => { throw new Error('timeout'); }), rejects(502));
});

test('malformed targets and incomplete responses never become zero or an estimated difficulty', async() => {
  for (const change of [{ target: null }, { target: '-1' }, { target: `0x1${'00'.repeat(32)}` }, { totalWork: null }, { fruits: null }, { hash: '0x123' }]) {
    await assert.rejects(fetchCogenBlock('42', hash, 'http://node', rpc({ ...block, ...change })), rejects(502));
  }
});

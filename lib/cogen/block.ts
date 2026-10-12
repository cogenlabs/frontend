// PoVI values come from the consensus client, not Geth's post-merge difficulty.
export interface CogenBlock {
  difficulty: string;
  totalWork: string;
  target: string;
  hash: string;
  fruitsCount: number;
}

export class CogenError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function quantity(value: unknown, bits: number): bigint {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value) || value.length > 2 + bits / 4) {
    throw new CogenError(502, 'Invalid PoVI data');
  }
  return BigInt(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function fetchCogenBlock(
  height: unknown,
  executionHash: unknown,
  rpcUrl: string | undefined,
  fetchRpc: typeof fetch = fetch,
): Promise<CogenBlock> {
  if (typeof height !== 'string' || !/^(?:0|[1-9]\d{0,19})$/.test(height) || BigInt(height) >= (BigInt(1) << BigInt(64)) ||
      typeof executionHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(executionHash)) {
    throw new CogenError(400, 'Invalid block height or execution hash');
  }
  if (!rpcUrl) {
    throw new CogenError(503, 'PoVI RPC is not configured');
  }

  // This is deliberately a single read-only method; never expose the mining RPC as a generic proxy.
  let body;
  try {
    const response = await fetchRpc(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'povi_getBlockByNumber', params: [ `0x${ BigInt(height).toString(16) }` ] }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error('RPC HTTP error');
    }
    body = await response.json();
  } catch {
    throw new CogenError(502, 'PoVI RPC unavailable');
  }

  if (!isRecord(body) || body.jsonrpc !== '2.0' || body.id !== 1 || body.error || !('result' in body)) {
    throw new CogenError(502, 'PoVI RPC returned an error');
  }
  const block = body.result;
  if (block === null) {
    throw new CogenError(404, 'PoVI block not found');
  }
  if (!isRecord(block)) {
    throw new CogenError(502, 'Invalid PoVI data');
  }
  if (typeof block.executionHash !== 'string' || block.executionHash.toLowerCase() !== executionHash.toLowerCase() ||
      quantity(block.executionNumber, 64) !== BigInt(height) || quantity(block.number, 64) !== BigInt(height) ||
      block.canonical !== true) {
    // Number-only joins are unsafe across reorgs or when the two nodes are out of sync.
    throw new CogenError(409, 'PoVI block does not match this execution block');
  }
  if (typeof block.hash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(block.hash) || !Array.isArray(block.fruits)) {
    throw new CogenError(502, 'Invalid PoVI data');
  }
  const target = quantity(block.target, 256);
  const totalWork = quantity(block.totalWork, 512);

  return {
    // Same integer formula as cogen/difficulty.Work; retain arbitrary precision through JSON.
    difficulty: ((BigInt(1) << BigInt(256)) / (target + BigInt(1))).toString(),
    totalWork: totalWork.toString(),
    target: `0x${ target.toString(16) }`,
    hash: block.hash,
    fruitsCount: block.fruits.length,
  };
}

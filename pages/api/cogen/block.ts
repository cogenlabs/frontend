import type { NextApiRequest, NextApiResponse } from 'next';

import { CogenError, fetchCogenBlock } from 'lib/cogen/block';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const block = await fetchCogenBlock(req.query.height, req.query.hash, process.env.COGEN_POVI_RPC_URL);
    return res.status(200).json(block);
  } catch (error) {
    return res.status(error instanceof CogenError ? error.status : 502).json({
      error: error instanceof CogenError ? error.message : 'PoVI RPC unavailable',
    });
  }
}

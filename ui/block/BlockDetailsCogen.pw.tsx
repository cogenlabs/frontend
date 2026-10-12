import React from 'react';

import * as blockMock from 'mocks/blocks/block';
import { test, expect } from 'playwright/lib';
import BeaconChainWithdrawalsListItem from 'ui/withdrawals/beaconChain/BeaconChainWithdrawalsListItem';
import BeaconChainWithdrawalsTable from 'ui/withdrawals/beaconChain/BeaconChainWithdrawalsTable';

import BlockDetails from './BlockDetails';
import type { BlockQuery } from './useBlockQuery';

test('Cogen difficulty and Fruits are visible without expanding details +@mobile', async({ render, page, mockEnvs }) => {
  await mockEnvs([ [ 'NEXT_PUBLIC_HAS_BEACON_CHAIN', 'true' ] ]);
  await page.route('**/node-api/cogen/block?**', async(route) => {
    expect(new URL(route.request().url()).searchParams.get('hash')).toBe(blockMock.base.hash);
    await route.fulfill({ json: {
      difficulty: '18446744073709551617', totalWork: '36893488147419103234',
      target: '0x0f', hash: blockMock.base.hash, fruitsCount: 0,
    } });
  });
  const component = await render(<BlockDetails query={{
    data: { ...blockMock.base, difficulty: '0', total_difficulty: '0', withdrawals_count: 2 },
    isPlaceholderData: false,
  } as BlockQuery}/>);
  await expect(component.getByText('Difficulty', { exact: true })).toBeVisible();
  await expect(component.getByText('18446744073709551617', { exact: true })).toBeVisible();
  await expect(component.getByText('Included fruits', { exact: true })).toBeVisible();
  await expect(component.getByText('Fruits', { exact: true })).toBeVisible();
  await expect(component.getByText('2 reward payouts', { exact: true })).toBeVisible();
});

test('Cogen RPC mismatch displays unavailable, never Geth zero difficulty', async({ render, page }) => {
  await page.route('**/node-api/cogen/block?**', route => route.fulfill({ status: 409, json: { error: 'mismatch' } }));
  const component = await render(<BlockDetails query={{
    data: { ...blockMock.base, difficulty: '0', total_difficulty: '0' },
    isPlaceholderData: false,
  } as BlockQuery}/>);
  await expect(component.getByText('Unavailable — PoVI data could not be verified for this block').first()).toBeVisible();
});

test('Cogen reward table uses Miner index', async({ render, mockEnvs }) => {
  await mockEnvs([ [ 'NEXT_PUBLIC_HAS_BEACON_CHAIN', 'true' ] ]);
  const component = await render(<BeaconChainWithdrawalsTable items={ [] } view="block" top={ 0 }/>);
  await expect(component.getByText('Miner index', { exact: true })).toBeVisible();
  await expect(component.getByText('Validator index', { exact: true })).toHaveCount(0);
});

test('Cogen mobile block rewards include Miner index and amount +@mobile', async({ render, mockEnvs }) => {
  await mockEnvs([ [ 'NEXT_PUBLIC_HAS_BEACON_CHAIN', 'true' ] ]);
  const component = await render(<BeaconChainWithdrawalsListItem view="block" item={{
    index: 1, validator_index: 0, amount: '1000000000000000000', receiver: blockMock.base.miner,
  }}/>);
  await expect(component.getByText('Miner index', { exact: true })).toBeVisible();
  await expect(component.getByText('Value', { exact: true })).toBeVisible();
});

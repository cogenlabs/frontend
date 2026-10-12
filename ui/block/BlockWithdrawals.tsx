import { Box, Text } from '@chakra-ui/react';
import React from 'react';

import DataListDisplay from 'ui/shared/DataListDisplay';
import type { QueryWithPagesResult } from 'ui/shared/pagination/useQueryWithPages';
import BeaconChainWithdrawalsList from 'ui/withdrawals/beaconChain/BeaconChainWithdrawalsList';
import BeaconChainWithdrawalsTable from 'ui/withdrawals/beaconChain/BeaconChainWithdrawalsTable';

type Props = {
  blockWithdrawalsQuery: QueryWithPagesResult<'general:block_withdrawals'>;
};
const TABS_HEIGHT = 88;

const BlockWithdrawals = ({ blockWithdrawalsQuery }: Props) => {
  const content = blockWithdrawalsQuery.data?.items ? (
    <>
      <Box hideFrom="lg">
        <BeaconChainWithdrawalsList
          items={ blockWithdrawalsQuery.data.items }
          isLoading={ blockWithdrawalsQuery.isPlaceholderData }
          view="block"
        />
      </Box>
      <Box hideBelow="lg">
        <BeaconChainWithdrawalsTable
          items={ blockWithdrawalsQuery.data.items }
          isLoading={ blockWithdrawalsQuery.isPlaceholderData }
          top={ blockWithdrawalsQuery.pagination.isVisible ? TABS_HEIGHT : 0 }
          view="block"
        />
      </Box>
    </>
  ) : null ;

  return (
    <DataListDisplay
      isError={ blockWithdrawalsQuery.isError }
      itemsNum={ blockWithdrawalsQuery.data?.items?.length }
      emptyText="There are no fruit reward payouts for this block."
    >
      <Text mb={ 4 } color="text.secondary">
        All mining reward payouts are listed here. Miner index is a reward code within this block:
        0 = block reward, 1 = winning ticket fruit reward, 2+ = included fruit rewards.
        It is not a permanent miner ID.
      </Text>
      { content }
    </DataListDisplay>
  );
};

export default BlockWithdrawals;

import { Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import React from 'react';

import type { CogenBlock } from 'lib/cogen/block';
import * as DetailedInfo from 'ui/shared/DetailedInfo/DetailedInfo';

interface Props {
  height: number;
  hash: string;
  isLoading?: boolean;
}

const BlockDetailsCogen = ({ height, hash, isLoading }: Props) => {
  const query = useQuery<CogenBlock>({
    queryKey: [ 'cogen-block', height, hash ],
    enabled: !isLoading,
    retry: 1,
    queryFn: async({ signal }) => {
      const params = new URLSearchParams({ height: String(height), hash });
      const response = await fetch(`/node-api/cogen/block?${ params }`, { signal, cache: 'no-store' });
      if (!response.ok) {
        throw new Error('PoVI data unavailable');
      }
      return response.json() as Promise<CogenBlock>;
    },
  });
  // Hide stale query data if the node is unavailable or no longer agrees with this block.
  const data = !isLoading && !query.isError ? query.data : undefined;
  const unavailable = isLoading || query.isPending ? 'Loading…' : 'Unavailable — PoVI data could not be verified for this block';
  const fields = [
    {
      label: 'Difficulty',
      hint: 'PoVI block work: floor(2^256 / (target + 1)), in reference tickets. This is the weight used by Cogen fork choice.',
      value: data?.difficulty,
    },
    { label: 'Total diffculty', hint: 'Cumulative PoVI work through this block.', value: data?.totalWork },
  ];

  return (
    <>
      { fields.map(({ label, hint, value }) => (
        <React.Fragment key={ label }>
          <DetailedInfo.ItemLabel hint={ hint }>{ label }</DetailedInfo.ItemLabel>
          <DetailedInfo.ItemValue>
            <Text wordBreak="break-all" whiteSpace="normal">{ value ?? unavailable }</Text>
          </DetailedInfo.ItemValue>
        </React.Fragment>
      )) }
    </>
  );
};

export default BlockDetailsCogen;

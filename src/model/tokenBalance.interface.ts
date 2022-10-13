import BigNumber from 'bignumber.js';

import { BlockConcise } from './blockConcise.interface';

export interface NFTBalance {
  tokenId: string;
  value: number;
}
export interface TokenBalance {
  address: string;
  tokenAddress: string;
  balance: BigNumber;
  nftBalances: NFTBalance[];

  rank: number;

  firstSeen: BlockConcise;
  lastUpdate: BlockConcise;

  nftCount?: BigNumber;
}

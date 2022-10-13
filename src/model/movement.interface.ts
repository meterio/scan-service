import BigNumber from 'bignumber.js';

import { Token } from '../const';
import { BlockConcise } from './blockConcise.interface';

export interface NFTTransfer {
  tokenId: string;
  value: number;
}
export interface Movement {
  from: string;
  to: string;
  amount: BigNumber;
  token: Token;
  tokenAddress: string;
  nftTransfers: NFTTransfer[];

  block: BlockConcise;
  txHash: string;
  clauseIndex: number;
  logIndex: number;
}

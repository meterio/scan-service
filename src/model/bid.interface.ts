import BigNumber from 'bignumber.js';

export interface Bid {
  id: string;
  address: string;
  amount: string;
  type: string;
  timestamp: number;
  nonce: BigNumber;

  auctionID: string;
  epoch: number;
  blockNum: number;
  txHash: string;
  clauseIndex: number;

  pending: boolean;
  hammerPrice?: BigNumber;
  lotAmount?: BigNumber;
  toSummary?(): object;
}

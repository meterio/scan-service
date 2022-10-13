import BigNumber from 'bignumber.js';

export interface EpochReward {
  epoch: number;
  blockNum: number;
  txHash: string;
  clauseIndex: number;

  bidID?: string;

  address: string;
  amount: BigNumber;
  type: string;
}

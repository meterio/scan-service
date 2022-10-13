import BigNumber from 'bignumber.js';

export interface EpochRewardSummary {
  epoch: number;
  blockNum: number;
  timestamp: number;
  autobidTotal: BigNumber;
  autobidCount: number;
  transferTotal: BigNumber;
  transferCount: number;
  totalReward: BigNumber;
}

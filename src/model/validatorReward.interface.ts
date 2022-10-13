import BigNumber from 'bignumber.js';

export interface RewardInfo {
  address: string;
  amount: BigNumber;
}

export interface ValidatorReward {
  epoch: number;
  baseReward: BigNumber;
  totalReward: BigNumber;
  rewards: RewardInfo[];
  toSummary?(): Object;
}

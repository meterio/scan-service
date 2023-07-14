import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';
export interface IRewardInfo {
  address: string;
  amount: BigNumber;
}
const rewardInfoSchema = new Schema<IRewardInfo>(
  {
    address: { type: String, required: true },
    amount: {
      type: String,
      get: (num: string) => new BigNumber(num),
      set: (bnum: BigNumber) => bnum.toFixed(0),
      required: true,
    },
  },
  { _id: false }
);

export interface IValidatorReward {
  epoch: number;
  baseReward: BigNumber;
  totalReward: BigNumber;
  rewards: IRewardInfo[];
  toSummary?(): Object;
}

const schema = new Schema<IValidatorReward>({
  epoch: { type: Number, required: true, index: true, unique: true },
  baseReward: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  totalReward: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  rewards: [rewardInfoSchema],
});

schema.methods.toSummary = function () {
  return {
    epoch: this.epoch,
    baseReward: this.baseReward.toFixed(),
    totalReward: this.totalReward.toFixed(),
  };
};

export const ValidatorReward = model<IValidatorReward>('ValidatorReward', schema, 'validator_reward');

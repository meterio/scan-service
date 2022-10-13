import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { RewardInfo, ValidatorReward } from './validatorReward.interface';

const rewardInfoSchema = new mongoose.Schema<RewardInfo>(
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

const validatorRewardSchema = new mongoose.Schema<ValidatorReward>({
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

validatorRewardSchema.methods.toSummary = function () {
  return {
    epoch: this.epoch,
    baseReward: this.baseReward.toFixed(),
    totalReward: this.totalReward.toFixed(),
  };
};

const model = mongoose.model<ValidatorReward & mongoose.Document>(
  'ValidatorReward',
  validatorRewardSchema,
  'validator_reward'
);

export default model;

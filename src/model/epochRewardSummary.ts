import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

export interface IEpochRewardSummary {
  epoch: number;
  blockNum: number;
  timestamp: number;
  autobidTotal: BigNumber;
  autobidCount: number;
  transferTotal: BigNumber;
  transferCount: number;
  totalReward: BigNumber;
}

const schema = new Schema<IEpochRewardSummary>({
  epoch: { type: Number, required: true, index: true, unique: true },
  blockNum: { type: Number, required: true },
  timestamp: { type: Number, required: true },

  autobidTotal: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  autobidCount: { type: Number, required: true },
  transferTotal: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  transferCount: { type: Number, required: true },
  totalReward: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
});

schema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const EpochRewardSummary = model<IEpochRewardSummary>('EpochRewardSummary', schema, 'epoch_reward_summary');

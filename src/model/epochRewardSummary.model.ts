import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { EpochRewardSummary } from './epochRewardSummary.interface';

const epochRewardSummarySchema = new mongoose.Schema<EpochRewardSummary>({
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

epochRewardSummarySchema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<EpochRewardSummary & mongoose.Document>(
  'EpochRewardSummary',
  epochRewardSummarySchema,
  'epoch_reward_summary'
);

export default model;

import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

export interface IEpochReward {
  epoch: number;
  blockNum: number;
  txHash: string;
  clauseIndex: number;

  bidID?: string;

  address: string;
  amount: BigNumber;
  type: string;
}

const schema = new Schema<IEpochReward>({
  epoch: { type: Number, required: true, unique: true, index: true },
  blockNum: { type: Number, required: true },
  txHash: { type: String, required: true },
  clauseIndex: { type: Number, required: true },
  bidID: { type: String, required: false },

  address: { type: String, required: true },
  amount: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  type: {
    type: String,
    enum: ['autobid', 'transfer'],
    required: true,
  },
});

schema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    delete ret.blockNum;
    delete ret.epoch;
    delete ret.txHash;
    return ret;
  },
});

export const EpochReward = model<IEpochReward>('EpochReward', schema, 'epoch_reward');

import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

import { Token, enumKeys } from '../const';
import { blockConciseSchema, IBlockConcise } from './blockConcise';

export interface IBound {
  owner: string;
  amount: BigNumber;
  token: Token;

  block: IBlockConcise;
  txHash: string;
  clauseIndex: number;
  logIndex: number;
}

const schema = new Schema<IBound>({
  owner: { type: String, required: true, index: true },
  amount: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  token: { type: String, required: true },

  block: blockConciseSchema,
  txHash: { type: String, required: true, index: true },
  clauseIndex: { type: Number, required: false },
  logIndex: { type: Number, required: false },
});

schema.index({ txHash: 1, clauseIndex: 1, logIndex: 1 }, { unique: true });
schema.index({ 'block.number': 1 });

schema.set('toJSON', {
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const Bound = model<IBound>('Bound', schema, 'bound');

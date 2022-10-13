import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { Token, enumKeys } from '../const';
import { blockConciseSchema } from './blockConcise.model';
import { Bound } from './bound.interface';

const boundSchema = new mongoose.Schema<Bound>({
  owner: { type: String, required: true, index: true },
  amount: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  token: {
    type: String,
    enum: enumKeys(Token),
    get: (enumValue: string) => Token[enumValue as keyof typeof Token],
    set: (enumValue: Token) => Token[enumValue],
    required: true,
  },

  block: blockConciseSchema,
  txHash: { type: String, required: true, index: true },
  clauseIndex: { type: Number, required: false },
  logIndex: { type: Number, required: false },
});

boundSchema.index({ txHash: 1, clauseIndex: 1, logIndex: 1 }, { unique: true });
boundSchema.index({ 'block.number': 1 });

boundSchema.set('toJSON', {
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<Bound & mongoose.Document>('Bound', boundSchema, 'bound');

export default model;

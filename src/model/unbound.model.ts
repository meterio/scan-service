import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { Token, enumKeys } from '../const';
import { blockConciseSchema } from './blockConcise.model';
import { Unbound } from './unbound.interface';

const unboundSchema = new mongoose.Schema<Unbound>({
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

unboundSchema.index({ txHash: 1, clauseIndex: 1, logIndex: 1 }, { unique: true });
unboundSchema.index({ 'block.number': 1 });

unboundSchema.set('toJSON', {
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<Unbound & mongoose.Document>('Unbound', unboundSchema, 'unbound');

export default model;

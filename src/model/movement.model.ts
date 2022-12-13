import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { blockConciseSchema } from './blockConcise.model';
import { Token, enumKeys } from '../const';
import { Movement, NFTTransfer } from './movement.interface';

const nftSchema = new mongoose.Schema<NFTTransfer>(
  {
    tokenId: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const schema = new mongoose.Schema<Movement>({
  from: { type: String, required: true, index: true },
  to: { type: String, required: true, index: true },
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
    index: true,
  },
  tokenAddress: { type: String, required: false, index: true },
  nftTransfers: [nftSchema],

  block: blockConciseSchema,
  txHash: { type: String, required: true, index: true },
  clauseIndex: { type: Number, required: false },
  logIndex: { type: Number, required: false },
});

schema.index({ txHash: 1, clauseIndex: 1, logIndex: 1, token: 1 }, { unique: true });
schema.index({ from: 1, to: 1 });
schema.index({ from: 1, to: 1, tokenAddress: 1 });
schema.index({ from: 1, token: 1 });
schema.index({ to: 1, token: 1 });
schema.index({ 'block.number': 1 });
schema.index({ 'block.number': -1 });
/*
schema.index(
  { 'nftTransfers.0': 1 },
  {
    partialFilterExpression: {
      'nftTransfers.0': { $exists: true },
    },
  }
);
*/

schema.set('toJSON', {
  virtuals: false,
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<Movement & mongoose.Document>('Movement', schema, 'movement');

export default model;

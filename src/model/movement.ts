import { Schema, model } from 'mongoose';

import { blockConciseSchema } from './blockConcise';
import { Token } from '../const';
import BigNumber from 'bignumber.js';

import { IBlockConcise } from './blockConcise';

export interface INFTTransfer {
  tokenId: string;
  value: number;
}

const nftSchema = new Schema<INFTTransfer>(
  {
    tokenId: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

export interface IMovement {
  from: string;
  to: string;
  amount: BigNumber;
  token: Token;
  tokenAddress: string;
  nftTransfers: INFTTransfer[];

  block: IBlockConcise;
  txHash: string;
  clauseIndex: number;
  logIndex: number;
}

const schema = new Schema<IMovement>({
  from: { type: String, required: true, index: true },
  to: { type: String, required: true, index: true },
  amount: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  token: { type: String, required: true, index: true },
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

export const Movement = model<IMovement>('Movement', schema, 'movement');

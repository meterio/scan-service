import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { blockConciseSchema } from './blockConcise.model';
import { TxDigest } from './txDigest.interface';

const txDigestSchema = new mongoose.Schema<TxDigest>({
  block: blockConciseSchema,
  txHash: { type: String, required: true, index: true },
  fee: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },

  from: { type: String, required: true, index: true },
  to: { type: String, required: true, index: true },
  mtr: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  mtrg: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  clauseIndexs: [{ type: Number, required: true }],

  txIndex: { type: Number, default: 0, required: false },
  method: { type: String, default: '', required: true, index: true },
  reverted: { type: Boolean, default: false, required: true, index: true },
  seq: { type: Number, default: 0, required: true },
});

txDigestSchema.index({ from: 1, to: 1 });
txDigestSchema.index({ 'block.number': 1, txHash: 1, from: 1, to: 1, clauseIndexs: 1 }, { unique: true });
txDigestSchema.index({ 'block.number': 1 });
txDigestSchema.index({ 'block.number': -1, txIndex: -1 });

txDigestSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<TxDigest & mongoose.Document>('TxDigest', txDigestSchema, 'tx_digest');

export default model;

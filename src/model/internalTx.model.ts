import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { blockConciseSchema } from './blockConcise.model';
import { InternalTx } from './internalTx.interface';

const internalTxSchema = new mongoose.Schema<InternalTx>({
  txHash: { type: String, required: true, index: true },
  block: blockConciseSchema,
  txIndex: { type: Number, required: true },
  name: { type: String, required: true, index: true },

  from: { type: String, required: true, index: true },
  to: { type: String, required: true, index: true },
  value: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },

  clauseIndex: { type: Number, required: true },

  signature: { type: String, required: false, index: true },
  fee: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: false,
  },
  gasUsed: { type: Number, required: true },
  reverted: { type: Boolean, required: true },
});

internalTxSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

internalTxSchema.index({ txHash: 1, clauseIndex: 1, name: 1 }, { unique: true });
internalTxSchema.index({ 'block.number': -1 });
internalTxSchema.index({ 'block.number': -1, txIndex: -1 });
internalTxSchema.index({ 'block.number': 1 });

const model = mongoose.model<InternalTx & mongoose.Document>('InternalTx', internalTxSchema, 'internal_tx');

export default model;

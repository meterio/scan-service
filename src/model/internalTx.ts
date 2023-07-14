import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';
import { blockConciseSchema } from './blockConcise';
import { IBlockConcise } from './blockConcise';
export interface IInternalTx {
  // tx basic
  txHash: string;
  block: IBlockConcise;
  txIndex: number;
  name: string;
  from: string;
  to: string;
  value: BigNumber;

  // clause
  clauseIndex: number;

  // tx digest
  signature?: string;
  fee: BigNumber;

  // receipt
  gasUsed: number;
  reverted: boolean;
}

const schema = new Schema<IInternalTx>({
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

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

schema.index({ txHash: 1, clauseIndex: 1, name: 1 }, { unique: true });
schema.index({ 'block.number': -1 });
schema.index({ 'block.number': -1, txIndex: -1 });
schema.index({ 'block.number': 1 });

export const InternalTx = model<IInternalTx>('InternalTx', schema, 'internal_tx');

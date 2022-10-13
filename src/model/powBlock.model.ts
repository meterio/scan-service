import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { PowBlock } from './powBlock.interface';

const powBlockSchema = new mongoose.Schema<PowBlock>({
  hash: { type: String, required: true, index: { unique: true } },
  confirmations: { type: Number, required: true },
  strippedSize: { type: Number, required: true },
  size: { type: Number, required: true },
  weight: { type: Number, required: true },
  height: { type: Number, required: true, index: { unique: true } },
  version: { type: Number, required: true },
  versionHex: { type: String, required: true },
  merkleRoot: { type: String, required: true },
  tx: [{ type: String }],
  time: { type: Number, required: true },
  medianTime: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  nonce: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  bits: { type: String, required: true },
  difficulty: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  chainWork: { type: String, required: true },
  nTx: { type: Number, required: true },
  previousBlockHash: { type: String, required: false },
  nextBlockHash: { type: String, required: false },
  beneficiary: { type: String, required: false },
});

powBlockSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<PowBlock & mongoose.Document>('PowBlock', powBlockSchema, 'pow_block');

export default model;

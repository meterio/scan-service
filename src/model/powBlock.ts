import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

export interface IPowBlock {
  hash: string;
  confirmations: number;
  strippedSize: number;
  size: number;
  weight: number;
  height: number;
  version: number;
  versionHex: string;
  merkleRoot: string;
  tx: string[];
  time: number;
  medianTime: BigNumber;
  nonce: BigNumber;
  bits: string;
  difficulty: BigNumber;
  chainWork: string;
  nTx: number;
  previousBlockHash: string;
  nextBlockHash: string;

  beneficiary?: string;
}

const schema = new Schema<IPowBlock>({
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

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const PowBlock = model<IPowBlock>('PowBlock', schema, 'pow_block');

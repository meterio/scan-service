import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { Token, enumKeys } from '../const';
import { Bucket } from './bucket.interface';

const bucketSchema = new mongoose.Schema<Bucket>({
  id: { type: String, required: true, unique: true },
  owner: { type: String, required: true },
  value: {
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
  nonce: { type: Number, required: true },
  createTime: { type: Number, required: true },
  unbounded: { type: Boolean, required: true },
  candidate: { type: String, required: true },
  rate: { type: Number, required: true },
  option: { type: Number, required: true },
  bonusVotes: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  totalVotes: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  matureTime: { type: Number, required: true },
  calcLastTime: { type: Number, required: true },
});

bucketSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

bucketSchema.methods.format = function () {
  return {
    ...this,

    value: this.value.toFixed(),
    token: Number(this.token),
    bonusVotes: Number(this.bonusVotes.toFixed()),
    totalVotes: this.totalVotes.toFixed(),
  };
};

const model = mongoose.model<Bucket & mongoose.Document>('Bucket', bucketSchema, 'bucket');

export default model;

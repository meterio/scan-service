import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

import { Token, enumKeys } from '../const';

export interface IBucket {
  id: string;
  owner: string;
  value: BigNumber;
  token: Token;
  nonce: number;
  createTime: number;
  unbounded: boolean;
  candidate: string;
  rate: number;
  option: number;
  bonusVotes: BigNumber;
  totalVotes: BigNumber;
  matureTime: number;
  calcLastTime: number;
  autobid?: number;
}

const schema = new Schema<IBucket>({
  id: { type: String, required: true, unique: true },
  owner: { type: String, required: true },
  value: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  token: { type: String, required: true },
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
  autobid: { type: Number, required: false },
});

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

schema.methods.format = function () {
  return {
    ...this,

    value: this.value.toFixed(),
    token: Number(this.token),
    bonusVotes: Number(this.bonusVotes.toFixed()),
    totalVotes: this.totalVotes.toFixed(),
  };
};

export const Bucket = model<IBucket>('Bucket', schema, 'bucket');

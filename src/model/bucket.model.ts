import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { Token, enumKeys } from '../const';
import { Bucket } from './bucket.interface';

/**
 * {
  "id": "0x01032d86cd34c37fff6161dafd7ea2721fc0fb2f57adf76c0565ecf3dc719e92",
  "owner": "0xbf85ef4216340eb5cd3c57b550aae7a2712d48d2",
  "value": "212000000000000000000",
  "token": 1,
  "nonce": 4269926304,
  "createTime": 1687888551,
  "unbounded": true,
  "candidate": "0x34bd9720f4d83db2c8d7de87ec38b7832301ca67",
  "rate": 5,
  "option": 1,
  "autobid": 100,
  "bonusVotes": "336123795027",
  "totalVotes": "212000000336123795027",
  "matureTime": 1687974951,
  "calcLastTime": 1687888552
}
 */
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
  autobid: { type: Number, required: false },
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

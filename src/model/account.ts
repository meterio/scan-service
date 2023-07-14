import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

import { IBlockConcise, blockConciseSchema } from './blockConcise';

export interface IAccount {
  address: string;
  name: string;
  alias: string[];

  mtrBalance: BigNumber;
  mtrgBalance: BigNumber;

  mtrBounded: BigNumber;
  mtrgBounded: BigNumber;

  mtrRank: number;
  mtrgRank: number;

  firstSeen: IBlockConcise;
  lastUpdate: IBlockConcise;
}

const schema = new Schema<IAccount>({
  address: { type: String, required: true, index: true, unique: true },
  name: { type: String, required: false },
  alias: [{ type: String }],
  mtrBalance: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  mtrgBalance: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  mtrBounded: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  mtrgBounded: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  mtrRank: { type: Number, required: false, index: 1 },
  mtrgRank: { type: Number, required: false, index: 1 },

  firstSeen: blockConciseSchema,
  lastUpdate: blockConciseSchema,
});

schema.index({ 'lastUpdate.number': 1 });

schema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const Account = model<IAccount>('Account', schema, 'account');

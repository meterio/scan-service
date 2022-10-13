import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { Account } from './account.interface';
import { blockConciseSchema } from './blockConcise.model';

const accountSchema = new mongoose.Schema<Account>({
  address: { type: String, required: true, index: true },
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

accountSchema.index({ address: 1 }, { unique: true });
accountSchema.index({ 'lastUpdate.number': 1 });

accountSchema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<Account & mongoose.Document>('Account', accountSchema, 'account');

export default model;

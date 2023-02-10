import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { ContractType, enumKeys } from '../const';
import { blockConciseSchema } from './blockConcise.model';
import { Contract } from './contract.interface';

const schema = new mongoose.Schema<Contract>({
  type: {
    type: String,
    enum: enumKeys(ContractType),
    get: (enumValue: string) => ContractType[enumValue as keyof typeof ContractType],
    set: (enumValue: ContractType) => ContractType[enumValue],
    required: true,
  },
  address: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: false, index: true },
  symbol: { type: String, required: false, index: true },
  decimals: { type: Number, required: false, default: 18 },
  officialSite: { type: String, required: false },
  totalSupply: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  holdersCount: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  tokensCount: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: false,
  },
  transfersCount: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },

  master: { type: String, required: true, lowercase: true },
  owner: { type: String, required: true, lowercase: true, index: true },
  code: { type: String, required: true },

  verified: { type: Boolean, required: true, default: false },
  verifiedFrom: { type: String, required: false }, // only if this contract is verified by deployed bytecode match
  status: { type: String, required: false, default: '' }, // 'full', 'partial' - verified by sourcify, 'match' verified by deployed bytecode match

  creationTxHash: { type: String, required: true },
  creationInputHash: { type: String, required: false }, // record the sha3(input data) during contract creation
  firstSeen: blockConciseSchema,

  isProxy: { type: Boolean, required: false, default: false },
  proxyType: { type: String, required: false },
  implAddr: { type: String, required: false, lowercase: true },
  prevImplAddr: { type: String, required: false, lowercase: true },
  adminAddr: { type: String, required: false, lowercase: true },
  beaconAddr: { type: String, required: false, lowercase: true },
});

schema.index({ 'firstSeen.number': 1 });
schema.index({ 'firstSeen.number': -1 });
schema.index({ creationInputHash: 1 });
schema.index({ verified: 1, creationInputHash: 1 });

schema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    ret.type = ContractType[obj.type];
    // delete ret.code;
    return ret;
  },
});

const model = mongoose.model<Contract & mongoose.Document>('Contract', schema, 'contract');

export default model;

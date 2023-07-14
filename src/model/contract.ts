import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

import { ContractType, DeployStatus } from '../const';
import { blockConciseSchema } from './blockConcise';
import { IBlockConcise } from './blockConcise';

export interface IContract {
  type: ContractType;
  address: string;

  name?: string;
  symbol?: string;
  decimals?: number;
  officialSite?: string;
  totalSupply: BigNumber;

  // deprecated
  holdersCount: BigNumber;
  // deprecated
  transfersCount: BigNumber;
  // deprecated
  tokensCount?: BigNumber;

  master: string;
  owner?: string;
  code: string;

  verified: Boolean;
  verifiedFrom?: string;
  status?: string;

  creationTxHash: string;
  creationInputHash?: string;
  codeHash?: string;
  firstSeen: IBlockConcise;

  // proxy
  isProxy?: Boolean;
  proxyType?: string;
  implAddr?: string;
  prevImplAddr?: string;
  adminAddr?: string;
  beaconAddr?: string;

  // selfdestruct
  deployStatus?: DeployStatus;
  destructTxHash?: string;
  destructBlock?: IBlockConcise;

  // token list related fields
  rank?: number;
  logoURI?: string;
}

const schema = new Schema<IContract>({
  type: { type: String, required: true },
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
  // deprecated
  holdersCount: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  // deprecated
  tokensCount: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: false,
  },
  // deprecated
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
  creationInputHash: { type: String, required: false, index: true }, // record the sha3(input data) during contract creation
  codeHash: { type: String, required: false, index: true }, // record the sha3(code) for deployed code
  firstSeen: blockConciseSchema,

  isProxy: { type: Boolean, required: false, default: false },
  proxyType: { type: String, required: false }, // ERC-1167 or ERC-1967
  implAddr: { type: String, required: false, lowercase: true },
  prevImplAddr: { type: String, required: false, lowercase: true },
  adminAddr: { type: String, required: false, lowercase: true },
  beaconAddr: { type: String, required: false, lowercase: true },

  // selfdestruct or re-deployed
  deployStatus: { type: String, required: false },

  destructTxHash: { type: String, required: false },
  destructBlock: { type: blockConciseSchema, required: false },

  rank: { type: Number, required: false, default: 0, index: true },
  logoURI: { type: String, required: false },
});

schema.index({ 'firstSeen.number': 1 });
schema.index({ 'firstSeen.number': -1 });
schema.index({ verified: 1, creationInputHash: 1 });
schema.index({ verified: 1, codeHash: 1 });
schema.index({ verified: 1, status: 1, creationInputHash: 1 });
schema.index({ verified: 1, status: 1, codeHash: 1 });
schema.index({ rank: -1 });

schema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    // delete ret.code;
    return ret;
  },
});

export const Contract = model<IContract>('Contract', schema, 'contract');

import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

import { Token, enumKeys } from '../const';
import { blockConciseSchema, IBlockConcise } from './blockConcise';

export interface IPosEvent {
  address: string;
  topics: string[];
  data: string;
  overallIndex?: number;
}
const posEventSchema = new Schema<IPosEvent>(
  {
    address: { type: String, required: true, index: true },
    topics: [{ type: String, required: true }],
    data: { type: String, required: true },
    overallIndex: { type: Number, required: true },
  },
  { _id: false }
);

posEventSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export interface IPosTransfer {
  sender: string;
  recipient: string;
  amount: string;
  token: number;
  overallIndex?: number;
}
const posTransferSchema = new Schema<IPosTransfer>(
  {
    sender: { type: String, required: true, index: true },
    recipient: { type: String, required: true, index: true },
    amount: { type: String, required: true },
    token: { type: Number, required: false },
    overallIndex: { type: Number, required: true },
  },
  { _id: false }
);

posTransferSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export interface ITxOutput {
  contractAddress: string | null;
  events: IPosEvent[];
  transfers: IPosTransfer[];
}
const txOutputSchema = new Schema<ITxOutput>(
  {
    contractAddress: { type: String, required: false },
    events: [posEventSchema],
    transfers: [posTransferSchema],
  },
  { _id: false }
);

export interface IVMError {
  error: string;
  reason: string | null;
  clauseIndex: number;
}
const vmErrSchema = new Schema<IVMError>(
  {
    error: { type: String, required: true },
    reason: { type: String, required: false },
    clauseIndex: { type: Number, required: true },
  },
  { _id: false }
);

export interface IClause {
  to: string | null;
  value: BigNumber;
  token: Token;
  data: string;
}
const clauseSchema = new Schema<IClause>(
  {
    to: { type: String, required: false, index: true },
    value: {
      type: String,
      get: (num: string) => new BigNumber(num),
      set: (bnum: BigNumber) => bnum.toFixed(0),
      required: true,
    },
    token: { type: String, required: true },
    data: { type: String, required: true },
  },
  { _id: false }
);

export interface ITraceOutput {
  json: string;
  clauseIndex: number;
}
const traceOutputSchema = new Schema<ITraceOutput>(
  {
    json: { type: String, required: true },
    clauseIndex: { type: Number, required: true },
  },
  { _id: false }
);

export interface ITransfer {
  sender: string;
  recipient: string;
  amount: BigNumber;
  token: number;
}

export interface ITx {
  hash: string;

  block: IBlockConcise;
  txIndex: number;

  chainTag: number;
  blockRef: string;
  expiration: number;
  gasPriceCoef: number;
  gas: number;
  nonce: string;
  dependsOn: string | null;
  origin: string;

  clauses: IClause[];
  traces: ITraceOutput[];
  clauseCount: number;
  movementCount: number;
  size: number;

  // receipt
  gasUsed: number;
  gasPayer: string;
  paid: BigNumber;
  reward: BigNumber;
  reverted: boolean;
  outputs: ITxOutput[];
  vmError: IVMError;

  // virtual
  signature?: string;

  toSummary?(): object;
}

const schema = new Schema<ITx>({
  hash: { type: String, required: true, index: { unique: true } },

  block: blockConciseSchema,
  txIndex: { type: Number, required: true },

  chainTag: { type: Number, required: true },
  blockRef: { type: String, required: true },
  expiration: { type: Number, required: true },
  gasPriceCoef: { type: Number, required: true },
  gas: { type: Number, required: true },
  nonce: { type: String, required: true },
  dependsOn: { type: String, required: false },
  origin: { type: String, required: true, index: true },

  clauses: [clauseSchema],
  traces: [traceOutputSchema],
  clauseCount: { type: Number, required: true },
  movementCount: { type: Number, require: true },
  size: { type: Number, required: true },

  // receipt
  gasUsed: { type: Number, required: true },
  gasPayer: { type: String, required: true },
  paid: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  reward: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  reverted: {
    type: Boolean,
    required: true,
  },
  outputs: [txOutputSchema],
  vmError: vmErrSchema,
});

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

schema.index({ 'block.hash': 1 });
schema.index({ 'block.number': -1 });
schema.index({ 'block.number': -1, txIndex: -1 });
schema.index({ 'block.number': 1 });

// schema.methods.getType = function () {
//   for (const c of this.clauses) {
//     if (c.data !== '0x') {
//       return 'call';
//     }
//   }
//   if (this.origin === ZeroAddress) {
//     return 'reward';
//   }
//   return 'transfer';
// };

// schema.methods.getType = function () {
//   for (const c of this.clauses) {
//     if (c.data !== '0x') {
//       if (c.to) {
//         if (c.to.toLowerCase() === AccountLockModuleAddress) {
//           return 'account lock';
//         }
//         if (c.to.toLowerCase() === StakingModuleAddress) {
//           return 'staking';
//         }
//         if (c.to.toLowerCase() === AuctionModuleAddress) {
//           return 'auction';
//         }
//       }
//       const se = devkit.ScriptEngine;
//       if (se.IsScriptEngineData(c.data)) {
//         const scriptData = se.decodeScriptData(c.data);
//         if (scriptData.header.modId === se.ModuleID.Staking) {
//           return 'staking';
//         }
//         if (scriptData.header.modId === se.ModuleID.Auction) {
//           return 'auction';
//         }
//         if (scriptData.header.modId === se.ModuleID.AccountLock) {
//           return 'account lock';
//         }
//       }
//       return 'call';
//     }
//   }
//   if (this.origin === ZeroAddress) {
//     return 'reward';
//   }
//   return 'transfer';
// };

schema.virtual('signature').get(function () {
  let signature = '';
  if (this.clauses.length > 0) {
    signature = this.clauses[0].data.length >= 10 ? this.clauses[0].data.substring(0, 10) : '';
  }
  return signature;
});

schema.methods.toSummary = function () {
  const token = this.clauses.length > 0 ? this.clauses[0].token : 0;
  return {
    hash: this.hash,
    block: this.block,
    origin: this.origin,
    clauseCount: this.clauses ? this.clauses.length : 0,
    movementCount: this.movementCount,
    paid: this.paid.toFixed(),
    gasUsed: this.gasUsed,
    gasPriceCoef: this.gasPriceCoef,
    gasPrice: 5e11 + 5e11 * (this.gasPriceCoef / 255),
    blockRef: this.blockRef,
    expiration: this.expiration,
    vmError: this.vmError,
    txIndex: this.txIndex,

    token: token,
    reverted: this.reverted,
    clauses: this.clauses,
  };
};
export const Tx = model<ITx>('Tx', schema, 'tx');

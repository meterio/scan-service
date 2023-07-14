import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';
import { BlockType } from '../const';

export interface ICommitteeMember {
  index: number;
  netAddr: string;
  pubKey: string;
}

export const committeeMemberSchema = new Schema<ICommitteeMember>(
  {
    index: { type: Number, required: true },
    netAddr: { type: String, required: true },
    pubKey: { type: String, required: true }, // Base64 ECDSA
  },
  { _id: false }
);

export interface IQC {
  qcHeight: number;
  qcRound: number;
  voterBitArrayStr: string;
  epochID: number;
}

const qcSchema = new Schema<IQC>(
  {
    qcHeight: { type: Number, required: true },
    qcRound: { type: Number, required: true },
    voterBitArrayStr: { type: String, required: false },
    epochID: { type: Number, required: true },
  },
  { _id: false }
);

export interface IPowInfo {
  hash: string;
  prevBlock: string;
  beneficiary: string;
  height: number;
}

const powInfoSchema = new Schema<IPowInfo>(
  {
    hash: { type: String, required: true },
    prevBlock: { type: String, required: true },
    beneficiary: { type: String, required: true },
    height: { type: Number, required: true },
  },
  { _id: false }
);

export interface IBlock {
  // basics
  hash: string;
  number: number;
  parentID: string;
  timestamp: number;
  gasLimit: number;
  gasUsed: number;
  txsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  signer: string;
  beneficiary: string;
  size: number;
  nonce: string;
  lastKBlockHeight: number;
  committee: ICommitteeMember[];
  qc: IQC;

  // calculated
  txHashs: string[];
  totalScore: number;
  txCount: number;
  score: number;
  reward: BigNumber;
  actualReward: BigNumber;
  gasChanged: number;
  blockType: BlockType;

  epoch: number;
  kblockData: string[];
  powBlocks?: IPowInfo[];
  toSummary?(): object;
}

const schema = new Schema<IBlock>({
  hash: { type: String, required: true, index: { unique: true } },
  number: { type: Number, required: true, index: { unique: true } },
  parentID: { type: String, required: true },
  timestamp: { type: Number, required: true, index: true },
  gasLimit: { type: Number, required: true },
  gasUsed: { type: Number, required: true },
  txsRoot: { type: String, required: true },
  stateRoot: { type: String, required: true },
  receiptsRoot: { type: String, required: true },
  signer: { type: String, required: true, index: true },
  beneficiary: { type: String, required: true, index: true },
  size: { type: Number, required: true },

  nonce: { type: String, required: true },
  lastKBlockHeight: { type: Number, required: true },
  committee: [{ type: committeeMemberSchema, required: false }],
  qc: { type: qcSchema, required: false },

  txHashs: [{ type: String }],
  totalScore: { type: Number, required: true },
  txCount: { type: Number, required: true },
  score: { type: Number, required: true },
  reward: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  actualReward: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  gasChanged: { type: Number, required: true },
  blockType: {
    type: String,
    required: true,
    index: true,
  },
  epoch: { type: Number, required: true },
  kblockData: [{ type: String }],
  powBlocks: [powInfoSchema],
});
schema.index({ number: -1 });
schema.index({ timestamp: -1 });

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

schema.methods.toSummary = function () {
  return {
    number: this.number,
    hash: this.hash,
    parentID: this.parentID,
    timestamp: this.timestamp,
    txHashs: this.txHashs,
    lastKBlockHeight: this.lastKBlockHeight,
    epoch: this.qc.epochID,
    qcHeight: this.qc.qcHeight,
    blockType: this.blockType,
    gasUsed: this.gasUsed,
    gasLimit: this.gasLimit,
    txCount: this.txCount,
    beneficiary: this.beneficiary,
    reward: this.reward,
    actualReward: this.actualReward,
    stateRoot: this.stateRoot,
    receiptsRoot: this.receiptsRoot,
    txsRoot: this.txsRoot,
    size: this.size,
  };
};

export const Block = model<IBlock>('Block', schema, 'block');

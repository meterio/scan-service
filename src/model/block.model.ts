import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { BlockType, enumKeys } from '../const';
import { Block, CommitteeMember, QC } from './block.interface';
import { PowBlock } from './powBlock.interface';

export const committeeMemberSchema = new mongoose.Schema<CommitteeMember>(
  {
    index: { type: Number, required: true },
    netAddr: { type: String, required: true },
    pubKey: { type: String, required: true }, // Base64 ECDSA
  },
  { _id: false }
);

const qcSchema = new mongoose.Schema<QC>(
  {
    qcHeight: { type: Number, required: true },
    qcRound: { type: Number, required: true },
    voterBitArrayStr: { type: String, required: false },
    epochID: { type: Number, required: true },
  },
  { _id: false }
);

const powBlockSchema = new mongoose.Schema<PowBlock>(
  {
    hash: { type: String, required: true },
    prevBlock: { type: String, required: true },
    beneficiary: { type: String, required: true },
    height: { type: Number, required: true },
  },
  { _id: false }
);

const blockSchema = new mongoose.Schema<Block>({
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
    enum: enumKeys(BlockType),
    get: (enumValue: string) => BlockType[enumValue as keyof typeof BlockType],
    set: (enumValue: BlockType) => BlockType[enumValue],
    required: true,
    index: true,
  },
  epoch: { type: Number, required: true },
  kblockData: [{ type: String }],
  powBlocks: [powBlockSchema],
});
blockSchema.index({ number: -1 });
blockSchema.index({ timestamp: -1 });

blockSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

blockSchema.methods.toSummary = function () {
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

const model = mongoose.model<Block & mongoose.Document>('Block', blockSchema, 'block');

export default model;

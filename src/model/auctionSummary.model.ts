import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { Token, enumKeys, fromWei } from '../const';
import { AuctionDist, AuctionSummary, AuctionTx } from './auctionSummary.interface';

const auctionDistSchema = new mongoose.Schema<AuctionDist>(
  {
    address: { type: String, required: true },
    amount: {
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
  },
  { _id: false }
);

const auctionTxSchema = new mongoose.Schema<AuctionTx>(
  {
    txid: { type: String, required: true },
    address: { type: String, required: true },
    amount: { type: String, required: true },
    type: { type: String, required: true },
    timestamp: { type: Number, required: true },
    nonce: { type: Number, required: true },
  },
  { _id: false }
);

const auctionSummarySchema = new mongoose.Schema<AuctionSummary>({
  id: { type: String, required: true, unique: true },
  startHeight: { type: Number, required: true },
  startEpoch: { type: Number, required: true },
  endHeight: { type: Number, required: true },
  endEpoch: { type: Number, required: true },
  sequence: { type: Number, required: true },
  createTime: { type: Number, required: true },
  releasedMTRG: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  reservedMTRG: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  reservedPrice: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  receivedMTR: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  actualPrice: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  leftoverMTRG: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  txs: [auctionTxSchema],
  distMTRG: [auctionDistSchema],
});

auctionSummarySchema.methods.toSummary = function () {
  let dist = [];
  for (const d of this.distMTRG) {
    dist.push({
      address: d.address,
      amount: d.amount,
      amountStr: `${fromWei(d.amount)} ${Token[d.token]}`,
    });
  }
  return {
    id: this.id,
    startHeight: this.startHeight,
    startEpoch: this.startEpoch,
    endHeight: this.endHeight,
    endEpoch: this.endEpoch,
    sequence: this.sequence,
    createTime: this.createTime,
    bidCount: this.txs ? this.txs.length : 0,
    distCount: this.distMTRG ? this.distMTRG.length : 0,
    released: this.releasedMTRG.toFixed(),
    received: this.receivedMTR.toFixed(),
    reserved: this.reservedMTRG.toFixed(),
    reservedPrice: this.reservedPrice.toFixed(),
    actualPrice: this.actualPrice.toFixed(),
    leftover: this.leftoverMTRG.toFixed(),
  };
};

auctionSummarySchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<AuctionSummary & mongoose.Document>(
  'AuctionSummary',
  auctionSummarySchema,
  'auction_summary'
);

export default model;

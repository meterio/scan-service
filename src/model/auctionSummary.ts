import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

import { Token, fromWei } from '../const';

export interface IAuctionDist {
  address: string;
  amount: BigNumber;
  token: Token;
}

const auctionDistSchema = new Schema<IAuctionDist>(
  {
    address: { type: String, required: true },
    amount: {
      type: String,
      get: (num: string) => new BigNumber(num),
      set: (bnum: BigNumber) => bnum.toFixed(0),
      required: true,
    },
    token: { type: String, required: true },
  },
  { _id: false }
);

export interface IAuctionTx {
  txid: string;
  address: string;
  amount: string;
  type: string;
  timestamp: number;
  nonce: number;
}

const auctionTxSchema = new Schema<IAuctionTx>(
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

export interface IAuctionSummary {
  id: string;
  startHeight: number;
  startEpoch: number;
  endHeight: number;
  endEpoch: number;
  sequence: number;
  createTime: number;
  releasedMTRG: BigNumber;
  reservedMTRG: BigNumber;
  reservedPrice: BigNumber;
  receivedMTR: BigNumber;
  actualPrice: BigNumber;
  leftoverMTRG: BigNumber;
  txs: IAuctionTx[];
  distMTRG: IAuctionDist[];
}

const schema = new Schema<IAuctionSummary>({
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

schema.methods.toSummary = function () {
  let dist = [];
  for (const d of this.distMTRG) {
    dist.push({
      address: d.address,
      amount: d.amount,
      amountStr: `${fromWei(d.amount)} ${d.token}`,
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

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const AuctionSummary = model<IAuctionSummary>('AuctionSummary', schema, 'auction_summary');

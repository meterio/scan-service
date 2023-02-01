import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { Auction } from './auction.interface';

const auctionSchema = new mongoose.Schema<Auction>({
  id: { type: String, required: true, unique: true },
  startHeight: { type: Number, required: true },
  startEpoch: { type: Number, required: true },
  endHeight: { type: Number, required: true },
  endEpoch: { type: Number, required: true },

  auctionStartHeight: { type: Number, required: true },
  auctionStartEpoch: { type: Number, required: true },
  auctionStartTxHash: { type: String, required: true },
  auctionStartClauseIndex: { type: Number, required: true },

  auctionEndHeight: { type: Number, required: false },
  auctionEndEpoch: { type: Number, required: false },
  auctionEndTxHash: { type: String, required: false },
  auctionEndClauseIndex: { type: Number, required: false },

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

  pending: { type: Boolean, required: true, default: false, index: true },
  bidCount: { type: Number, required: true },
  autobidTotal: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  userbidTotal: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
});

auctionSchema.methods.toSummary = function () {
  let summary = {
    id: this.id,
    startHeight: this.startHeight,
    startEpoch: this.startEpoch,
    endHeight: this.endHeight,
    endEpoch: this.endEpoch,

    auctionStartHeight: this.auctionStartHeight,
    auctionStartEpoch: this.auctionStartEpoch,
    auctionStartTxHash: this.auctionStartTxHash,
    auctionStartClauseIndex: this.auctionStartClauseIndex,

    auctionEndHeight: this.auctionEndHeight,
    auctionEndEpoch: this.auctionEndEpoch,
    auctionEndTxHash: this.auctionEndTxHash,
    auctionEndClauseIndex: this.auctionEndClauseIndex,

    sequence: this.sequence,
    createTime: this.createTime,
    released: this.releasedMTRG.toFixed(),
    received: this.receivedMTR.toFixed(),
    reserved: this.reservedMTRG.toFixed(),
    reservedPrice: this.reservedPrice.toFixed(),
    actualPrice: this.actualPrice.toFixed(),
    leftover: this.leftoverMTRG.toFixed(),

    pending: this.pending,
    bidCount: this.bidCount,
    userbidTotal: this.userbidTotal.toFixed(),
    autobidTotal: this.autobidTotal.toFixed(),
  };

  return summary;
};

auctionSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<Auction & mongoose.Document>('Auction', auctionSchema, 'auction');

export default model;

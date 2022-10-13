import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { Bid } from './bid.interface';

const bidSchema = new mongoose.Schema<Bid>({
  id: { type: String, required: true, unique: true },
  address: { type: String, required: true, index: true },
  amount: { type: String, required: true },
  type: { type: String, required: true },
  timestamp: { type: Number, required: true, index: true },
  nonce: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },

  auctionID: { type: String, required: true, index: true },
  epoch: { type: Number, required: true, index: true },
  blockNum: { type: Number, required: true, index: true },
  txHash: { type: String, required: true },
  clauseIndex: { type: Number, required: true },

  pending: { type: Boolean, required: true, default: true },
  hammerPrice: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: false,
  },
  lotAmount: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: false,
  },
});

bidSchema.methods.toSummary = function (doc: Bid & mongoose.Document) {
  return {
    epoch: this.epoch,
    blockNum: this.blockNum,
    txHash: this.txHash,
    type: this.type,
    address: this.address,
    auctionID: this.auctionID,
    amount: new BigNumber(this.amount).toFixed(),
    pending: this.pending,
    hammerPrice: this.hammerPrice,
    lotAmount: this.lotAmount.toFixed(),
    timestamp: this.timestamp,
  };
};

const model = mongoose.model<Bid & mongoose.Document>('Bid', bidSchema, 'bid');

export default model;

import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';
import { TokenbalanceModel } from '.';

import { blockConciseSchema } from './blockConcise.model';
import { TokenBalance, NFTBalance } from './tokenBalance.interface';
const nftBalanceSchema = new mongoose.Schema<NFTBalance>(
  {
    tokenId: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const tokenBalanceSchema = new mongoose.Schema<TokenBalance>({
  address: { type: String, required: true, index: true },
  tokenAddress: { type: String, required: true, index: true },
  balance: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  nftBalances: [nftBalanceSchema],
  rank: { type: Number, required: true, default: 99999999, index: true },

  firstSeen: blockConciseSchema,
  lastUpdate: blockConciseSchema,
});

tokenBalanceSchema.index({ address: 1, tokenAddress: 1 }, { unique: true });
tokenBalanceSchema.index({ 'lastUpdate.number': 1 });
tokenBalanceSchema.index({ nftBalances: -1 });
tokenBalanceSchema.index({ balance: -1 });

tokenBalanceSchema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

tokenBalanceSchema.virtual('nftCount').get(function () {
  let count = new BigNumber(0);
  for (const { value } of this.nftBalances) {
    count = count.plus(value);
  }
  return count;
});

const model = mongoose.model<TokenBalance & mongoose.Document>('TokenBalance', tokenBalanceSchema, 'token_balance');

export default model;

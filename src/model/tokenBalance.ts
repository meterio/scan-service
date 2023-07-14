import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

import { blockConciseSchema } from './blockConcise';
import { IBlockConcise } from './blockConcise';

export interface INFTBalance {
  tokenId: string;
  value: number;
}

const nftBalanceSchema = new Schema<INFTBalance>(
  {
    tokenId: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

export interface ITokenBalance {
  address: string;
  tokenAddress: string;
  balance: BigNumber;
  nftBalances: INFTBalance[];

  rank: number;

  firstSeen: IBlockConcise;
  lastUpdate: IBlockConcise;

  nftCount?: BigNumber;
}

const schema = new Schema<ITokenBalance>({
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

schema.index({ address: 1, tokenAddress: 1 }, { unique: true });
schema.index({ 'lastUpdate.number': 1 });
schema.index({ nftBalances: -1 });
schema.index({ balance: -1 });

schema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

schema.virtual('nftCount').get(function () {
  let count = new BigNumber(0);
  for (const { value } of this.nftBalances) {
    count = count.plus(value);
  }
  return count;
});

export const TokenBalance = model<ITokenBalance>('TokenBalance', schema, 'token_balance');

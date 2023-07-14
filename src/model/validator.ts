import BigNumber from 'bignumber.js';
import { Schema, model } from 'mongoose';

import { ValidatorStatus } from '../const';

export interface IDistributor {
  address: string;
  shares: number;
}
const distributorSchema = new Schema<IDistributor>(
  {
    address: { type: String, required: true },
    shares: { type: Number, required: true },
  },
  { _id: false }
);

export interface IValidator {
  pubKey: string; // primary key

  // updatable attributes
  name: string;
  address: string;
  ipAddress: string;
  port: number;
  commission: number; // candidate commission （unit: shannon, aka 1e9)

  status: ValidatorStatus;

  // candidate
  totalVotes: BigNumber;
  buckets: string[];

  // jailed fields
  totalPoints?: number;
  bailAmount?: string;
  jailedTime?: number;
  infractions?: string;

  // only delegate has this field
  delegateCommission?: number; // delegate commission （unit: shannon, aka 1e9)
  votingPower?: BigNumber;
  distributors?: IDistributor[];
}

const validatorSchema = new Schema<IValidator>({
  pubKey: { type: String, required: true, unique: true },

  // updatable attributes
  name: { type: String, required: true },
  address: { type: String, required: true },
  ipAddress: { type: String, required: true },
  port: { type: Number, required: true },
  commission: { type: Number, required: true },

  status: { type: String, required: true },

  // candidate
  totalVotes: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: true,
  },
  buckets: [{ type: String }],

  // jailed fields
  totalPoints: { type: Number, required: false },
  bailAmount: { type: String, required: false },
  jailedTime: { type: Number, required: false },
  infractions: { type: String, required: false },

  // only delegate has this field
  delegateCommission: { type: Number, required: false },
  votingPower: {
    type: String,
    get: (num: string) => new BigNumber(num),
    set: (bnum: BigNumber) => bnum.toFixed(0),
    required: false,
  },
  distributors: [distributorSchema],
});

validatorSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const Validator = model<IValidator>('Validator', validatorSchema, 'validator');

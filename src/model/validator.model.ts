import BigNumber from 'bignumber.js';
import mongoose from 'mongoose';

import { ValidatorStatus, enumKeys } from '../const';
import { Distributor, Validator } from './validator.interface';

const distributorSchema = new mongoose.Schema<Distributor>(
  {
    address: { type: String, required: true },
    shares: { type: Number, required: true },
  },
  { _id: false }
);

const validatorSchema = new mongoose.Schema<Validator>({
  pubKey: { type: String, required: true, unique: true },

  // updatable attributes
  name: { type: String, required: true },
  address: { type: String, required: true },
  ipAddress: { type: String, required: true },
  port: { type: Number, required: true },
  commission: { type: Number, required: true },

  status: {
    type: String,
    enum: enumKeys(ValidatorStatus),
    get: (enumValue: string) => ValidatorStatus[enumValue as keyof typeof ValidatorStatus],
    set: (enumValue: ValidatorStatus) => ValidatorStatus[enumValue],
    required: true,
  },

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
  bailAmount: { type: Number, required: false },
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

const model = mongoose.model<Validator & mongoose.Document>('Validator', validatorSchema, 'validator');

export default model;

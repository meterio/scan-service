import mongoose from 'mongoose';

import { ABIFragment } from './abiFragment.interface';

const schema = new mongoose.Schema<ABIFragment>({
  name: { type: String, required: true, index: true },
  type: { type: String, required: true, index: true },
  signature: { type: String, required: true, index: true },
  abi: { type: String, required: true, index: true, unique: true },
});

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<ABIFragment & mongoose.Document>('ABIFragment', schema, 'abi_fragment');

export default model;

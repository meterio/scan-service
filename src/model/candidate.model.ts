import mongoose from 'mongoose';

import { Candidate } from './candidate.interface';

const schema = new mongoose.Schema<Candidate>({
  epoch: { type: Number, required: true, index: true },
  pubKey: { type: String, required: true, index: true },

  name: { type: String, required: true },
  description: { type: String, required: false },
  address: { type: String, required: true, index: true },
  ipAddress: { type: String, required: true },
  port: { type: Number, required: true },
  totalVotes: { type: String, required: true },
});

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

schema.index({ epoch: 1, pubKey: 1 }, { unique: true });

const model = mongoose.model<Candidate & mongoose.Document>('Candidate', schema, 'candidate');

export default model;

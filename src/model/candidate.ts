import { Schema, model } from 'mongoose';

export interface ICandidate {
  epoch: number;
  pubKey: string;

  // updatable attributes
  name: string;
  description: string;
  address: string;
  ipAddress: string;
  port: number;
  totalVotes: string;
}

const schema = new Schema<ICandidate>({
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

export const Candidate = model<ICandidate>('Candidate', schema, 'candidate');

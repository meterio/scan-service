import mongoose from 'mongoose';

import { Known } from './known.interface';

const knownSchema = new mongoose.Schema<Known>({
  ecdsaPK: { type: String, required: true, index: true, unique: true },
  blsPK: { type: String, required: true },

  // updatable attributes
  name: { type: String, required: true },
  description: { type: String, required: false },
  address: { type: String, required: true, index: true },
  ipAddress: { type: String, required: true },
  port: { type: Number, required: true },
});

knownSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<Known & mongoose.Document>('Known', knownSchema, 'known');

export default model;

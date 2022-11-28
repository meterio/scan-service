import mongoose from 'mongoose';

import { Curated } from './curated.interface';

const schema = new mongoose.Schema<Curated>({
  address: { type: String, required: true, index: true, unique: true },
  name: { type: String, required: false },
});

schema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<Curated & mongoose.Document>('Curated', schema, 'curated');

export default model;

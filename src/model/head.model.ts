import mongoose from 'mongoose';

import { Head } from './head.interface';

const headSchema = new mongoose.Schema<Head>({
  key: { type: String, required: true, unique: true },
  hash: { type: String, required: true },
  num: { type: Number, required: true },
});

headSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<Head & mongoose.Document>('Head', headSchema, 'head');

export default model;

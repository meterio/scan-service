import mongoose from 'mongoose';

import { CuratedCollection } from './curatedCollection.interface';
import { Network, enumKeys } from '../const';

const curatedCollectionSchema = new mongoose.Schema<CuratedCollection>({
  address: { type: String, required: true, index: true },
  name: { type: String, required: false },
  network: {
    type: String,
    enum: enumKeys(Network),
    get: (enumValue: string) => Network[enumValue as keyof typeof Network],
    set: (enumValue: Network) => Network[enumValue],
    required: true,
  }
});

curatedCollectionSchema.index({ address: 1 }, { unique: true });

curatedCollectionSchema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<CuratedCollection & mongoose.Document>('CuratedCollection', curatedCollectionSchema, 'curatedCollection');

export default model;

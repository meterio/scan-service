import { Schema, model } from 'mongoose';

export interface IHead {
  key: string;
  num: number;
  hash: string;
}

const schema = new Schema<IHead>({
  key: { type: String, required: true, unique: true },
  hash: { type: String, required: true },
  num: { type: Number, required: true },
});

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const Head = model<IHead>('Head', schema, 'head');

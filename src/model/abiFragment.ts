import { Schema, model } from 'mongoose';

export interface IABIFragment {
  name: string;
  type: string;
  signature: string;
  abi: string;
}

const schema = new Schema<IABIFragment>({
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

export const ABIFragment = model<IABIFragment>('ABIFragment', schema, 'abi_fragment');

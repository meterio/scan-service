import { Schema, model } from 'mongoose';

export interface IKnown {
  ecdsaPK: string; // primary key
  blsPK: string;

  // updatable attributes
  name: string;
  description: string;
  address: string;
  ipAddress: string;
  port: number;
}

const knownSchema = new Schema<IKnown>({
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

export const Known = model<IKnown>('Known', knownSchema, 'known');

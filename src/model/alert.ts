import { Schema, model } from 'mongoose';

export interface IAlert {
  network: string;
  number: number;
  epoch: number;
  channel: string;
  msg: string;
  createdAt?: number;
}

const schema = new Schema<IAlert>(
  {
    network: { type: String, enum: ['mainnet', 'testnet', 'devnet'], required: true },
    number: { type: Number, required: true },
    epoch: { type: Number, required: true },
    channel: { type: String, enum: ['slack'], required: true },
    msg: { type: String, required: true },
    createdAt: { type: Number, index: true },
  },
  {
    timestamps: {
      currentTime: () => Math.floor(Date.now() / 1000),
      updatedAt: false,
    },
  }
);

schema.index({ network: 1, number: 1, epoch: 1, channel: 1, msg: 1 });
schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const Alert = model<IAlert>('Alert', schema, 'alert');

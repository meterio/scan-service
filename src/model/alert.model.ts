import mongoose from 'mongoose';

import { Alert } from './alert.interface';

const alertSchema = new mongoose.Schema<Alert>(
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

alertSchema.index({ network: 1, number: 1, epoch: 1, channel: 1, msg: 1 });
alertSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

const model = mongoose.model<Alert & mongoose.Document>('Alert', alertSchema, 'alert');

export default model;

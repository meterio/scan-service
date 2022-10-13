import mongoose from 'mongoose';

import { blockConciseSchema } from './blockConcise.model';
import { LogTransfer } from './logTransfer.interface';

const schema = new mongoose.Schema<LogTransfer>({
  sender: { type: String, required: true, index: true },
  recipient: { type: String, required: true, index: true },
  amount: { type: String, required: true },
  token: { type: Number, required: false },

  block: blockConciseSchema,
  txHash: { type: String, required: true, index: true },
  clauseIndex: { type: Number, required: true, index: true },
  logIndex: { type: Number, required: true },
});

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

schema.index({ 'block.number': -1 });
schema.index({ 'block.number': 1 });
schema.index({ txHash: 1, clauseIndex: 1, logIndex: 1 }, { unique: true });

const model = mongoose.model<LogTransfer & mongoose.Document>('LogTransfer', schema, 'log_transfer');

export default model;

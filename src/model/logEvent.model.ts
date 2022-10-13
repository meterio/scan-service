import mongoose from 'mongoose';

import { blockConciseSchema } from './blockConcise.model';
import { LogEvent } from './logEvent.interface';

const schema = new mongoose.Schema<LogEvent>({
  address: { type: String, required: true, index: true },
  topics: [{ type: String, required: true }],
  data: { type: String, required: true },

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

const model = mongoose.model<LogEvent & mongoose.Document>('LogEvent', schema, 'log_event');

export default model;

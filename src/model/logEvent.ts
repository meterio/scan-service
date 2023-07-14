import { Schema, model } from 'mongoose';

import { blockConciseSchema } from './blockConcise';
import { IBlockConcise } from './blockConcise';
export interface ILogEvent {
  address: string;
  topics: string[];
  data: string;
  txHash: string;
  block: IBlockConcise;
  clauseIndex: number;
  logIndex: number;
}

const schema = new Schema<ILogEvent>({
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

export const LogEvent = model<ILogEvent>('LogEvent', schema, 'log_event');

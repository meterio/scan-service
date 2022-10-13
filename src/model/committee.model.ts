import mongoose from 'mongoose';

import { committeeMemberSchema } from './block.model';
import { blockConciseSchema } from './blockConcise.model';
import { Committee } from './committee.interface';

const committeeSchema = new mongoose.Schema<Committee>({
  epoch: { type: Number, required: true, index: true },
  kblockHeight: { type: Number, required: true },
  startBlock: { type: blockConciseSchema, required: true },
  members: [{ type: committeeMemberSchema, required: false }],
  endBlock: { type: blockConciseSchema, required: false },
});

committeeSchema.index({ epoch: -1 });

committeeSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});
const model = mongoose.model<Committee & mongoose.Document>('Committee', committeeSchema, 'committee');

export default model;

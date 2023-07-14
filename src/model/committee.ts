import { Schema, model } from 'mongoose';
import { committeeMemberSchema } from './block';
import { blockConciseSchema } from './blockConcise';
import { ICommitteeMember } from './block';
import { IBlockConcise } from './blockConcise';
export interface ICommittee {
  epoch: number;
  kblockHeight: number;
  members: ICommitteeMember[];
  startBlock: IBlockConcise;
  endBlock?: IBlockConcise;
}

const schema = new Schema<ICommittee>({
  epoch: { type: Number, required: true, index: true },
  kblockHeight: { type: Number, required: true },
  startBlock: { type: blockConciseSchema, required: true },
  members: [{ type: committeeMemberSchema, required: false }],
  endBlock: { type: blockConciseSchema, required: false },
});

schema.index({ epoch: -1 });

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const Committee = model<ICommittee>('Committee', schema, 'committee');

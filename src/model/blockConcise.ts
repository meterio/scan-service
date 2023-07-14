import { Schema } from 'mongoose';

export interface IBlockConcise {
  hash: string;
  number: number;
  timestamp: number;
}

export const blockConciseSchema = new Schema<IBlockConcise>(
  {
    hash: { type: String, required: true },
    number: { type: Number, required: true },
    timestamp: { type: Number, required: true },
  },
  { _id: false }
);

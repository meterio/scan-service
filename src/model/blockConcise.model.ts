import mongoose from 'mongoose';

import { BlockConcise } from './blockConcise.interface';

export const blockConciseSchema = new mongoose.Schema<BlockConcise>(
  {
    hash: { type: String, required: true },
    number: { type: Number, required: true },
    timestamp: { type: Number, required: true },
  },
  { _id: false }
);

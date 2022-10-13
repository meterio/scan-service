import mongoose from 'mongoose';

import { ContractFile } from './contractFile.interface';

const schema = new mongoose.Schema<ContractFile>({
  name: { type: String, required: true, index: true },
  path: { type: String, required: true, index: true, unique: true },
  content: { type: String, required: true },
  address: { type: String, required: true, index: true },
});

schema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    delete ret.code;
    return ret;
  },
});

const model = mongoose.model<ContractFile & mongoose.Document>('ContractFile', schema, 'contract_file');

export default model;

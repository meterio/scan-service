import { Schema, model } from 'mongoose';

export interface IContractFile {
  name: string;
  path: string;
  content: string;
  address: string;
}

const schema = new Schema<IContractFile>({
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

export const ContractFile = model<IContractFile>('ContractFile', schema, 'contract_file');

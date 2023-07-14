import mongoose from 'mongoose';

export interface IPowIn {
  hash: string;
  index: number;
  script: string;
  sequence: number;
  witness: any[];
}
const powInSchema = new mongoose.Schema<IPowIn>(
  {
    hash: { type: String, required: true },
    index: { type: Number, required: true },
    script: { type: String, required: true },
    sequence: { type: Number, required: true },
    witness: [{ type: Object, required: false }],
  },
  { _id: false }
);
export interface IPowOut {
  value: number;
  script: string;
}
const powOutSchema = new mongoose.Schema<IPowOut>(
  {
    value: { type: Number, required: true },
    script: { type: String, required: true },
  },
  { _id: false }
);

export interface IPowTx {
  hash: string;
  version: number;
  locktime: number;
  ins: IPowIn[];
  outs: IPowOut[];
}

const schema = new mongoose.Schema<IPowTx>({
  hash: { type: String, required: true, index: { unique: true } },
  version: { type: Number, required: true },
  locktime: { type: Number, required: true },
  ins: [powInSchema],
  outs: [powOutSchema],
});

schema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

export const PowTx = mongoose.model<IPowTx>('PowTx', schema, 'pow_tx');

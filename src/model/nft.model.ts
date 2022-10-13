import mongoose from 'mongoose';
import { blockConciseSchema } from './blockConcise.model';

import { NFT } from './nft.interface';

const schema = new mongoose.Schema<NFT>({
  address: { type: String, required: true, index: true },
  tokenId: { type: String, required: true, index: true },
  value: { type: Number, required: false, default: 1 }, // TODO: change this to required
  type: { type: String, require: true },
  tokenURI: { type: String, required: false, index: true },
  tokenJSON: { type: String, required: false },

  mediaURI: { type: String, required: false },
  mediaType: { type: String, required: false },

  minter: { type: String, required: true, index: true },
  owner: { type: String, reuqired: false, index: true }, // TODO: change this to required
  creationTxHash: { type: String, required: true, index: true },
  block: { type: blockConciseSchema, required: true },

  status: { type: String, required: true, default: 'new' }, // new - init state, cached - uploaded media to s3, invalid - tokenURI/mediaURI is not valid for download
});

schema.index({ address: 1, tokenId: 1, owner: 1 }, { unique: true });
schema.index({ address: 1, tokenId: 1, creationTxHash: 1 });
schema.index({ 'block.number': 1 });
schema.index({ 'block.number': -1 });

schema.set('toJSON', {
  transform: (obj, ret, options) => {
    delete ret.__v;
    delete ret._id;
    // delete ret.code;
    return ret;
  },
});

const model = mongoose.model<NFT & mongoose.Document>('NFT', schema, 'nft');

export default model;

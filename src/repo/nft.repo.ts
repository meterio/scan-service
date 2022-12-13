import { NFT } from '../model/nft.interface';
import nftModel from '../model/nft.model';
import { formalizePageAndLimit } from '../utils';

export default class NFTRepo {
  private model = nftModel;

  public async findAll() {
    return this.model.find();
  }

  public async findInvalid() {
    return this.model.find({ valid: false });
  }

  public async findByTokenId(address: string, tokenId: string) {
    return this.model.find({ address: address.toLowerCase(), tokenId });
  }

  public async findByTokenIds(address: string, tokenIds: string[]) {
    return this.model.find({ address: address.toLowerCase(), tokenId: { $in: tokenIds } });
  }

  public async findByAddress(address: string) {
    return this.model.find({ address: address.toLowerCase() });
  }

  public async countByAddress(address: string) {
    return this.model.count({ address: address.toLowerCase() });
  }

  public async findByOwner(owner: string) {
    return this.model.find({ owner: owner.toLowerCase() });
  }

  public async countByOwner(owner: string) {
    return this.model.count({ owner: owner.toLowerCase() });
  }

  public async findByMinter(minter: string) {
    return this.model.find({ minter: minter.toLowerCase() });
  }

  public async countByMinter(minter: string) {
    return this.model.count({ minter: minter.toLowerCase() });
  }

  public async findByIDWithOwner(address: string, tokenId: string, owner: string) {
    return this.model.findOne({ address: address.toLowerCase(), tokenId, owner: owner.toLowerCase() });
  }

  public async findByIDWithTxHash(address: string, tokenId: string, creationTxHash: string) {
    return this.model.findOne({
      address: address.toLowerCase(),
      tokenId,
      creationTxHash: creationTxHash.toLowerCase(),
    });
  }

  public async create(nft: NFT) {
    return this.model.create(nft);
  }

  public async bulkInsert(...nfts: NFT[]) {
    return this.model.create(nfts);
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'block.number': { $gt: blockNum } });
  }

  public async updateInfo(address: string, tokenId: string, tokenJSON: string, mediaType: string, mediaURI: string) {
    return this.model.updateOne(
      { address: address.toLowerCase(), tokenId },
      { $set: { tokenJSON, mediaType, mediaURI } }
    );
  }

  public async updateStatus(address: string, tokenId: string, status: string) {
    return this.model.updateOne({ address: address.toLowerCase(), tokenId }, { $set: { status } });
  }

  // paginates
  private async paginate(query: any, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count(query);
    const result = await this.model
      .find(query)
      .sort({ tokenId: 1 })
      .limit(limit)
      .skip(limit * page);

    return { count, result };
  }

  public async paginateByAddressGroupByHolder(address: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.aggregate([
      { $match: { address: address.toLowerCase() } },
      { $group: { _id: '$owner' } },
      { $count: 'count' },
    ]);
    const result = await this.model.aggregate([
      { $match: { address: address.toLowerCase() } },
      { $sort: { tokenId: 1 } },
      {
        $group: {
          _id: '$owner',
          type: { $first: '$type' },
          owner: { $first: '$owner' },
          tokens: {
            $push: {
              id: '$tokenId',
              val: '$value',
              uri: '$tokenURI',
              json: '$tokenJSON',
              mediaUrl: '$mediaURI',
              mediaType: '$mediaType',
              minter: '$minter',
              createTxHash: '$creationTxHash',
              createBlockNum: '$block.number',
              createTime: '$block.timestamp',
            },
          },
        },
      },
      { $skip: limit * page },
      { $limit: limit },
    ]);
    return { count: count[0] ? count[0]['count'] : 0, result };
  }

  public async paginateByAddress(address: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.aggregate([
      { $match: { address: address.toLowerCase() } },
      { $group: { _id: '$owner' } },
      { $count: 'count' },
    ]);
    const result = await this.model.aggregate([
      { $match: { address: address.toLowerCase() } },
      { $sort: { tokenId: 1 } },
      { $skip: limit * page },
      { $limit: limit },
    ]);
    return { count: count[0] ? count[0]['count'] : 0, result };
  }

  public async paginateByOwnerGroupByToken(owner: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.aggregate([
      { $match: { owner: owner.toLowerCase() } },
      { $group: { _id: '$address' } },
      { $count: 'count' },
    ]);
    const result = await this.model.aggregate([
      { $match: { owner: owner.toLowerCase() } },
      { $sort: { tokenId: 1 } },
      {
        $group: {
          _id: '$address',
          type: { $first: '$type' },
          address: { $first: '$address' },
          tokens: {
            $push: {
              id: '$tokenId',
              val: '$value',
              uri: '$tokenURI',
              json: '$tokenJSON',
              mediaUrl: '$mediaURI',
              mediaType: '$mediaType',
              minter: '$minter',
              createTxHash: '$creationTxHash',
              createBlockNum: '$block.number',
              createTime: '$block.timestamp',
            },
          },
        },
      },
      { $skip: limit * page },
      { $limit: limit },
      {
        $lookup: { from: 'contract', localField: 'address', foreignField: 'address', as: 'contract' },
      },
      {
        $addFields: {
          contract: {
            $cond: { if: { $eq: [{ $size: '$contract' }, 0] }, then: null, else: { $arrayElemAt: ['$contract', 0] } },
          },
        },
      },
    ]);
    return { count: count[0] ? count[0]['count'] : 0, result };
  }

  public async findByTypeInRange(type: string, start: number, end: number) {
    return this.model.find({
      type, // ERC721, ERC1155
      'block.number': { $gte: start, $lt: end },
    });
  }
  public async findInRange(start: number, end: number) {
    return this.model.find({
      'block.number': { $gte: start, $lt: end },
    });
  }

  public async paginateInRange(fromNum: number, toNum: number, pageNum?: number, limitNum?: number) {
    const query = { 'block.number': { $gte: fromNum, $lte: toNum } };
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count(query);
    const result = await this.model
      .find(query)
      // .sort({ 'block.number': 1 })
      .limit(limit)
      .skip(limit * page);

    return { count, result };
  }
}

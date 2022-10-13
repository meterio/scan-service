import BigNumber from 'bignumber.js';

import { BlockConcise } from '../model/blockConcise.interface';
import tokenBalanceModel from '../model/tokenBalance.model';
import { formalizePageAndLimit } from '../utils';
import { NFTBalance } from '../model/tokenBalance.interface';

export default class TokenBalanceRepo {
  private model = tokenBalanceModel;

  public async findAll() {
    return this.model.find();
  }

  public async findIncorrect() {
    return this.model.find({
      $or: [{ balance: /^-[0-9]+/ }],
    });
  }

  public async findByID(address: string, tokenAddress: string) {
    return this.model.findOne({ address: address.toLowerCase(), tokenAddress: tokenAddress.toLowerCase() });
  }

  /*
  db.tokenBalance.aggregate([
    { $match: { address: '0x62affad3937bc2a3d314b65ee04aad0c00179768' } },
    { $lookup: { from: 'tokenProfile', localField: 'tokenAddress', foreignField: 'address', as: 'profile' } },
    { $project: { profile: { $arrayElemAt: ['$profile', 0] }, address:1, tokenAddress:1 } },
  ])
  */

  // public async aggregate(address: string) {
  //   return this.model.aggregate([
  //     { $match: { address } },
  //     { $lookup: { from: 'token_profile', localField: 'tokenAddress', foreignField: 'address', as: 'profile' } },
  //     { $project: { profile: { $arrayElemAt: ['profile', 0] } } },
  //   ]);
  // }

  public async findByAddress(address: string, tokenAddress: string) {
    return this.model.findOne({
      address: address.toLowerCase(),
      tokenAddress: tokenAddress.toLowerCase(),
    });
  }

  public async findAllByAddress(address: string) {
    return this.model.find({ address: address.toLowerCase() });
  }

  public async findByTokenAddress(tokenAddress: string) {
    return this.model.find({
      tokenAddress: tokenAddress.toLowerCase(),
    });
  }

  public async countByTokenAddress(tokenAddress: string) {
    return this.model.count({
      tokenAddress: tokenAddress.toLowerCase(),
    });
  }

  public async countByAddress(address: string) {
    return this.model.count({ address: address.toLowerCase() });
  }

  public async countERC20ByAddress(address: string) {
    const resCount = await this.model.aggregate([
      { $match: { address: address.toLowerCase(), balance: { $ne: '0' } } },
      {
        $lookup: {
          from: 'contract',
          localField: 'tokenAddress',
          foreignField: 'address',
          as: 'token',
        },
      },
      { $unwind: '$token' },
      { $match: { 'token.type': 'ERC20' } },
      { $count: 'count' },
    ]);

    return resCount[0] ? resCount[0]['count'] : 0;
  }

  public async countNFTByAddress(address: string) {
    const resCount = await this.model.aggregate([
      { $match: { address: address.toLowerCase(), nftBalances: { $ne: [] } } },
      {
        $lookup: {
          from: 'contract',
          localField: 'tokenAddress',
          foreignField: 'address',
          as: 'token',
        },
      },
      { $unwind: '$token' },
      {
        $match: {
          $or: [{ 'token.type': 'ERC721' }, { 'token.type': 'ERC1155' }],
        },
      },
      {
        $group: {
          _id: '$address',
          count: { $sum: { $size: '$nftBalances' } },
        },
      },
    ]);

    return resCount[0] ? resCount[0]['count'] : 0;
  }

  public async exist(address: string, tokenAddress: string) {
    return this.model.exists({
      address: address.toLowerCase(),
      tokenAddress: tokenAddress.toLowerCase(),
    });
  }

  public async create(address: string, tokenAddress: string, firstSeen: BlockConcise) {
    return this.model.create({
      address: address.toLowerCase(),
      tokenAddress: tokenAddress.toLowerCase(),
      balance: new BigNumber(0),
      nftBalances: [],
      firstSeen,
      lastUpdate: firstSeen,
      rank: 99999999,
    });
  }

  public async findAfter(blockNum: number) {
    return this.model.find({ 'block.number': { $gt: blockNum } });
  }

  public async findLastUpdateAfter(blockNum: number) {
    return this.model.find({ 'lastUpdate.number': { $gt: blockNum } });
  }

  // paginates
  private async paginate(query: any, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count(query);
    const result = await this.model
      .find(query)
      .sort({ 'block.number': -1 })
      .limit(limit)
      .skip(limit * page);
    return { count, result };
  }

  public async paginateByTokenAddress(tokenAddress: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count({ tokenAddress: tokenAddress.toLowerCase() });
    const result = await this.model.aggregate([
      { $match: { tokenAddress: tokenAddress.toLowerCase() } },
      { $addFields: { balLen: { $strLenCP: '$balance' } } },
      { $sort: { balLen: -1, balance: -1 } },
      { $skip: limit * page },
      { $limit: limit },
    ]);
    return { count, result };
  }

  // public async paginateByAddress(address: string, pageNum?: number, limitNum?: number) {
  //   return this.paginate({ address: address.toLowerCase() }, pageNum, limitNum);
  // }

  public async paginateByAddress(address: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count({ address: address.toLowerCase() });
    const result = await this.model.aggregate([
      {
        $match: { address: address.toLowerCase() },
      },
      { $skip: limit * page },
      { $limit: limit },
      {
        $lookup: { from: 'contract', localField: 'tokenAddress', foreignField: 'address', as: 'token' },
      },
      {
        $addFields: {
          token: {
            $cond: { if: { $eq: [{ $size: '$token' }, 0] }, then: null, else: { $arrayElemAt: ['$token', 0] } },
          },
        },
      },
    ]);
    return { count, result };
  }

  public async paginateERC20ByAddress(address: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const resCount = await this.model.aggregate([
      { $match: { address: address.toLowerCase(), balance: { $ne: '0' } } },
      {
        $lookup: {
          from: 'contract',
          localField: 'tokenAddress',
          foreignField: 'address',
          as: 'token',
        },
      },
      { $unwind: '$token' },
      { $match: { 'token.type': 'ERC20' } },
      { $count: 'count' },
    ]);
    const result = await this.model.aggregate([
      {
        $match: { address: address.toLowerCase(), balance: { $ne: '0' } },
      },
      { $skip: limit * page },
      { $limit: limit },
      {
        $lookup: { from: 'contract', localField: 'tokenAddress', foreignField: 'address', as: 'token' },
      },
      { $unwind: '$token' },
      { $match: { 'token.type': 'ERC20' } },
      { $addFields: { balLen: { $add: [{ $subtract: [{ $strLenCP: '$balance' }, '$token.decimals'] }, 18] } } },
      { $sort: { balLen: -1, balance: -1 } },
    ]);
    return { count: resCount[0] ? resCount[0]['count'] : 0, result };
  }

  public async paginateNFTByAddress(address: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const resCount = await this.model.aggregate([
      { $match: { address: address.toLowerCase(), nftBalances: { $ne: [] } } },
      {
        $lookup: {
          from: 'contract',
          localField: 'tokenAddress',
          foreignField: 'address',
          as: 'token',
        },
      },
      { $unwind: '$token' },
      {
        $match: {
          $or: [{ 'token.type': 'ERC721' }, { 'token.type': 'ERC1155' }],
        },
      },
      { $count: 'count' },
    ]);
    const result = await this.model.aggregate([
      {
        $match: { address: address.toLowerCase(), nftBalances: { $ne: [] } },
      },
      { $skip: limit * page },
      { $limit: limit },
      {
        $lookup: { from: 'contract', localField: 'tokenAddress', foreignField: 'address', as: 'token' },
      },
      { $unwind: '$token' },
      {
        $match: {
          $or: [{ 'token.type': 'ERC721' }, { 'token.type': 'ERC1155' }],
        },
      },
    ]);
    return { count: resCount[0] ? resCount[0]['count'] : 0, result };
  }

  public async updateNFTBalances(address: string, tokenAddress: string, nftBalances: NFTBalance[]) {
    return this.model.updateOne({ address, tokenAddress }, { $set: { nftBalances } });
  }

  public async deleteByID(address: string, tokenAddress: string) {
    return this.model.deleteOne({
      address: address.toLowerCase(),
      tokenAddress: tokenAddress.toLowerCase(),
    });
  }
}

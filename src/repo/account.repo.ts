import BigNumber from 'bignumber.js';

import accountModel from '../model/account.model';
import { BlockConcise } from '../model/blockConcise.interface';
import { formalizePageAndLimit } from '../utils';

export default class AccountRepo {
  private model = accountModel;

  public async findAll() {
    return this.model.find();
  }

  public async findByAddress(address: string) {
    return this.model.findOne({
      address: address.toLowerCase(),
    });
  }

  public async count() {
    return this.model.estimatedDocumentCount();
  }

  public async countNonZero() {
    return this.model.count({
      $or: [{ mtrBalance: { $ne: new BigNumber('0') } }, { mtrgBalance: { $ne: new BigNumber('0') } }],
    });
  }

  public async findKnownAccounts() {
    return this.model.find({ name: { $exists: true } });
  }

  public async findByAddressList(addressList: string[]) {
    return this.model.find({
      address: { $in: addressList },
    });
  }

  public async findByNameList(nameList: string[]) {
    return this.model.find({
      name: { $in: nameList },
    });
  }

  public async findExistenName() {
    return this.model.find({
      name: { $ne: null },
    });
  }

  public async findByFuzzyName(fuzzyName: string) {
    return this.model.find({
      $or: [
        { name: { $regex: new RegExp(`.*${fuzzyName}.*`, 'i') } },
        { alias: { $regex: new RegExp(`.*${fuzzyName}.*`, 'i') } },
      ],
    });
  }

  public async findByName(name: string) {
    return this.model.find({ name: { $regex: `^${name}$`, $options: 'i' } });
  }

  public async create(name: string, address: string, firstSeen: BlockConcise) {
    return this.model.create({
      name: name,
      address: address.toLowerCase(),

      mtrBalance: new BigNumber('0'),
      mtrgBalance: new BigNumber('0'),
      mtrBounded: new BigNumber('0'),
      mtrgBounded: new BigNumber('0'),

      mtrRank: 99999999,
      mtrgRank: 99999999,

      firstSeen,
      lastUpdate: firstSeen,
    });
  }

  public async updateMTRRank(address: string, mtrRank: number) {
    return this.model.updateOne(
      { address: address.toLowerCase() },
      {
        $set: {
          mtrRank,
        },
      }
    );
  }

  public async updateMTRGRank(address: string, mtrgRank: number) {
    return this.model.updateOne(
      { address: address.toLowerCase() },
      {
        $set: {
          mtrgRank,
        },
      }
    );
  }

  public async updateName(address: string, name: string, alias: string[]) {
    return this.model.updateOne(
      { address: address.toLowerCase() },
      {
        $set: {
          name,
          alias,
        },
      }
    );
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'firstSeen.number': { $gt: blockNum } });
  }

  public async findLastUpdateAfter(blockNum: number) {
    return this.model.find({ 'lastUpdate.number': { $gt: blockNum } });
  }

  public async findIncorrect() {
    return this.model.find({
      $or: [
        { mtrBalance: /^-[0-9]+/ },
        { mtrgBalance: /^-[0-9]+/ },
        { mtrBounded: /^-[0-9]+/ },
        { mtrgBounded: /^-[0-9]+/ },
      ],
    });
  }

  // paginates
  public async paginateTopMTRAccounts(pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.estimatedDocumentCount();
    const result = await this.model
      .find()
      .sort({ mtrRank: 1 })
      .limit(limit)
      .skip(limit * page);
    return { count, result };
  }

  public async paginateTopMTRGAccounts(pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.estimatedDocumentCount();
    const result = await this.model
      .find()
      .sort({ mtrgRank: 1 })
      .limit(limit)
      .skip(limit * page);
    return { count, result };
  }

  public async distinctAddress() {
    return this.model.distinct('address');
  }
}

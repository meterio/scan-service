import { Document } from 'mongoose';

import { RECENT_WINDOW } from '../const';
import { BlockType } from '../const';
import { Block } from '../model/block.interface';
import blockModel from '../model/block.model';
import { formalizePageAndLimit } from '../utils';

export default class BlockRepo {
  private model = blockModel;
  public async getBestBlock() {
    return this.model.findOne({}).sort({ timestamp: -1 });
  }

  public async findAll() {
    return this.model.find();
  }

  public async findRecent() {
    return this.model.find().sort({ timestamp: -1 }).limit(RECENT_WINDOW);
  }

  public async count() {
    return this.model.estimatedDocumentCount();
  }

  public async findByNumberList(nums: number[]) {
    return this.model.find({
      number: { $in: nums },
    });
  }

  public async findByNumberInRange(start: number, end: number) {
    return this.model.find({
      number: { $gte: start, $lte: end },
    });
  }

  public async findKBlocksByEpochs(epochs: number[]) {
    return this.model.find({
      blockType: BlockType.KBlock,
      epoch: { $in: epochs },
    });
  }

  public async findByNumber(num: number) {
    return this.model.findOne({
      number: num,
    });
  }

  public async findBlockWithTxFrom(num: number) {
    // find block with tx in (fromNu, toNum] range
    return this.model
      .findOne({
        number: { $gt: num },
        txCount: { $gt: 0 },
      })
      .sort({ number: 1 });
  }

  public async findFutureBlocks(num: number): Promise<(Block & Document)[]> {
    return this.model.find({ number: { $gt: num } });
  }

  public async findByHash(hash: string) {
    return this.model.findOne({
      hash,
    });
  }

  public async countKBlocks() {
    return this.model.count({ type: BlockType.KBlock });
  }

  public async create(block: Block) {
    return this.model.create(block);
  }

  public async bulkInsert(...block: Block[]) {
    return this.model.create(block);
  }

  public async delete(hash: string) {
    return this.model.deleteOne({ hash });
  }

  public async findInTimeRange(start: number, end: number) {
    return this.model.find({ timestamp: { $gte: start, $lte: end } });
  }

  public async findByTimestamp(timestamp: number) {
    return this.model.findOne({ timestamp });
  }

  public async findKBlocksWithoutPowBlocks(pageNum?: number, limitNum?: number) {
    const limit = 20;
    return this.model.find({ blockType: BlockType.KBlock, powBlocks: { $exists: false } }).limit(limit);
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ number: { $gt: blockNum } });
  }

  // paginates
  private async paginate(query: any, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count(query);
    const result = await this.model
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(limit * page);

    return { count, result };
  }

  public async paginateKBlocks(pageNum?: number, limitNum?: number) {
    return this.paginate({ blockType: BlockType.KBlock }, pageNum, limitNum);
  }

  public async countByBeneficiary(address: string) {
    return this.model.count({ beneficiary: address.toLowerCase() });
  }

  public async paginateByBeneficiary(address: string, pageNum?: number, limitNum?: number) {
    return this.paginate({ beneficiary: address.toLowerCase() }, pageNum, limitNum);
  }

  public async paginateAll(pageNum?: number, limitNum?: number) {
    return this.paginate({}, pageNum, limitNum);
  }

  public async findKBlockInRangeSortAsc(startNum: number, endNum: number) {
    return this.model
      .find({
        number: { $gte: startNum, $lte: endNum },
        blockType: BlockType.KBlock,
      })
      .sort({ number: 1 });
  }
}

import { LogEvent } from '../model/logEvent.interface';
import logEventModel from '../model/logEvent.model';
import { formalizePageAndLimit } from '../utils';

export default class LogEventRepo {
  private model = logEventModel;

  public async findAll() {
    return this.model.find();
  }

  public async findByTxHash(txHash: string) {
    return this.model.find({ txHash });
  }

  public async findByClause(txHash: string, clauseIndex: number) {
    return this.model.find({ txHash, clauseIndex });
  }

  public async findByBlockNum(blockNum: number) {
    return this.model.find({ 'block.number': blockNum });
  }

  public async findByTopic0InBlockRangeSortAsc(topic0: string, startNum: number, endNum: number) {
    return this.model
      .find({ 'topics.0': topic0, 'block.number': { $gte: startNum, $lte: endNum } })
      .sort({ 'block.number': 1 });
  }

  public async countByAddress(address: string) {
    return this.model.count({ address: address.toLowerCase() });
  }

  public async exist(txHash: string, clauseIndex: number, logIndex: number) {
    return this.model.exists({ txHash, clauseIndex, logIndex });
  }

  public async create(evt: LogEvent) {
    return this.model.create(evt);
  }

  public async bulkInsert(...evts: LogEvent[]) {
    return this.model.create(evts);
  }

  public async bulkUpsert(...evts: LogEvent[]) {
    for (const e of evts) {
      await this.model.findOneAndUpdate({ txHash: e.txHash, clauseIndex: e.clauseIndex, logIndex: e.logIndex }, e, {
        new: true,
        upsert: true,
        overwrite: true,
      });
    }
    return true;
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'block.number': { $gt: blockNum } });
  }

  public async findBeforeNum(blockNum: number) {
    return this.model.find({ 'block.number': { $gt: blockNum } });
  }

  public async paginateByAddress(address: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count({ address: address.toLowerCase() });
    const result = await this.model.aggregate([
      { $match: { address: address.toLowerCase() } },
      { $sort: { 'block.number': -1 } },
      { $skip: limit * page },
      { $limit: limit },
    ]);
    return { count, result };
  }

  public async paginateByFilter(
    topics0: string,
    address?: string,
    fromBlock?: number,
    pageNum?: number,
    limitNum?: number
  ) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    let query = { 'topics.0': topics0, address: address?.toLowerCase(), 'block.number': undefined };
    let blockFilter = { $gt: fromBlock };
    if (fromBlock) {
      query['block.number'] = blockFilter;
    }

    const count = await this.model.count(query);
    const result = await this.model.aggregate([
      { $match: query },
      { $sort: { 'block.number': 1 } },
      { $skip: limit * page },
      { $limit: limit },
    ]);
    return { count, result };
  }

  public async paginateOnAddressInRange(
    address: string,
    fromNum: number,
    toNum: number,
    pageNum?: number,
    limitNum?: number
  ) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    let query = { address: address?.toLowerCase(), 'block.number': { $gte: fromNum, $lte: toNum } };

    const count = await this.model.count(query);
    const result = await this.model.aggregate([
      { $match: query },
      // { $sort: { 'block.number': 1 } },
      { $skip: limit * page },
      { $limit: limit },
    ]);
    return { count, result };
  }
}

import { TxDigest } from '../model/txDigest.interface';
import txDigestModel from '../model/txDigest.model';
import { formalizePageAndLimit } from '../utils';

export default class TxDigestRepo {
  private model = txDigestModel;

  public async findAll() {
    return this.model.find();
  }

  public async findByBlockNum(blockNum: number) {
    return this.model.find({ 'block.number': blockNum });
  }

  public async findByTxHashList(...txHashs: string[]) {
    return this.model.find({ txHash: { $in: txHashs } });
  }

  public async existID(blockNum: number, txHash: string, from: string, to: string) {
    return this.model.exists({ 'block.number': blockNum, txHash, from, to });
  }

  public async create(txDigest: TxDigest) {
    return this.model.create(txDigest);
  }

  public async bulkInsert(...txDigests: TxDigest[]) {
    return this.model.create(txDigests);
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'block.number': { $gt: blockNum } });
  }

  public async countByAddress(address: string) {
    return this.model.count({ $or: [{ from: address.toLowerCase() }, { to: address.toLowerCase() }] });
  }

  // paginates
  private async paginate(query: any, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count(query);
    const result = await this.model
      .find(query)
      .sort({ 'block.number': -1, txIndex: -1 })
      .limit(limit)
      .skip(limit * page);
    return { count, result };
  }

  public async paginateAll(pageNum?: number, limitNum?: number) {
    return this.paginate({}, pageNum, limitNum);
  }

  public async paginateByAccount(addr: string, pageNum?: number, limitNum?: number) {
    return this.paginate({ $or: [{ from: addr.toLowerCase() }, { to: addr.toLowerCase() }] }, pageNum, limitNum);
  }

  public async paginateByAccountInRange(start: number, end: number, addr: string, pageNum?: number, limitNum?: number) {
    return this.paginate(
      {
        $and: [
          { 'block.timestamp': { $gte: start, $lte: end } },
          {
            $or: [{ from: addr.toLowerCase() }, { to: addr.toLowerCase() }],
          },
        ],
      },
      pageNum,
      limitNum
    );
  }

  public async findInRange(startblock: number, endblock: number) {
    return this.model.find({ 'block.number': { $gte: startblock, $lt: endblock } });
  }

  public async findInRangeWithoutTxIndex(startblock: number, endblock: number) {
    return this.model.find({ txIndex: { $exists: false }, 'block.number': { $gte: startblock, $lt: endblock } });
  }
}

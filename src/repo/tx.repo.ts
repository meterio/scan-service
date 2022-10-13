import { RECENT_WINDOW } from '../const';
import { Tx } from '../model/tx.interface';
import txModel from '../model/tx.model';
import { formalizePageAndLimit } from '../utils';

export default class TxRepo {
  private model = txModel;

  public async findAll() {
    return this.model.find();
  }

  public async findByHash(hash: string) {
    return this.model.findOne({ hash });
  }

  public async findByAccountInRange(addr: string, startblock: number, endblock: number, sort: string) {
    return this.model
      .find({
        $or: [
          { origin: addr.toLowerCase() },
          {
            'clauses.to': { $in: [addr.toLowerCase()] },
          },
        ],
        'block.number': {
          $gte: startblock,
          $lt: endblock,
        },
      })
      .sort({ 'block.number': sort === 'asc' ? 1 : -1 });
  }

  public async findByHashs(hashs: string[]) {
    return this.model.find({ hash: { $in: hashs } });
  }

  public async exist(hash: string) {
    return this.model.exists({ hash });
  }

  public async create(tx: Tx) {
    return this.model.create(tx);
  }

  public async bulkInsert(...txs: Tx[]) {
    await this.model.create(txs);
  }

  public async delete(hash: string) {
    return this.model.deleteOne({ hash });
  }

  public async findTxsAfter(blockNum: number) {
    return this.model.find({ 'block.number': { $gt: blockNum } });
  }

  public async findByOrigin(address: string) {
    return this.model.find({ origin: address });
  }

  public async findInBlockRangeSortAsc(startNum: number, endNum: number) {
    return this.model
      .find({
        'block.number': { $gte: startNum, $lte: endNum },
        outputs: { $exists: true, $not: { $size: 0 } },
      })
      .sort({ 'block.number': 1 });
  }

  public async findUserTxsInBlockRangeSortAsc(startNum: number, endNum: number) {
    return this.model
      .find({
        'block.number': { $gte: startNum, $lte: endNum },
        origin: { $ne: '0x0000000000000000000000000000000000000000' },
        outputs: { $exists: true, $not: { $size: 0 } },
      })
      .sort({ 'block.number': 1 });
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'block.number': { $gt: blockNum } });
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

  // paginates
  public async paginateAll(pageNum?: number, limitNum?: number) {
    return this.paginate({}, pageNum, limitNum);
  }

  public async paginateByAccount(addr: string, pageNum?: number, limitNum?: number) {
    return this.paginate(
      { $or: [{ origin: addr.toLowerCase() }, { 'clauses.to': { $in: [addr.toLowerCase()] } }] },
      pageNum,
      limitNum
    );
  }
}

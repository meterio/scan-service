import { InternalTx } from '../model/internalTx.interface';
import internalTxModel from '../model/internalTx.model';
import { formalizePageAndLimit } from '../utils';

export default class InternalTxRepo {
  private model = internalTxModel;

  public async findAll() {
    return this.model.find();
  }

  public async findByTxHash(txHash: string) {
    return this.model.find({ txHash });
  }

  public async findByID(txHash: string, clauseIndex: number, name: string) {
    return this.model.findOne({ txHash, clauseIndex, name });
  }

  public async findByAddress(address: string) {
    return this.model.find({ $or: [{ from: address.toLowerCase() }, { to: address.toLowerCase() }] });
  }

  public async countByAddress(address: string) {
    return this.model.count({ $or: [{ from: address.toLowerCase() }, { to: address.toLowerCase() }] });
  }

  public async exist(txHash: string, clauseIndex: number, name: string) {
    return this.model.exists({ txHash, clauseIndex, name });
  }

  public async create(internalTx: InternalTx) {
    return this.model.create(internalTx);
  }

  public async bulkInsert(...internalTxs: InternalTx[]) {
    await this.model.create(internalTxs);
  }

  public async delete(hash: string) {
    return this.model.deleteOne({ hash });
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
      .sort({ 'block.number': -1, txIndex: -1 })
      .limit(limit)
      .skip(limit * page);
    return { count, result };
  }

  public async paginateAll(pageNum?: number, limitNum?: number) {
    return this.paginate({}, pageNum, limitNum);
  }

  public async paginateByAddress(address: string, pageNum?: number, limitNum?: number) {
    return this.paginate({ $or: [{ from: address.toLowerCase() }, { to: address.toLowerCase() }] }, pageNum, limitNum);
  }
}

import { Bound, IBound } from '../model';

export class BoundRepo {
  private model = Bound;

  public async findAll() {
    return this.model.find();
  }

  public async findByOwner(owner: string) {
    return this.model.find({ owner: owner.toLowerCase() });
  }

  public async findByBlockNum(blockNum: number) {
    return this.model.find({ 'block.number': blockNum });
  }

  public async exist(txHash: string, clauseIndex: number) {
    return this.model.exists({ txHash, clauseIndex });
  }

  public async create(bound: IBound) {
    return this.model.create(bound);
  }

  public async bulkInsert(...bounds: IBound[]) {
    return this.model.create(bounds);
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'block.number': { $gt: blockNum } });
  }

  public async findBeforeNum(blockNum: number) {
    return this.model.find({ 'block.number': { $lt: blockNum } });
  }
}

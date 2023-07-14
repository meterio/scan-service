import { Unbound, IUnbound } from '../model';

export class UnboundRepo {
  private model = Unbound;

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

  public async create(unbound: IUnbound) {
    return this.model.create(unbound);
  }

  public async bulkInsert(...unbounds: IUnbound[]) {
    return this.model.create(unbounds);
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'block.number': { $gt: blockNum } });
  }

  public async findBeforeNum(blockNum: number) {
    return this.model.find({ 'block.number': { $gt: blockNum } });
  }
}

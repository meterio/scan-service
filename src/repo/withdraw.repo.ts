import { Withdraw } from '../model/withdraw.interface';
import withdrawModel from '../model/withdraw.model';

export default class WithdrawRepo {
  private model = withdrawModel;

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

  public async create(withdraw: Withdraw) {
    return this.model.create(withdraw);
  }

  public async bulkInsert(...withdraws: Withdraw[]) {
    return this.model.create(withdraws);
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'block.number': { $gt: blockNum } });
  }

  public async findBeforeNum(blockNum: number) {
    return this.model.find({ 'block.number': { $gt: blockNum } });
  }
}

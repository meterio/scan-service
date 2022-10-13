import { BlockConcise } from '../model/blockConcise.interface';
import { Committee } from '../model/committee.interface';
import committeeModel from '../model/committee.model';
import { formalizePageAndLimit } from '../utils';
export default class CommitteeRepo {
  private committee = committeeModel;

  public async findCurrent() {
    return this.committee.findOne({ epoch: -1 });
  }
  public async findByEpoch(epoch: number) {
    return this.committee.findOne({ epoch });
  }

  public async create(committee: Committee) {
    return this.committee.create(committee);
  }

  public async delete(hash: string) {
    return this.committee.deleteOne({ hash });
  }

  public async updateEndBlock(epoch: number, endBlock: BlockConcise) {
    return this.committee.updateOne({ epoch }, { $set: { endBlock } });
  }

  public async deleteAfter(blockNum: number) {
    return this.committee.deleteMany({ 'startBlock.number': { $gt: blockNum } });
  }

  public async bulkInsert(...committees: Committee[]) {
    return this.committee.create(committees);
  }

  // paginates
  public async paginateAll(pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.committee.count();
    const result = await this.committee
      .find({})
      .sort({ epoch: -1 })
      .limit(limit)
      .skip(limit * page);
    return { count, result };
  }
}

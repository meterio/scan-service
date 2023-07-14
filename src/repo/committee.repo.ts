import { Committee, ICommittee, IBlockConcise } from '../model';
import { formalizePageAndLimit } from '../utils';
export class CommitteeRepo {
  private committee = Committee;

  public async findCurrent() {
    return this.committee.findOne({ epoch: -1 });
  }
  public async findByEpoch(epoch: number) {
    return this.committee.findOne({ epoch });
  }

  public async create(committee: ICommittee) {
    return this.committee.create(committee);
  }

  public async delete(hash: string) {
    return this.committee.deleteOne({ hash });
  }

  public async updateEndBlock(epoch: number, endBlock: IBlockConcise) {
    return this.committee.updateOne({ epoch }, { $set: { endBlock } });
  }

  public async deleteAfter(blockNum: number) {
    return this.committee.deleteMany({ 'startBlock.number': { $gt: blockNum } });
  }

  public async bulkInsert(...committees: ICommittee[]) {
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

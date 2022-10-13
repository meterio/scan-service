import { EpochRewardSummary } from '../model/epochRewardSummary.interface';
import EpochRewardSummaryModel from '../model/epochRewardSummary.model';
import { formalizePageAndLimit } from '../utils';

export default class EpochRewardSummaryRepo {
  private model = EpochRewardSummaryModel;

  public async findAll() {
    return this.model.find({}).sort({ createTime: -1 });
  }

  public async findByEpoch(epoch: number) {
    return this.model.findOne({ epoch });
  }

  public async existEpoch(epoch: number) {
    return this.model.exists({ epoch });
  }

  public async create(epochRewardSummary: EpochRewardSummary) {
    return this.model.create(epochRewardSummary);
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ blockNum: { $gt: blockNum } });
  }

  // paginates
  public async paginateAll(pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.estimatedDocumentCount();
    const result = await this.model
      .find({})
      .sort({ epoch: -1 })
      .limit(limit)
      .skip(limit * page);
    return { count, result };
  }
}

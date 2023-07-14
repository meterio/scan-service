import { Bucket, IBucket } from '../model';
import { formalizePageAndLimit } from '../utils';

export class BucketRepo {
  private model = Bucket;

  public async findAll() {
    return this.model.find({});
  }

  public async countByAccount(address: string) {
    return this.model.count({
      owner: address.toLowerCase(),
    });
  }

  public async findByAccount(address: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    return this.model
      .find({
        owner: address.toLowerCase(),
      })
      .sort({ createTime: -1 })
      .limit(limit)
      .skip(limit * page);
  }

  public async findByCandidate(address: string) {
    return this.model.find({ candidate: address, unbounded: false });
  }

  public async findByID(id: string) {
    return this.model.findOne({ id });
  }

  public async findByIDs(ids: string) {
    return this.model.find({ id: { $in: ids } });
  }

  public async countByAddress(address: string) {
    return this.model.count({ owner: address.toLowerCase() });
  }

  public async create(bucket: IBucket) {
    return this.model.create(bucket);
  }

  public async bulkInsert(...models: IBucket[]) {
    return this.model.create(models);
  }

  public async bulkUpsert(...bkts: any[]) {
    for (const b of bkts) {
      console.log('bucket: ', b);
      const updated = await this.model.findOneAndUpdate({ id: b.id }, b, {
        new: true,
        upsert: true,
        overwrite: true,
      });
      console.log('updated bucket: ', updated);
    }
    return true;
  }

  public async deleteAll() {
    return this.model.deleteMany({});
  }

  public async deleteAfterTimestamp(ts: number) {
    return this.model.deleteMany({ createTime: { $gt: ts } });
  }
}

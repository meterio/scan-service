import { Head, IHead } from '../model';

export class HeadRepo {
  private model = Head;

  public async exists(key: string) {
    return this.model.exists({ key });
  }

  public async findAll() {
    return this.model.find({});
  }

  public async findByKey(key: string) {
    return this.model.findOne({ key });
  }

  public async create(key: string, num: number, hash: string) {
    return this.model.create({ key, num, hash });
  }

  public async update(key: string, num: number, hash: string) {
    return this.model.updateOne({ key }, { $set: { num, hash } });
  }
}

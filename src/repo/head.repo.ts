import headModel from '../model/head.model';

export default class HeadRepo {
  private model = headModel;

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

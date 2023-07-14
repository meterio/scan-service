import { MetricType } from '../const';
import { Metric } from '../model';

export class MetricRepo {
  private model = Metric;

  public async findByKey(key: string) {
    return this.model.findOne({ key });
  }

  public async findByKeys(keys: string[]) {
    return this.model.find({ key: { $in: keys } });
  }

  public async exist(key: string) {
    return this.model.exists({ key });
  }

  public async create(key: string, value: string, type: MetricType) {
    return this.model.create({ key, value, type });
  }

  public async update(key: string, value: string) {
    return this.model.updateOne({ key }, { $set: { value } });
  }
}

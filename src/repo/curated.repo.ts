import { Curated } from '../model/curated.interface';
import curatedModel from '../model/curated.model';
import { Network } from '../const';

export default class CuratedRepo {
  private model = curatedModel;

  public async findAll() {
    return this.model.find();
  }

  public async create(curated: Curated) {
    return this.model.create(curated);
  }

  public async bulkInsert(...curated: Curated[]) {
    return this.model.create(curated);
  }

  public async deleteByID(address: string) {
    return this.model.deleteOne({ address });
  }
}

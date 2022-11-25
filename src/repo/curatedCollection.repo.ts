import { CuratedCollection } from '../model/curatedCollection.interface';
import curatedCollectionModel from '../model/curatedCollection.model';
import { Network } from '../const';

export default class CuratedCollectionRepo {
  private model = curatedCollectionModel;

  public async findAll() {
    return this.model.find();
  }

  public async findAllByNetwork(network: Network) {
    return this.model.find({ network });
  }

  public async create(curatedCollection: CuratedCollection) {
    return this.model.create(curatedCollection);
  }

  public async bulkInsert(...curatedCollection: CuratedCollection[]) {
    return this.model.create(curatedCollection);
  }
}

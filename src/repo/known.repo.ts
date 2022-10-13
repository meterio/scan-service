import { Known } from '../model/known.interface';
import knownModel from '../model/known.model';

export default class KnownRepo {
  private model = knownModel;
  public async findAll() {
    return this.model.find();
  }

  public async exist(ecdsaPK: string) {
    return this.model.exists({ ecdsaPK });
  }

  public async findByECDSAPK(ecdsaPK: string) {
    return this.model.findOne({ ecdsaPK });
  }

  public async findByKeyList(keys: string[]) {
    return this.model.find({ ecdsaPK: { $in: keys } });
  }

  public async create(known: Known) {
    return this.model.create(known);
  }

  public async delete(hash: string) {
    return this.model.deleteOne({ hash });
  }
}

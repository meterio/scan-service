import { PowTx } from '../model/powTx.interface';
import powTxModel from '../model/powTx.model';

export default class PowTxRepo {
  private model = powTxModel;

  public async findAll() {
    return this.model.find();
  }

  public async findByHash(hash: string) {
    return this.model.findOne({
      hash,
    });
  }

  public async create(powPowTx: PowTx) {
    return this.model.create(powPowTx);
  }

  public async delete(hash: string) {
    return this.model.deleteOne({ hash });
  }
}

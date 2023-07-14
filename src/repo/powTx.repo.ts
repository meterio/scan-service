import { PowTx, IPowTx } from '../model';

export class PowTxRepo {
  private model = PowTx;

  public async findAll() {
    return this.model.find();
  }

  public async findByHash(hash: string) {
    return this.model.findOne({
      hash,
    });
  }

  public async create(powPowTx: IPowTx) {
    return this.model.create(powPowTx);
  }

  public async delete(hash: string) {
    return this.model.deleteOne({ hash });
  }
}

import model from '../model/abiFragment.model';
import { ABIFragment } from '../model/abiFragment.interface';

export class ABIFragmentRepo {
  private model = model;

  public async findAllEvents() {
    return this.model.find({ type: 'event' });
  }

  public async findAllFunctions() {
    return this.model.find({ type: 'function' });
  }

  public async findEventBySignature(signature: string) {
    return this.model.find({ type: 'event', signature });
  }

  public async findFunctionBySignature(signature: string) {
    return this.model.find({ type: 'function', signature });
  }

  public async findBySignature(signature: string) {
    return this.model.findOne({ signature });
  }

  public async findBySignatureList(...signatures: string[]) {
    return this.model.find({ signature: { $in: signatures } });
  }

  public async create(abiFragment: ABIFragment) {
    return this.model.create(abiFragment);
  }

  public async bulkUpsert(...abiFragments: ABIFragment[]) {
    for (const f of abiFragments) {
      await this.model.findOneAndUpdate({ abi: f.abi }, f, { new: true, upsert: true, overwrite: true });
    }
    return true;
  }

  public async bulkInsert(...abiFragment: ABIFragment[]) {
    return this.model.create(abiFragment);
  }
}

export default ABIFragmentRepo;

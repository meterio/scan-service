import { ContractFile } from '../model/contractFile.interface';
import contractFileModel from '../model/contractFile.model';

export default class ContractFileRepo {
  private model = contractFileModel;

  public async findAll() {
    return this.model.find();
  }

  public async findByContract(address: string) {
    return this.model.findOne({ address: address.toLowerCase() });
  }

  public async findAllByContract(address: string) {
    return this.model.find({ address: address.toLowerCase() });
  }

  public async findMetaDataByContract(address: string) {
    return this.model.findOne({ address: address.toLowerCase(), name: 'metadata.json' });
  }

  public async deleteByContract(address: string) {
    return this.model.deleteOne({ address: address.toLowerCase() });
  }

  public async create(contractFile: ContractFile) {
    return this.model.create(contractFile);
  }

  public async bulkUpsert(...contractFiles: ContractFile[]) {
    for (const f of contractFiles) {
      console.log(`name: ${f.name} path: ${f.path}`);
      await this.model.findOneAndUpdate({ path: f.path }, f, { new: true, upsert: true, overwrite: true });
      console.log('saved');
    }
    return true;
  }

  public async bulkInsert(...contractFiles: ContractFile[]) {
    return this.model.create(contractFiles);
  }
}

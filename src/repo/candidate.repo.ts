import { Candidate } from '../model/candidate.interface';
import model from '../model/candidate.model';

export default class CandidateRepo {
  private model = model;
  public async findAll() {
    return this.model.find();
  }

  public async existID(epoch: number, pubKey: string) {
    return this.model.exists({ epoch, pubKey });
  }

  public async findByEpoch(epoch: number) {
    return this.model.find({ epoch });
  }

  public async create(candidate: Candidate) {
    return this.model.create(candidate);
  }

  public async deleteByID(epoch: number, pubKey: string) {
    return this.model.deleteOne({ epoch, pubKey });
  }

  public async bulkInsert(...cans: Candidate[]) {
    return this.model.create(cans);
  }

  public async bulkUpsert(...cans: Candidate[]) {
    for (const c of cans) {
      await this.model.findOneAndUpdate({ epoch: c.epoch, pubKey: c.pubKey }, c, {
        new: true,
        upsert: true,
        overwrite: true,
      });
    }
    return true;
  }
}

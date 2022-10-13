import { RECENT_WINDOW } from '../const';
import { PowBlock } from '../model/powBlock.interface';
import powBlockModel from '../model/powBlock.model';

export default class PowBlockRepo {
  private model = powBlockModel;

  public async getBestBlock() {
    return this.model.findOne({}).sort({ height: -1 });
  }

  public async findAll() {
    return this.model.find();
  }

  public async findRecent() {
    return this.model.find().sort({ time: -1 }).limit(RECENT_WINDOW);
  }

  public async findByHeight(num: number) {
    return this.model.findOne({
      height: num,
    });
  }

  public async findByHash(hash: string) {
    return this.model.findOne({
      hash,
    });
  }

  public async findFutureBlocks(num: number) {
    return this.model.find({ height: { $gt: num } });
  }

  public async create(powBlock: PowBlock) {
    return this.model.create(powBlock);
  }

  public async delete(hash: string) {
    return this.model.deleteOne({ hash });
  }
}

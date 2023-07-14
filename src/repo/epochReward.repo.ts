import BigNumber from 'bignumber.js';
import { EpochReward, IEpochReward } from '../model';

export class EpochRewardRepo {
  private model = EpochReward;

  public async findAll() {
    return this.model.find({}).sort({ createTime: -1 });
  }

  public async findByEpoch(epoch: number) {
    return this.model.find({ epoch });
  }

  public async existID(epoch: number) {
    return this.model.exists({ epoch });
  }

  public async create(epochReward: IEpochReward) {
    return this.model.create(epochReward);
  }

  public async findByBid(epoch: number, blockNum: number, address: string, amount: BigNumber) {
    return this.model.findOne({ epoch, blockNum, address, amount });
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ blockNum: { $gt: blockNum } });
  }
}

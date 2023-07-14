import { ValidatorReward, IValidatorReward } from '../model';

export class ValidatorRewardRepo {
  private model = ValidatorReward;

  public async findAll() {
    return this.model.find({}).sort({ createTime: -1 });
  }

  public async findByEpoch(epoch: number) {
    return this.model.findOne({ epoch });
  }

  public async existEpoch(epoch: number) {
    return this.model.exists({ epoch });
  }

  public async create(validatorReward: IValidatorReward) {
    return this.model.create(validatorReward);
  }
}

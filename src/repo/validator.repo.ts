import BigNumber from 'bignumber.js';
import { ValidatorStatus } from '../const';
import { Validator } from '../model/validator.interface';
import validatorModel from '../model/validator.model';
import { formalizePageAndLimit } from '../utils';

export default class ValidatorRepo {
  private model = validatorModel;

  public async findAll() {
    return this.model.find({});
  }

  public async countAll() {
    return this.model.count();
  }

  public async findByAccount(address: string) {
    return this.model.find({
      address: address.toLowerCase(),
    });
  }

  public async findByAddress(address: string) {
    return this.model.findOne({ address: address.toLowerCase() });
  }

  public async findByPubKey(pubKey: string) {
    return this.model.findOne({ pubKey });
  }

  public async findByECDSAPubKey(ecdsaKey: string) {
    const key = ecdsaKey.replace('+', '[+]').replace('/', '[/]').replace('=', '[=]');
    return this.model.findOne({
      pubKey: { $regex: new RegExp(`^${key}.*$`) },
    });
  }

  public async countByStatus(status: ValidatorStatus) {
    return this.model.count({ status });
  }

  public async bulkInsert(...models: Validator[]) {
    return this.model.create(models);
  }

  public async deleteAll() {
    return this.model.deleteMany({});
  }

  public async emptyPenaltyPoints() {
    return this.model.updateMany(
      {
        status: { $in: [ValidatorStatus.CANDIDATE, ValidatorStatus.DELEGATE] },
      },
      { $set: { totalPoints: 0 } }
    );
  }

  public async getCandidateTotalStaked() {
    const votes = await this.model.find(
      {
        status: { $in: [ValidatorStatus.CANDIDATE, ValidatorStatus.DELEGATE] },
      },
      { totalVotes: true }
    );
    let total = new BigNumber(0);
    for (const v of votes) {
      total = total.plus(v.totalVotes);
    }
    return total.toFixed();
  }

  public async getDelegateTotalStaked() {
    const votes = await this.model.find({ status: ValidatorStatus.DELEGATE }, { votingPower: true });
    let total = new BigNumber(0);
    for (const v of votes) {
      total = total.plus(v.votingPower);
    }
    return total.toFixed();
  }
  private async paginateByFilter(
    filter: string,
    status: ValidatorStatus[],
    pageNum?: number,
    limitNum?: number,
    sort?: {
      sortBy: 'totalVotes' | 'commission' | 'totalPoints' | 'votingPower' | 'jailedTime' | 'bailAmount';
      order: 'asc' | 'desc';
    }
  ) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const query = {
      $or: [
        { name: { $regex: new RegExp(`.*${filter}.*`, 'i') } },
        { address: { $regex: new RegExp(`.*${filter}.*`, 'i') } },
      ],
      status: { $in: status },
    };
    const count = await this.model.count(query);

    let criteria: any[] = [
      {
        $match: {
          ...query,
          status: { $in: status.map((s) => ValidatorStatus[s]) },
        },
      },
    ];
    const { sortBy, order } = sort;

    const orderNum = order === 'asc' ? 1 : -1;
    let sortObj = { [sortBy]: orderNum };
    if (['totalVotes', 'votingPower'].includes(sortBy)) {
      criteria.push({ $addFields: { balLen: { $strLenCP: '$' + sortBy } } });
      sortObj = { balLen: orderNum, [sortBy]: orderNum };
    } else {
      sortObj = { [sortBy]: orderNum };
    }
    criteria.push({ $sort: sortObj }, { $skip: limit * page }, { $limit: limit });

    const result = await this.model.aggregate(criteria);
    return { count, result };
  }

  private async paginate(query: any, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count(query);
    const result = await this.model
      .find(query)
      .limit(limit)
      .skip(limit * page);

    return { count, result };
  }

  public async paginateAll(pageNum?: number, limitNum?: number) {
    return this.paginate({}, pageNum, limitNum);
  }

  public async paginateCandidatesByFilter(
    filter: string,
    pageNum?: number,
    limitNum?: number,
    sort: { sortBy: 'totalVotes' | 'commission' | 'totalPoints'; order: 'asc' | 'desc' } = {
      sortBy: 'totalVotes',
      order: 'desc',
    }
  ) {
    return this.paginateByFilter(filter, [ValidatorStatus.CANDIDATE, ValidatorStatus.DELEGATE], pageNum, limitNum, {
      ...sort,
    });
  }

  public async paginateDelegatesByFilter(
    filter: string,
    pageNum?: number,
    limitNum?: number,
    sort: { sortBy: 'votingPower' | 'commission' | 'totalPoints'; order: 'asc' | 'desc' } = {
      sortBy: 'votingPower',
      order: 'asc',
    }
  ) {
    return this.paginateByFilter(filter, [ValidatorStatus.DELEGATE], pageNum, limitNum, { ...sort });
  }

  public async paginateJailedByFilter(
    filter: string,
    pageNum?: number,
    limitNum?: number,
    sort: { sortBy: 'totalPoints' | 'jailedTime' | 'bailAmount'; order: 'asc' | 'desc' } = {
      sortBy: 'totalPoints',
      order: 'asc',
    }
  ) {
    return this.paginateByFilter(filter, [ValidatorStatus.JAILED], pageNum, limitNum, { ...sort });
  }
}

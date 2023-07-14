import { AuctionSummary, IAuctionSummary } from '../model';

export class AuctionSummaryRepo {
  private model = AuctionSummary;

  public async findAll() {
    return this.model.find({}).sort({ createTime: -1 });
  }

  public async findByID(id: string) {
    return this.model.findOne({ id });
  }

  public async existID(id: string) {
    return this.model.exists({ id });
  }

  public async create(auctionSummary: IAuctionSummary) {
    return this.model.create(auctionSummary);
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ startHeight: { $gt: blockNum } });
  }
}

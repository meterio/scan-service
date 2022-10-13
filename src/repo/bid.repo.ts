import { Bid } from '../model/bid.interface';
import bidModel from '../model/bid.model';
import { formalizePageAndLimit } from '../utils';
export default class BidRepo {
  private model = bidModel;

  public async findAll() {
    return this.model.find();
  }

  public async findByAddress(address: string) {
    return this.model.findOne({
      address: address.toLowerCase(),
    });
  }

  public async create(bid: Bid) {
    return this.model.create(bid);
  }

  public async findById(id: string) {
    return this.model.findOne({ id });
  }

  public async findByAuctionID(auctionID: string) {
    return this.model.find({ auctionID });
  }

  public async findAutobidsByAuctionID(auctionID: string) {
    return this.model.find({ auctionID, type: 'autobid' });
  }

  public async findUserbidsByAuctionID(auctionID: string) {
    return this.model.find({ auctionID, type: 'userbid' });
  }

  public async bulkInsert(...bids: Bid[]) {
    return this.model.create(bids);
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ blockNum: { $gt: blockNum } });
  }

  public async countByAddress(address: string) {
    return this.model.count({ address: address.toLowerCase() });
  }

  // paginates
  private async paginate(query: any, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count(query);
    const result = await this.model
      .find(query)
      .limit(limit)
      .skip(limit * page);
    return { count, result };
  }

  public async paginateAutobidsByEpoch(epoch: number, pageNum?: number, limitNum?: number) {
    return this.paginate({ epoch, type: 'userbid' }, pageNum, limitNum);
  }

  public async paginateUserbidsByAuctionID(auctionID: string, pageNum?: number, limitNum?: number) {
    return this.paginate({ auctionID, type: 'userbid' }, pageNum, limitNum);
  }

  public async paginateByAuctionID(auctionID: string, pageNum?: number, limitNum?: number) {
    return this.paginate({ auctionID }, pageNum, limitNum);
  }

  public async paginateByAddress(address: string, pageNum?: number, limitNum?: number) {
    return this.paginate({ address: address.toLowerCase() }, pageNum, limitNum);
  }
}

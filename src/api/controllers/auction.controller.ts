import { BigNumber } from 'bignumber.js';
import { AuctionRepo, BidRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { extractPageAndLimitQueryParam } from '../utils/utils';
import { BaseController } from './baseController';
import { Network } from '../../const';

class AuctionController extends BaseController {
  public path = '/api/auctions';
  public router = Router();
  private auctionRepo = new AuctionRepo();
  private bidRepo = new BidRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/present`, try$(this.getPresentAuction));
    this.router.get(`${this.path}/past`, try$(this.getPastAuctions));
    this.router.get(`${this.path}/:id`, try$(this.getAuctionByID));
    this.router.get(`${this.path}/:id/bids`, try$(this.getAuctionBids));
    this.router.get(`${this.path}/:id/autobidSummaries`, try$(this.getAutobidSummariesByAuctionID));
    this.router.get(`${this.path}/:id/userbids`, try$(this.getUserbidsByAuctionID));

    this.router.get(`${this.path}/:epoch/autobids`, try$(this.getAutobidsByEpoch));
  }

  private getPresentAuction = async (req: Request, res: Response) => {
    const present = await this.auctionRepo.findPresent();
    if (!present) {
      return res.json({ present: {} });
    }
    // const bids = await this.bidRepo.findByAuctionID(present.id);
    res.json({ present: present.toSummary() });
  };

  private getPastAuctions = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.auctionRepo.paginateAllPast(page, limit);
    return res.json({
      totalRows: paginate.count,
      auctions: paginate.result.map((a) => a.toSummary()),
    });
  };

  private getAuctionByID = async (req: Request, res: Response) => {
    const { id } = req.params;
    const auction = await this.auctionRepo.findByID(id);
    return res.json({ summary: auction.toSummary() });
  };

  private getAuctionBids = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.bidRepo.paginateByAuctionID(id, page, limit);
    return res.json({ totalRows: paginate.count, bids: paginate.result });
  };

  private getUserbidsByAuctionID = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.bidRepo.paginateUserbidsByAuctionID(id, page, limit);
    return res.json({ totalRows: paginate.count, userbids: paginate.result });
  };

  private getAutobidSummariesByAuctionID = async (req: Request, res: Response) => {
    const { id } = req.params;
    const autobids = await this.bidRepo.findAutobidsByAuctionID(id);
    let summariesByEpoch = {};
    for (const b of autobids) {
      if (b.epoch in summariesByEpoch) {
        let s = summariesByEpoch[b.epoch];
        s.total = s.total.plus(b.amount);
        s.bidCount++;
      } else {
        summariesByEpoch[b.epoch] = {
          epoch: b.epoch,
          blockNum: b.blockNum,
          total: new BigNumber(b.amount),
          bidCount: 1,
        };
      }
    }
    const autobidSummaries = Object.values(summariesByEpoch).sort((a: any, b: any) => (a.epoch < b.epoch ? 1 : -1));
    return res.json({ autobidSummaries });
  };

  private getAutobidsByEpoch = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const { epoch } = req.params;
    const paginate = await this.bidRepo.paginateAutobidsByEpoch(Number(epoch), page, limit);
    const autobids = paginate.result;
    if (!autobids || autobids.length <= 0) {
      return res.json({ summary: { epoch }, autobids: [] });
    }
    let totalAmount = new BigNumber(0);
    let totalLots = new BigNumber(0);
    let first = autobids[0];
    let bids = [];
    for (const b of autobids) {
      totalAmount = totalAmount.plus(b.amount);
      if (b.lotAmount) {
        totalLots = totalLots.plus(b.lotAmount);
      }
      bids.push({ address: b.address, amount: b.amount });
    }
    const summary = {
      epoch,
      blockNum: first.blockNum,
      timestamp: first.timestamp,
      txHash: first.txHash,
      bidCount: autobids.length,
      totalAutobidAmount: totalAmount.toFixed(),
      totalLotAmount: totalLots.toFixed(),
    };
    return res.json({ summary, bids, totalRows: paginate.count });
  };
}
export default AuctionController;

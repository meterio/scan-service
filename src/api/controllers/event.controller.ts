import { LogEventRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { RECENT_WINDOW } from '../const';
import { Network } from '../../const';
import { BaseController } from './baseController';
import { extractPageAndLimitQueryParam } from '../utils/utils';

class EventController extends BaseController {
  public path = '/api/events';
  public router = Router();
  private eventRepo = new LogEventRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/on/:address/in/:fromNum/:toNum`, try$(this.getEventsOnAddressInRange));
    this.router.post(`${this.path}/filter`, try$(this.getEventsByFilter));
  }

  private getEventsOnAddressInRange = async (req: Request, res: Response) => {
    const { address, fromNum, toNum } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.eventRepo.paginateOnAddressInRange(
      address,
      Number(fromNum),
      Number(toNum),
      page,
      limit
    );
    if (paginate) {
      return res.json({
        totalRows: paginate.count,
        events: paginate.result.map((r) => ({
          address: r.address,
          topics: r.topics,
          data: r.data,
          blockNum: r.block.number,
          txHash: r.txHash,
          clauseIndex: r.clauseIndex,
          logIndex: r.logIndex,
        })),
      });
    }
    return res.json({ totalRows: 0, events: [] });
  };

  private getEventsByFilter = async (req: Request, res: Response) => {
    const { topics0, address, fromBlock } = req.body;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.eventRepo.paginateByFilter(topics0, address, fromBlock, page, limit);
    if (paginate) {
      return res.json({
        totalRows: paginate.count,
        events: paginate.result.map((r) => ({
          address: r.address,
          topics: r.topics,
          data: r.data,
          blockNum: r.block.number,
          txHash: r.txHash,
          clauseIndex: r.clauseIndex,
          logIndex: r.logIndex,
        })),
      });
    }
    return res.json({ totalRows: 0, events: [] });
  };
}

export default EventController;

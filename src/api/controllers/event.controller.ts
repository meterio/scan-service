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
    this.router.post(`${this.path}/filter`, try$(this.getEventsByFilter));
  }

  private getEventsByFilter = async (req: Request, res: Response) => {
    const { topics0, address, fromBlock } = req.body;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.eventRepo.paginateByFilter(topics0, address, fromBlock, page, limit);
    if (paginate) {
      return res.json({
        totalRows: paginate.count,
        events: paginate.result.map((r) => r.toJSON()),
      });
    }
    return res.json({ totalRows: 0, events: [] });
  };
}

export default EventController;

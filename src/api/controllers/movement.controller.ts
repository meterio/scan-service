import { MovementRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { RECENT_WINDOW } from '../const';
import { Network } from '../../const';
import { BaseController } from './baseController';

class MovementController extends BaseController {
  public path = '/api/transfers';
  public router = Router();
  private movementRepo = new MovementRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/recent`, try$(this.getRecent));
  }

  private getRecent = async (req: Request, res: Response) => {
    let count = RECENT_WINDOW;
    try {
      const countParam = Number(req.query.count);
      count = countParam > 1 ? countParam : count;
    } catch (e) {
      // ignore
      console.log('Invalid count param: ', req.query.count);
    }

    const transfers = await this.movementRepo.findRecentWithLimit(count);
    return res.json({ transfers });
  };
}

export default MovementController;

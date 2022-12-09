import { MovementRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { RECENT_WINDOW } from '../const';
import { Network } from '../../const';
import { BaseController } from './baseController';
import { extractPageAndLimitQueryParam } from '../utils/utils';
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
    this.router.get(`${this.path}/nft/after/:blockNum`, try$(this.getTransfersAfterBlock));
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

  private getTransfersAfterBlock = async (req: Request, res: Response) => {
    const { blockNum } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.movementRepo.paginateNFTMovementsAfterBlock(Number(blockNum), page, limit);

    if (paginate) {
      return res.json({
        totalRows: paginate.count,
        transfers: paginate.result.map((m) => ({
          from: m.from,
          to: m.to,
          tokenAddress: m.tokenAddress,
          nftTransfers: m.nftTransfers,
          txHash: m.txHash,
          blockNum: m.block.number,
          timestamp: m.block.timestamp,
        })),
      });
    }

    return res.json({ totalRows: 0, transfers: [] });
  };
}

export default MovementController;

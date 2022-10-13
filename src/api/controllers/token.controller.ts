import { ContractRepo, MovementRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network } from '../../const';
import { BaseController } from './baseController';

class TokenController extends BaseController {
  public path = '/api/token';
  public router = Router();

  private contractRepo = new ContractRepo();
  private movementRepo = new MovementRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/:address`, try$(this.getTokenInfo));
  }

  private getTokenInfo = async (req: Request, res: Response) => {
    const { address } = req.params;

    const contract = await this.contractRepo.findByAddress(address);
    const transfersCount = await this.movementRepo.countByTokenAddress(address);

    res.json({
      result: contract.toJSON() || {
        name: '',
        symbol: '',
        decimals: 18,
        address: '',
        officialSite: '',
        totalSupply: 0,
        circulation: 0,
        holdersCount: 0,
        transfersCount,
      },
    });
  };
}

export default TokenController;

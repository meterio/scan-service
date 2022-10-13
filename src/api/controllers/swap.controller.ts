import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network } from '../../const';
import { PermitRouter__factory } from '../typechain';
import { ethers } from 'ethers';
import { SWAP_GAS_NEED } from '../const';
import { BaseController } from './baseController';

class SwapController extends BaseController {
  public path = '/api/swap';
  public router = Router();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/swapGas`, try$(this.swapGas));
  }

  private formatSwapParams = (req: Request) => {
    const { account, amountIn, amountOutMin, deadline, signature } = req.query;

    if (!account || !amountIn || !amountOutMin || !deadline || !signature) {
      throw new Error("'account | amountIn | amountOutMin | deadline | signature' are necessary.");
    }

    const r = {
      account: String(account),
      amountIn: String(amountIn),
      amountOutMin: String(amountOutMin),
      deadline: String(deadline),
      signature: String(signature),
    };

    return r;
  };

  private swapGas = async (req: Request, res: Response) => {
    const { account, amountIn, amountOutMin, deadline, signature } = this.formatSwapParams(req);

    const { routerAddr, privateKey, rpc } = SWAP_GAS_NEED;

    const router = PermitRouter__factory.connect(
      routerAddr,
      new ethers.Wallet(privateKey, new ethers.providers.JsonRpcProvider(rpc))
    );

    let receipt = await router.swapExactTokensForTokens(account, amountIn, amountOutMin, deadline, signature);

    console.log(receipt);

    return res.json({
      receipt,
    });
  };
}
export default SwapController;

import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network } from '../../const';
import { PermitRouter__factory } from '../typechain';
import { ethers } from 'ethers';
import { SWAP_GAS_NEED } from '../const';
import { BaseController } from './baseController';
import { strictBrowserOnly } from '../../utils';

class SwapController extends BaseController {
  public path = '/api/swap';
  public router = Router();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/swapGas`, ...strictBrowserOnly('https://wallet.meter.io'), try$(this.swapGas));
    this.router.get(`${this.path}/swapGasV2`, ...strictBrowserOnly('https://wallet.meter.io'), try$(this.swapGasV2));
  }

  private formatSwapParams = (req: Request) => {
    const { account, amountIn, amountOutMin, deadline, signature, routerAddr } = req.query;

    if (!account || !amountIn || !amountOutMin || !deadline || !signature || !routerAddr) {
      throw new Error("'account | amountIn | amountOutMin | deadline | signature | routerAddr' are necessary.");
    }

    const r = {
      account: String(account),
      amountIn: String(amountIn),
      amountOutMin: String(amountOutMin),
      deadline: String(deadline),
      signature: String(signature),
      routerAddr: String(routerAddr)
    };

    return r;
  };

  private swapGas = async (req: Request, res: Response) => {
    const { account, amountIn, amountOutMin, deadline, signature, routerAddr } = this.formatSwapParams(req);

    const { privateKey, rpc } = SWAP_GAS_NEED;

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

  private swapGasV2 = async (req: Request, res: Response) => {
    const { account, amountIn, amountOutMin, deadline, signature, routerAddr, tokenIn, path } = req.query;

    const { privateKey, rpc } = SWAP_GAS_NEED;

    // const router = PermitRouter__factory.connect(
    //   routerAddr,
    //   new ethers.Wallet(privateKey, new ethers.providers.JsonRpcProvider(rpc))
    // );

    const abi = [{
      "inputs": [
        {
          "internalType": "address",
          "name": "_owner",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "amountOutMin",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "tokenIn",
          "type": "address"
        },
        {
          "internalType": "address[]",
          "name": "path",
          "type": "address[]"
        },
        {
          "internalType": "bytes",
          "name": "signature",
          "type": "bytes"
        }
      ],
      "name": "swapExactTokensForTokens",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }]
    const router = new ethers.Contract(String(routerAddr), abi, new ethers.Wallet(privateKey, new ethers.providers.JsonRpcProvider(rpc)))

    let receipt = await router.swapExactTokensForTokens(account, amountIn, amountOutMin, deadline, tokenIn, String(path).split(','), signature);

    console.log(receipt);

    return res.json({
      receipt,
    });
  };
}
export default SwapController;

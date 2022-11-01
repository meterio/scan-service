require('../utils/validateEnv');

import App from './app';
import AccountController from './controllers/account.controller';
import AuctionController from './controllers/auction.controller';
import BlockController from './controllers/block.controller';
import BucketController from './controllers/bucket.controller';
import EpochController from './controllers/epoch.controller';
import HomeController from './controllers/home.controller';
import KnownController from './controllers/known.controller';
import MetricController from './controllers/metric.controller';
import PowController from './controllers/pow.controller';
import SearchController from './controllers/search.controller';
import TokenController from './controllers/token.controller';
import MovementController from './controllers/movement.controller';
import TxController from './controllers/tx.controller';
import ValidatorController from './controllers/validator.controller';
import ContractController from './controllers/contract.controller';
import SwapController from './controllers/swap.controller';
import NFTController from './controllers/nft.controller';
import DownloadController from './controllers/download.controller';
import TwitterController from './controllers/twitter.controller';
import { Network } from '../const';

export const serveAPI = async (network: Network, standby: boolean, port: number) => {
  const app = new App(
    [
      new BucketController(network, standby),
      new ContractController(network, standby),
      new HomeController(network, standby),
      new SearchController(network, standby),
      new MetricController(network, standby),
      new BlockController(network, standby),
      new TxController(network, standby),
      new AccountController(network, standby),
      new PowController(network, standby),
      new MovementController(network, standby),
      new ValidatorController(network, standby),
      new AuctionController(network, standby),
      new EpochController(network, standby),
      new KnownController(network, standby),
      new TokenController(network, standby),
      new SwapController(network, standby),
      new NFTController(network, standby),
      new DownloadController(network, standby),
      new TwitterController(network, standby)
    ],
    network,
    standby
  );
  await app.listen(port);
};

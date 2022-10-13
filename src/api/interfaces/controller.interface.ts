import { Router } from 'express';
import { NetworkConfig } from '../../const';
import { Network } from '../const';

interface Controller {
  path: string;
  router: Router;
  network: Network;
  standby: boolean;
  config: NetworkConfig;
}

export default Controller;

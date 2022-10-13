import { Network } from '../const';
import { Router } from 'express';
import { GetNetworkConfig, NetworkConfig } from '../../const';
import Controller from '../interfaces/controller.interface';

export class BaseController implements Controller {
  public router = Router();
  public path = '/';
  public network = Network.MainNet;
  public standby = false;
  public config: NetworkConfig = {} as any;

  constructor(network: Network, standby: boolean) {
    this.network = network;
    this.standby = standby;
    const config = GetNetworkConfig(this.network);
    if (!config) {
      throw new Error(`could not load config for ${this.network}`);
    }
    this.config = config;
  }
}

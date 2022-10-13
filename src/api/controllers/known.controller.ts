import { ContractType } from '../const';
import { ContractFile } from '../../model';
import { ABIFragment } from '../../model/abiFragment.interface';
import { ABIFragmentRepo, ContractRepo, KnownRepo, ContractFileRepo } from '../../repo';
import { Interface, FormatTypes } from 'ethers/lib/utils';
import { toChecksumAddress } from '@meterio/devkit/dist/cry';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import {
  AccountLockModuleAddress,
  AuctionAccountAddress,
  AuctionLeftOverAddress,
  AuctionModuleAddress,
  BridgePoolAddress,
  ExecutorAddress,
  ParamsAddress,
  StakingModuleAddress,
  ValidatorBenefitAddress,
} from '../const';
import axios from 'axios';
import { Network } from '../../const';
import { BaseController } from './baseController';

class KnownController extends BaseController {
  public path = '/api/knowns';
  public router = Router();
  private knownRepo = new KnownRepo();
  private contractRepo = new ContractRepo();
  private abiFragmentRepo = new ABIFragmentRepo();
  private contractFileRepo = new ContractFileRepo();
  private knownMap = {};

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
    this.knownMap[AuctionAccountAddress] = 'Auction Account';
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/address`, try$(this.getKnownAddresses));
    this.router.get(`${this.path}/token`, try$(this.getKnownTokens));
    // this.router.post(
    //   `${this.path}/saveMethodAndEvent`,
    //   try$(this.saveMethodAndEvent)
    // );
    this.router.get(`${this.path}/import/:address`, try$(this.importFromSourcify));
    this.router.get(`${this.path}/getAllMethodAndEvent`, try$(this.getAllMethodAndEvent));
  }

  private getAllMethodAndEvent = async (req: Request, res: Response) => {
    try {
      const events = await this.abiFragmentRepo.findAllEvents();
      const methods = await this.abiFragmentRepo.findAllFunctions();

      res.json({
        status: true,
        events,
        methods,
      });
    } catch (e) {
      return res.json({
        status: false,
        message: e.message,
      });
    }
  };

  private importFromSourcify = async (req: Request, res: Response) => {
    const { address } = req.params;
    const contract = await this.contractRepo.findByAddress(address);
    if (contract.verified) {
      return res.json({ verified: true, address });
    }

    const SOURCIFY_SERVER_API = 'https://sourcify.dev/server';
    if (this.config.chainId === 0) {
      return res.json({
        verified: false,
        address,
        error: 'chainId is not ready',
      });
    }

    const addr = toChecksumAddress(address);
    const fileRes = await axios.get(`${SOURCIFY_SERVER_API}/files/any/${this.config.chainId}/${addr}`);

    const { data } = fileRes;
    contract.verified = true;
    contract.status = data.status;

    let contractFiles: ContractFile[] = [];
    for (const file of data.files) {
      contractFiles.push({
        ...file,
        address: address.toLowerCase(),
      } as ContractFile);

      if (file.name === 'metadata.json') {
        // decode metadata

        const meta = JSON.parse(file.content);
        const abis = meta.output.abi;

        let fragments: ABIFragment[] = [];
        const iface = new Interface(abis);
        const funcMap = iface.functions;
        const evtMap = iface.events;
        for (const key in funcMap) {
          const funcFragment = funcMap[key];
          const name = funcFragment.name;
          const abi = funcFragment.format(FormatTypes.full);
          const signature = iface.getSighash(funcFragment);
          fragments.push({ name, signature, abi, type: 'function' });
        }
        for (const key in evtMap) {
          const evtFragment = evtMap[key];
          const name = evtFragment.name;
          const abi = evtFragment.format(FormatTypes.full);
          const signature = iface.getEventTopic(evtFragment);
          fragments.push({ name, signature, abi, type: 'event' });
        }

        console.log('fragments: ', fragments);

        await this.abiFragmentRepo.bulkUpsert(...fragments);
      }
    }
    console.log(
      'contract files: ',
      contractFiles.map((c) => ({ name: c.name, path: c.path }))
    );
    await this.contractFileRepo.bulkUpsert(...contractFiles);
    await contract.save();
    res.json({ verified: true, address });
  };

  // problem with previous implementation:
  // server trusts all of client's input, which is not always true
  //
  // private saveMethodAndEvent = async (req: Request, res: Response) => {
  //   const { events, methods } = req.body;
  //   const err = [];
  //   try {
  //     if (events.length > 0) {
  //       await this.knownEventRepo.bulkInsert(events);
  //     }
  //   } catch (e) {
  //     err.push(e.message);
  //   }
  //   try {
  //     if (methods.length > 0) {
  //       await this.knownMethodRepo.bulkInsert(methods);
  //     }
  //   } catch (e) {
  //     err.push(e.message);
  //   }
  //   if (err.length > 0) {
  //     return res.json({
  //       status: false,
  //       message: err.join(','),
  //     });
  //   }
  //   res.json({
  //     status: true,
  //   });
  // };

  private getKnownAddresses = async (req: Request, res: Response) => {
    const knowns = await this.knownRepo.findAll();
    let addresses = {};
    addresses[AccountLockModuleAddress] = 'Account Lock Engine';
    addresses[AuctionAccountAddress] = 'Auction Account';
    addresses[AuctionLeftOverAddress] = 'Auction Leftover';
    addresses[AuctionModuleAddress] = 'Auction Engine';
    addresses[BridgePoolAddress] = 'Bridge Pool';
    addresses[ExecutorAddress] = 'Executor';
    addresses[ParamsAddress] = 'Params';
    addresses[StakingModuleAddress] = 'Staking Engine';
    addresses[ValidatorBenefitAddress] = 'Staking Reward';

    if (!knowns) {
      return res.json({ addresses });
    }
    for (const k of knowns) {
      addresses[k.address.toLowerCase()] = k.name;
    }
    return res.json({ addresses });
  };

  private getKnownTokens = async (req: Request, res: Response) => {
    const tokens = await this.contractRepo.findAllTokens();
    if (!tokens) {
      return res.json({ tokens: [] });
    }
    return res.json({
      tokens: tokens.map((t) => ({
        type: ContractType[t.type],
        address: t.address,
        symbol: t.symbol,
        decimals: t.decimals,
      })),
    });
  };
}
export default KnownController;

import { BigNumber } from 'bignumber.js';
import { BlockRepo, CommitteeRepo, PowBlockRepo, TxRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network, ZeroAddress } from '../../const';
import { extractPageAndLimitQueryParam, fromWei } from '../utils/utils';
import { BaseController } from './baseController';

class PowController extends BaseController {
  public path = '/api/pow';
  public router = Router();
  private powBlockRepo = new PowBlockRepo();
  private blockRepo = new BlockRepo();
  private txRepo = new TxRepo();
  private committeeRepo = new CommitteeRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/rewards`, try$(this.getPowRewards));
    this.router.get(`${this.path}/rewards/:epoch`, try$(this.getPowRewardsByEpoch));
    this.router.get(`${this.path}/blocks/recent`, try$(this.getRecentPowBlocks));
  }

  private getPowRewards = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);
    // TODO: problem ? not quite sure if the result is correct

    const startTime1 = Date.now();

    const paginate = await this.committeeRepo.paginateAll(page, limit);

    const endTime1 = Date.now();
    console.log(`find committee repo ${(startTime1 - endTime1) / 1000}s`);

    const numbers = paginate.result.map((c) => c.kblockHeight);

    const startTime2 = Date.now();

    let kblocks = await this.blockRepo.findByNumberList(numbers);

    const endTime2 = Date.now();
    console.log(`find block repo ${(startTime2 - endTime2) / 1000}s`);

    kblocks = kblocks.sort((a, b) => (a.number > b.number ? -1 : 1));
    if (!kblocks) {
      return res.json({ totalRows: 0, rewards: [] });
    }
    let rewards = [];
    for (const kb of kblocks) {
      const coinbaseTxHash = kb.txHashs[0];

      const startTime3 = Date.now();

      const coinbaseTx = await this.txRepo.findByHash(coinbaseTxHash);

      const endTime3 = Date.now();
      console.log(`find tx repo ${(startTime3 - endTime3) / 1000}s`);

      let total = new BigNumber(0);
      let rewardMap: { [key: string]: BigNumber } = {};
      let details = [];
      if (!!coinbaseTx && coinbaseTx.origin === ZeroAddress) {
        for (const c of coinbaseTx.clauses) {
          total = total.plus(c.value);
          if (c.to in rewardMap) {
            rewardMap[c.to] = rewardMap[c.to].plus(c.value);
          } else {
            rewardMap[c.to] = new BigNumber(c.value);
          }
        }
        for (const addr in rewardMap) {
          details.push({
            address: addr,
            subTotal: rewardMap[addr].toFixed(),
            subTotalStr: `${fromWei(rewardMap[addr])} ${this.config.energySym}`,
          });
        }
        let powStart = 0;
        let powEnd = 0;
        if (kb.powBlocks) {
          for (const pb of kb.powBlocks) {
            if (powStart == 0) {
              powStart = pb.height;
            } else {
              powStart = powStart > pb.height ? pb.height : powStart;
            }
            powEnd = powEnd < pb.height ? pb.height : powEnd;
          }
        }
        rewards.push({
          posBlock: kb.number,
          powStart,
          powEnd,
          timestamp: kb.timestamp,
          epoch: kb.epoch,
          totalAmount: total.toFixed(),
          totalAmountStr: `${fromWei(total)} ${this.config.energySym}`,
          details,
        });
      }
    }

    return res.json({ totalRows: paginate.count, rewards });
  };

  private getPowRewardsByEpoch = async (req: Request, res: Response) => {
    const { epoch } = req.params;
    const kblocks = await this.blockRepo.findKBlocksByEpochs([parseInt(epoch)]);
    if (kblocks.length <= 0) {
      return res.json({
        posBlock: 0,
        powBlock: 0,
        timestamp: 0,
        epoch: epoch,
        totalAmount: 0,
        totalAmountStr: `0 ${this.config.energySym}`,
        details: [],
      });
    }

    const kb = kblocks[0];
    const coinbaseTxHash = kb.txHashs[0];
    const coinbaseTx = await this.txRepo.findByHash(coinbaseTxHash);
    let total = new BigNumber(0);
    let rewardMap: { [key: string]: BigNumber } = {};
    let details = [];
    if (!!coinbaseTx && coinbaseTx.origin === ZeroAddress) {
      for (const c of coinbaseTx.clauses) {
        total = total.plus(c.value);
        if (c.to in rewardMap) {
          rewardMap[c.to] = rewardMap[c.to].plus(c.value);
        } else {
          rewardMap[c.to] = new BigNumber(c.value);
        }
      }
      for (const addr in rewardMap) {
        details.push({
          address: addr,
          subTotal: rewardMap[addr].toFixed(),
          subTotalStr: `${fromWei(rewardMap[addr])} ${this.config.energySym}`,
        });
      }
      return res.json({
        posBlock: kb.number,
        powBlock: 1274, // FIXME: fake number
        timestamp: kb.timestamp,
        epoch: kb.epoch,
        totalAmount: total.toFixed(),
        totalAmountStr: `${fromWei(total)} ${this.config.energySym}`,
        details,
      });
    }
  };

  private getRecentPowBlocks = async (req: Request, res: Response) => {
    const blocks = await this.powBlockRepo.findRecent();
    if (!blocks) {
      return res.json({ powBlocks: [] });
    }
    return res.json({ powBlocks: blocks });
  };
}

export default PowController;

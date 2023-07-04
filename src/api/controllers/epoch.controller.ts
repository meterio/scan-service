import { Block } from '../../model';
import { BlockType } from '../const';
import { BlockRepo, CommitteeRepo, KnownRepo } from '../../repo';
import axios from 'axios';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { getDelegates } from '../const';
import { Network } from '../../const';
import { extractPageAndLimitQueryParam } from '../utils/utils';
import { BaseController } from './baseController';
class EpochController extends BaseController {
  public path = '/api/epochs';
  public router = Router();
  private blockRepo = new BlockRepo();
  private committeeRepo = new CommitteeRepo();
  private knownRepo = new KnownRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/recent`, try$(this.getRecentEpochs));
    this.router.get(`${this.path}/:epoch/members`, try$(this.getMembersByEpoch));
    this.router.get(`${this.path}/:epoch`, try$(this.getEpochDetail));
    this.router.get(`${this.path}/:epoch/stats`, try$(this.getStatsByEpoch));
  }

  private getRecentEpochs = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.committeeRepo.paginateAll(page, limit);
    const snums = paginate.result.filter((c) => !!c.endBlock).map((c) => c.endBlock.number);
    const kblocks = await this.blockRepo.findByNumberList(snums);
    let blockMap = {};
    for (const b of kblocks) {
      blockMap[b.number] = b;
    }
    let epochs = [];
    for (const c of paginate.result) {
      let powBlockCount = 0;
      if (c.endBlock && c.endBlock.number in blockMap) {
        const b = blockMap[c.endBlock.number];
        powBlockCount = b.powBlocks.length;
      }
      epochs.push({
        epoch: c.epoch,
        active: !c.endBlock,
        startKBlock: c.startBlock.number,
        startTime: c.startBlock.timestamp,
        endKBlock: c.endBlock ? c.endBlock.number : 0,
        endTime: c.endBlock ? c.endBlock.timestamp : 0,
        committeeSize: c.members.length,
        powBlockCount,
      });
    }
    res.json({ totalRows: paginate.count, epochs });
  };

  private getMembersByEpoch = async (req: Request, res: Response) => {
    const { epoch } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const committee = await this.committeeRepo.findByEpoch(parseInt(epoch));
    if (!committee) {
      return res.json({
        totalRows: 0,
        startBlock: 0,
        endBlock: 0,
        kblockHeight: 0,
        members: [],
      });
    }
    const knowns = await this.knownRepo.findByKeyList(committee.members.map((m) => m.pubKey));
    let knownMap = {};
    for (const k of knowns) {
      knownMap[k.ecdsaPK] = k;
    }
    const delegates = getDelegates(this.network);
    if (delegates) {
      for (const d of delegates) {
        knownMap[d.pub_key] = d;
      }
    }
    let visited = {};
    const members = committee.members
      .map((m) => {
        if (visited[m.pubKey]) {
          return;
        }
        visited[m.pubKey] = true;
        const k = knownMap[m.pubKey];
        return {
          index: m.index,
          pubKey: m.pubKey,
          netAddr: m.netAddr,
          name: k ? k.name : '',
          description: k ? k.description || '' : '',
          address: k ? k.address : '',
        };
      })
      .filter((v) => !!v);

    if (members.length >= (page - 1) * limit) {
      return res.json({
        totalRows: members.length,
        members: members.slice((page - 1) * limit, page * limit),
        startBlock: committee.startBlock,
        endBlock: committee.endBlock,
        kblockHeight: committee.kblockHeight,
      });
    } else {
      return res.json({
        totalRows: members.length,
        members: [],
        startBlock: committee.startBlock,
        endBlock: committee.endBlock,
        kblockHeight: committee.kblockHeight,
      });
    }
  };

  private getStatsByEpoch = async (req: Request, res: Response) => {
    const { epoch } = req.params;
    const committee = await this.committeeRepo.findByEpoch(parseInt(epoch));
    console.log(`committee ${committee}`);
    if (!committee) {
      return res.json({
        startBlock: 0,
        endBlock: 0,
        members: [],
        stats: [],
      });
    }

    let endBlock = { number: -1, timestamp: -1, hash: '0x00' };
    console.log(`end block: ${endBlock}`);
    if (!committee.endBlock || committee.endBlock.number == 0) {
      const endBlocks = await this.blockRepo.findRecent();
      const bestBlock = endBlocks[0];
      endBlock = {
        number: bestBlock.number,
        timestamp: bestBlock.timestamp,
        hash: bestBlock.hash,
      };
    } else {
      endBlock = committee.endBlock;
    }

    const url = this.config.posUrl + `/staking/candidates?revision=${committee.startBlock.number}`;
    console.log(`gettting ${url}`);
    const candidatesRes = await axios.get(url);
    let cmap = {};
    candidatesRes.data.forEach((c) => {
      const keyparts = c.pubKey.split(':::');
      if (keyparts.length === 2) {
        cmap[keyparts[0]] = c;
      }
    });
    // console.log('committee.members', committee.members);
    let visited = {};
    const members = committee.members
      .map((m) => {
        if (m.pubKey in visited) {
          return undefined;
        }
        visited[m.pubKey] = true;
        const c = cmap[m.pubKey];
        return {
          index: m.index,
          netAddr: m.netAddr,
          name: c ? c.name : '',
          address: c ? c.address : '',
        };
      })
      .filter((v) => !!v);
    // console.log('members:', members);
    const memberMap = {};
    members.forEach((m) => {
      memberMap[m.index] = m;
    });

    const lastKBlock = await this.blockRepo.findByNumber(committee.startBlock.number - 1);
    const blocks = await this.blockRepo.findByNumberInRange(committee.startBlock.number, endBlock.number + 1);

    blocks.sort((a, b) => (a.number < b.number ? -1 : 1));
    const lastBlock = blocks[blocks.length - 1];
    const lastRound = lastBlock.qc.qcRound;
    const stats = this.calcStats(lastKBlock, blocks, memberMap, lastRound);
    const committeeSize = Object.keys(memberMap).length;
    const nloops = Math.ceil(lastRound / committeeSize);

    return res.json({
      startBlock: committee.startBlock,
      endBlock: endBlock,
      members,
      stats,
      committeeSize,
      lastRound,
      nloops,
    });
  };

  private calcStats = (lastKBlock: Block, blocks: Block[], memberMap: { [key: number]: any }, lastRound: number) => {
    let stats: {
      status: number; // status code: 1-success, 2-timeout
      b: number; // expected block number
      intvl: number; // finalize interval = curBlock.timestamp - prevBlock.timestamp
      k: boolean; // is kblock
    }[] = [];
    const size = Object.keys(memberMap).length;

    // console.log(`last round: `, lastRound, 'rows:', lastRound / size + 1, 'cols:', size);

    let curIndex = 0;
    try {
      for (let round = 0; round <= lastRound; round++) {
        const expectedProposerAddr = memberMap[round % size].address.replace('0x0x', '0x').toLowerCase();
        const curBlock = blocks[curIndex];
        if (expectedProposerAddr === curBlock.beneficiary.toLowerCase()) {
          // match
          const lastBlockTS = curIndex == 0 ? lastKBlock.timestamp : blocks[curIndex - 1].timestamp;
          stats.push({
            status: 1,
            b: curBlock.number,
            intvl: curBlock.timestamp - lastBlockTS,
            k: curBlock.blockType == BlockType.KBlock,
          });
          curIndex++;
        } else {
          // not match
          stats.push({
            status: 2,
            b: curBlock.number,
            intvl: 0,
            k: curBlock.blockType == BlockType.KBlock,
          });
        }
      }
    } catch (e) {
      console.log(e);
    }
    return stats;
  };

  private getEpochDetail = async (req: Request, res: Response) => {
    const { epoch } = req.params;
    const committee = await this.committeeRepo.findByEpoch(parseInt(epoch));
    if (!committee) {
      return res.json({
        summary: {},
        powBlocks: [],
        members: [],
      });
    }
    if (!committee.endBlock) {
      const recent = await this.blockRepo.findRecent();
      const head = recent[0];
      return res.json({
        summary: {
          epoch: committee.epoch,
          active: true,
          startKBlock: committee.startBlock.number,
          startTime: committee.startBlock.timestamp,
          committeeSize: committee.members.length,
          duration: head.timestamp - committee.startBlock.timestamp,
        },
        powBlocks: [],
      });
    }
    const num = committee.endBlock.number;
    const block = await this.blockRepo.findByNumber(num);
    return res.json({
      summary: {
        epoch: committee.epoch,
        active: false,
        startKBlock: committee.startBlock.number,
        startTime: committee.startBlock.timestamp,
        endKBlock: committee.endBlock.number,
        endTime: committee.endBlock.timestamp,
        duration: committee.endBlock.timestamp - committee.startBlock.timestamp,
        committeeSize: committee.members.length,
      },
      powBlocks: block.powBlocks,
    });
  };
}
export default EpochController;

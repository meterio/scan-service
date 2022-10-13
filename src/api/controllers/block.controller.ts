import { ScriptEngine } from '@meterio/devkit';
import { ABIFragmentRepo, AccountRepo, BlockRepo, TxRepo, ValidatorRepo } from '../../repo';
import { Interface, FormatTypes } from 'ethers/lib/utils';
import { Request, Response, Router } from 'express';
import { HttpError, try$ } from 'express-toolbox';

import { extractPageAndLimitQueryParam } from '../utils/utils';
import { isHexBytes, isUInt } from '../utils/validator';
import { BigNumber as EBN } from 'ethers';
import { BaseController } from './baseController';
import { Network } from '../../const';

class BlockController extends BaseController {
  public path = '/api/blocks';
  public router = Router();
  private blockRepo = new BlockRepo();
  private txRepo = new TxRepo();
  private accountRepo = new AccountRepo();
  private validatorRepo = new ValidatorRepo();
  private abiFragmentRepo = new ABIFragmentRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/bestin/:startTs/:endTs`, try$(this.getBestInTimeRange));
    this.router.get(`${this.path}/at/:timestamp`, try$(this.getExactMatchWithTimestamp));
    this.router.get(`${this.path}/recent`, try$(this.getRecentBlocks));
    this.router.get(`${this.path}/:revision`, try$(this.getBlockByRevision));
    this.router.get(`${this.path}/:revision/txs`, try$(this.getBlockTxs));
  }

  private getExactMatchWithTimestamp = async (req: Request, res: Response) => {
    const { timestamp } = req.params;
    const ts = Number(timestamp);
    if (isNaN(ts)) {
      throw new HttpError(400, `invalid timestamp: ${timestamp}`);
    }
    const blk = await this.blockRepo.findByTimestamp(ts);
    if (blk) {
      return res.json({
        number: blk.number,
        hash: blk.hash,
        timestamp: blk.timestamp,
      });
    }
    return res.json({
      number: 0,
      hash: '0x',
      timestamp: ts,
    });
  };

  private getBestInTimeRange = async (req: Request, res: Response) => {
    const { startTs, endTs } = req.params;
    const start = Number(startTs);
    const end = Number(endTs);

    if (isNaN(start) || isNaN(end)) {
      throw new HttpError(400, 'invalid start or end timestamp');
    }
    if (start > end) {
      throw new HttpError(400, 'start timestamp should be smaller than end timestamp');
    }

    const blks = await this.blockRepo.findInTimeRange(start, end);
    if (blks && blks.length > 1) {
      const sorted = blks.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
      const blk = sorted[0];
      return res.json({
        number: blk.number,
        hash: blk.hash,
        timestamp: blk.timestamp,
        startTs: start,
        endTs: end,
      });
    }
    return res.json({
      number: 0,
      timestamp: 1593907199,
      startTs: start,
      endTs: end,
    });
  };

  private getBlockByRevision = async (req: Request, res: Response) => {
    let blk: any;
    const revision = req.params.revision;
    if (revision === 'best') {
      blk = await this.blockRepo.getBestBlock();
    } else if (revision.startsWith('0x') && isHexBytes(revision, 32)) {
      blk = await this.blockRepo.findByHash(revision);
    } else {
      const num = parseInt(revision);
      if (isNaN(num) || !isUInt(num)) {
        throw new HttpError(400, 'invalid revision: bytes32 or number or best required');
      }
      blk = await this.blockRepo.findByNumber(num);
    }
    if (!blk) {
      return res.json({ block: null, prev: null, next: null });
    }
    let txs = [];
    if (blk.txHashs && blk.txHashs.length > 0) {
      txs = await this.txRepo.findByHashs(blk.txHashs);
    }
    let ans = blk.toSummary();

    let selectors = [];
    ans.txSummaries = txs
      .sort((a, b) => {
        return a.txIndex < b.txIndex ? -1 : 1;
      })
      .map((tx) => tx.toSummary())
      .map((tx) => {
        const c = tx.clauses.length > 0 ? tx.clauses[0] : null;
        let selector = '';
        let decoded = undefined;
        if (c) {
          if (c.data && c.data.length >= 10) {
            const isSE = ScriptEngine.IsScriptEngineData(c.data);
            if (isSE) {
              decoded = ScriptEngine.decodeScriptData(c.data);
              selector = `MeterEngine:${decoded.action}`;
            } else {
              selector = c.data ? c.data.substring(0, 10) : '';
            }
          } else {
            selector = 'Transfer';
          }
          if (selector && selector != '0x00000000') {
            selectors.push(selector);
          }
        }
        let result = {
          ...tx,
          selector,
          decoded,
        };
        delete result.clauses;
        return result;
      });

    const nameMap = await this.getNameMap();
    ans.beneficiaryName = nameMap[ans.beneficiary] || '';
    delete ans.txHashs;

    const fragments = await this.abiFragmentRepo.findBySignatureList(...selectors);
    const abis = fragments.map((f) => f.abi);
    const iface = new Interface(abis);

    ans.txSummaries.map((tx) => {
      let result = {
        ...tx,
      };
      if (!tx.decoded) {
        try {
          const decodeRes = iface.parseTransaction({
            data: tx.data || '',
            value: tx.value ? tx.value.toFixed() : 0,
          });
          result.selector = decodeRes.name;
          result.abi = decodeRes.functionFragment.format(FormatTypes.full);
          const abiJson = JSON.parse(decodeRes.functionFragment.format(FormatTypes.json));
          let decoded = {};
          for (const input of abiJson.inputs) {
            const val = decodeRes.args[input.name];
            if (EBN.isBigNumber(val)) {
              decoded[input.name] = val.toString();
            } else {
              decoded[input.name] = val;
            }
          }
          if (result.abi) {
            result.decoded = decoded;
          }
        } catch (e) {
          console.log('Error happened during decoding: ', e);
        }
      }
      return result;
    });

    return res.json({ block: ans });
  };

  private getBlockTxs = async (req: Request, res: Response) => {
    let blk: any;
    const revision = req.params.revision;
    if (revision === 'best') {
      blk = await this.blockRepo.getBestBlock();
    } else if (revision.startsWith('0x') && isHexBytes(revision, 32)) {
      blk = await this.blockRepo.findByHash(revision);
    } else {
      const num = parseInt(revision);
      if (isNaN(num) || !isUInt(num)) {
        throw new HttpError(400, 'invalid revision: bytes32 or number or best required');
      }
      blk = await this.blockRepo.findByNumber(num);
    }
    if (!blk) {
      return res.json({ txs: [] });
    }

    const txs = await this.txRepo.findByHashs(blk.txHashs);
    return res.json({ txs });
  };

  private getNameMap = async () => {
    let nameMap: { [key: string]: string } = {};
    const knownAccts = await this.accountRepo.findKnownAccounts();
    knownAccts.forEach((a) => {
      nameMap[a.address] = a.name;
    });
    const validators = await this.validatorRepo.findAll();
    validators.forEach((v) => {
      if (v.name) {
        nameMap[v.address] = v.name;
      }
    });
    return nameMap;
  };

  private getRecentBlocks = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const nameMap = await this.getNameMap();
    const paginate = await this.blockRepo.paginateAll(page, limit);
    res.json({
      totalRows: paginate.count,
      blocks: paginate.result.map((b) => {
        return {
          ...b.toSummary(),
          beneficiaryName: nameMap[b.beneficiary] || '',
        };
      }),
    });
  };
}
export default BlockController;

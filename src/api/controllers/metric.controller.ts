import { BigNumber } from 'bignumber.js';
import {
  AccountRepo,
  BlockRepo,
  ContractRepo,
  HeadRepo,
  MetricRepo,
  MovementRepo,
  TxRepo,
  ValidatorRepo,
} from '../../repo';
import { Validator } from '../../model';
import axios from 'axios';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { enumVals } from '../const';
import { MetricName } from '../../const';
import { Network } from '../../const';
import { fromWei } from '../../utils';
import { BaseController } from './baseController';

class MetricController extends BaseController {
  public path = '/api/metrics';
  public router = Router();
  private metricRepo = new MetricRepo();
  private headRepo = new HeadRepo();
  private blockRepo = new BlockRepo();
  private txRepo = new TxRepo();
  private movementRepo = new MovementRepo();
  private accountRepo = new AccountRepo();
  private validatorRepo = new ValidatorRepo();
  private contractRepo = new ContractRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/all`, try$(this.getAllMetric));
    this.router.get(`${this.path}/pow`, try$(this.getPowMetric));
    this.router.get(`${this.path}/pos`, try$(this.getPosMetric));
    this.router.get(`${this.path}/token`, try$(this.getTokenMetric));
    this.router.get(`${this.path}/head`, try$(this.getHeadMetric));
    this.router.get(`${this.path}/chart`, try$(this.getChart));
    this.router.get(`${this.path}/committee`, try$(this.getCommitteeMetric));
    this.router.get(`${this.path}/invalid`, try$(this.getInvalidNodesMetric));
  }

  private getMetricMap = async () => {
    const names = enumVals(MetricName);
    const metrics = await this.metricRepo.findByKeys(names);
    let map: { [key: string]: string } = {};
    for (const m of metrics) {
      map[m.key] = m.value;
    }
    return map;
  };

  private getPosData = async () => {
    let map = await this.getMetricMap();
    const paginate = await this.blockRepo.paginateAll(1, 1000);
    let avgBlockTime = 2;
    if (paginate && paginate.count > 2) {
      const last = paginate.result[0];
      const first = paginate.result[paginate.result.length - 1];
      avgBlockTime = Math.floor((100 * (last.timestamp - first.timestamp)) / (paginate.result.length - 1)) / 100;
    }
    const txsCount = await this.movementRepo.count();

    const totalStaked = map[MetricName.MTRG_STAKED];
    const totalStakedLocked = map[MetricName.MTRG_STAKED_LOCKED];
    const totalSupply = await map[MetricName.MTRG_TOTALSUPPLY];

    const accountCount = await this.accountRepo.count();
    const contractCount = await this.contractRepo.count();
    const stakingRatio = new BigNumber(totalStaked).div(totalSupply).toNumber();
    return {
      pos: {
        best: Number(map[MetricName.POS_BEST]),
        kblock: Number(map[MetricName.KBLOCK]),
        epoch: Number(map[MetricName.EPOCH]),
        seq: Number(map[MetricName.SEQ]),
        avgBlockTime: avgBlockTime,
        txsCount,
        inflation: '5%',
        addressCount: Number(map[MetricName.ADDRESS_COUNT])  ,
      },
      staking: {
        buckets: Number(map[MetricName.BUCKET_COUNT]),
        candidates: Number(map[MetricName.CANDIDATE_COUNT]),
        stakeholders: Number(map[MetricName.STAKEHOLDER_COUNT]),
        delegates: Number(map[MetricName.DELEGATE_COUNT]),
        healthyNodes: Number(map[MetricName.CANDIDATE_COUNT]) - Number(map[MetricName.INVALID_NODES_COUNT]),
        invalidNodes: Number(map[MetricName.INVALID_NODES_COUNT]),
        totalStaked,
        stakingRatio,
        stakingAPY: new BigNumber(5).div(100).div(stakingRatio), // inflation / stakingRatio
        totalCirculationStaked: new BigNumber(totalStaked).minus(totalStakedLocked).toFixed(0),
        totalStakedStr: `${fromWei(totalStaked, 2)} ${this.config.balanceSym}`,
      },
    };
  };

  private getPowData = async () => {
    let map = await this.getMetricMap();
    return {
      pow: {
        best: Number(map[MetricName.POW_BEST]),
        difficulty: map[MetricName.DIFFICULTY],
        hashrate: map[MetricName.HASHRATE],
        coef: map[MetricName.COEF],
        costParity: map[MetricName.COST_PARITY],
        rewardPerDay: map[MetricName.REWARD_PER_DAY],
      },
    };
  };

  private getTokenData = async () => {
    let map = await this.getMetricMap();
    let avgDailyReward = '0 MTRG';
    try {
      let s = map[MetricName.PRESENT_AUCTION];
      let present = JSON.parse(s);
      if (present.releasedMTRG && Number(present.releasedMTRG)) {
        avgDailyReward = new BigNumber(present.releasedMTRG).dividedBy(1e18).toFixed(0) + ` ${this.config.balanceSym}`;
      }
    } catch (e) {}

    return {
      mtr: {
        price: map[MetricName.MTR_PRICE],
        priceChange: map[MetricName.MTR_PRICE_CHANGE],
        totalSupply: new BigNumber(map[MetricName.MTR_TOTALSUPPLY]).dividedBy(1e18).toFixed(),
        circulation: new BigNumber(map[MetricName.MTR_CIRCULATION]).dividedBy(1e18).toFixed(),
      },

      mtrg: {
        price: map[MetricName.MTRG_PRICE],
        priceChange: map[MetricName.MTRG_PRICE_CHANGE],
        avgDailyReward,
        totalSupply: new BigNumber(map[MetricName.MTRG_TOTALSUPPLY]).dividedBy(1e18).toFixed(),
        circulation: new BigNumber(map[MetricName.MTRG_CIRCULATION]).dividedBy(1e18).toFixed(),
      },
    };
  };

  private getAllMetric = async (req: Request, res: Response) => {
    const posData = await this.getPosData();
    console.log('got pos data:', posData);
    const powData = await this.getPowData();
    console.log('got pow data: ', powData);
    const tokenData = await this.getTokenData();
    console.log('got token data: ', tokenData);
    let committeeData = await this.getCommitteeData();
    console.log('got committee data: ', committeeData);

    delete committeeData.committee.invalidMembers;
    delete committeeData.committee.healthyMembers;
    delete committeeData.committee.jailedMembers;
    return res.json({
      ...tokenData,
      ...powData,
      ...posData,
      ...committeeData,
    });
  };

  private getPowMetric = async (req: Request, res: Response) => {
    const powData = await this.getPowData();
    return res.json(powData);
  };

  private getPosMetric = async (req: Request, res: Response) => {
    const posData = await this.getPosData();
    return res.json(posData);
  };

  private getTokenMetric = async (req: Request, res: Response) => {
    const tokenData = await this.getTokenData();
    return res.json(tokenData);
  };

  private getHeadMetric = async (req: Request, res: Response) => {
    const heads = await this.headRepo.findAll();
    if (!heads || heads.length <= 0) {
      return res.json({
        heads: {},
      });
    }
    let result = {};
    for (const h of heads) {
      result[h.key] = h.num;
    }
    return res.json({ heads: result });
  };

  private getInvalidNodesMetric = async (req: Request, res: Response) => {
    const map = await this.getMetricMap();
    const invalidNodes = map[MetricName.INVALID_NODES];
    const parsed = JSON.parse(invalidNodes);
    return res.json({ invalidNodes: parsed });
  };

  private getCommitteeMetric = async (req: Request, res: Response) => {
    const committeeData = await this.getCommitteeData();
    return res.json(committeeData);
  };

  private async getCommitteeData() {
    const emptyResponse = {
      committee: {
        size: 0,
        healthy: 0,
        invalid: 0,
        jailed: 0,
        jailedMembers: [],
        healthyMembers: [],
        invalidMembers: [],
      },
    };

    // find last KBlock
    const paginate = await this.blockRepo.paginateKBlocks(1, 1);
    const kblocks = paginate.result;
    if (!kblocks || kblocks.length <= 0) {
      return emptyResponse;
    }

    // find the latest committee
    const block = await this.blockRepo.findByNumber(kblocks[0].number + 1);
    if (!block || block.committee.length <= 0) {
      return emptyResponse;
    }

    // build validator map
    const validators = await this.validatorRepo.findAll();
    let vMap: { [key: string]: Validator } = {}; // validator map [ip -> validator obj]
    validators.forEach((v) => {
      const ecdsaKey = v.pubKey.split(':::')[0];
      vMap[ecdsaKey] = v;
    });

    // build jailed map
    let jailed = 0;
    let jailedMembers = [];
    const jailedVal = await this.metricRepo.findByKey(MetricName.JAILED);
    if (jailedVal) {
      const injail = JSON.parse(jailedVal.value);
      jailed = injail.length;
      injail.map((j) => {
        const ecdsaKey = j.pubKey.split(':::')[0];
        const v = vMap[ecdsaKey];
        jailedMembers.push({
          name: !!v ? v.name : j.name,
          ip: !!v ? v.ipAddress : 'N/A',
          ecdsa: ecdsaKey,
        });
      });
    }

    let invalid = 0;
    let invalidMap: { [key: string]: any } = {};
    const invalidVal = await this.metricRepo.findByKey(MetricName.INVALID_NODES);
    if (invalidVal) {
      const invalids = JSON.parse(invalidVal.value);
      invalids.map((i) => {
        const ecdsaKey = i.pubKey.split(':::')[0];
        invalidMap[ecdsaKey] = i;
      });
    }

    let healthyMembers = [],
      invalidMembers = [];

    let visited = {};
    let size = 0;
    console.log('block.committee length:', block.committee.length);
    for (const m of block.committee) {
      const { pubKey, netAddr } = m;
      const ecdsaKey = pubKey;
      if (ecdsaKey in visited) {
        continue;
      }
      visited[ecdsaKey] = true;

      size++; // distinct count
      const ip = netAddr.toLowerCase().split(':')[0];
      const v = vMap[ecdsaKey];
      if (!v) {
        invalid++;
        invalidMembers.push({
          name: '',
          ecdsa: ecdsaKey,
          ip,
          reason: 'no validator info found (possible key mismatch)',
        });
        continue;
      }
      const base = { name: v.name, ecdsa: ecdsaKey, ip };
      if (v.ipAddress != ip) {
        invalid++;
        invalidMembers.push({
          ...base,
          reason: 'ip address mismatch with validator info',
        });
        continue;
      }
      if (ecdsaKey in invalidMap) {
        invalid++;
        invalidMembers.push({
          ...base,
          reason: invalidMap[ecdsaKey].reason,
        });
        continue;
      }
      healthyMembers.push({ ...base });
    }
    const healthy = size - invalid;

    /*
    size = healthy + down + invalid
    jailed refers to the number of members in jail
    */
    return {
      committee: {
        explain: 'healthy+invalid = size',
        size,
        healthy,
        invalid,
        jailed,
        healthyMembers,
        invalidMembers,
        jailedMembers,
      },
    };
  }

  private getChart = async (req: Request, res: Response) => {
    const end = Math.floor(+new Date() / 1000);
    const start = end - 7 * 24 * 3600;
    const step = '24h';
    const hashrates = await axios.get(
      `http://monitor.meter.io:9090/api/v1/query_range?query=bitcoind_blockchain_hashrate&start=${start}&end=${end}&step=${step}`
    );
    const diffs = await axios.get(
      `http://monitor.meter.io:9090/api/v1/query_range?query=bitcoind_blockchain_difficulty&start=${start}&end=${end}&step=${step}`
    );

    if (!hashrates || !hashrates.data || !hashrates.data.data || !diffs || !diffs.data || !diffs.data.data) {
      return res.json({
        hashrates: { mainnet: [], testnet: [] },
        diffs: { mainnet: [], testnet: [] },
      });
    }
    let mainrates = [];
    let testrates = [];
    let maindiffs = [];
    let testdiffs = [];

    for (const m of hashrates.data.data.result) {
      if (mainrates.length <= 0 && m.metric.job === 'mainnet_bitcoin') {
        mainrates.push(...m.values);
      }
      if (testrates.length <= 0 && m.metric.job === 'shoal_bitcoin') {
        testrates.push(...m.values);
      }
    }
    for (const m of diffs.data.data.result) {
      if (maindiffs.length <= 0 && m.metric.job === 'mainnet_bitcoin') {
        maindiffs.push(...m.values);
      }
      if (testdiffs.length <= 0 && m.metric.job === 'shoal_bitcoin') {
        testdiffs.push(...m.values);
      }
    }

    return res.json({
      hashrates: { mainnet: mainrates, testnet: testrates },
      diffs: { mainnet: maindiffs, testnet: testdiffs },
    });
  };
}

export default MetricController;

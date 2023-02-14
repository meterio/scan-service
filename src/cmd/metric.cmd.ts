import { EventEmitter } from 'events';
import { BigNumber } from 'bignumber.js';
import { Network, SubFromTotalSupply } from '../const';
import {
  AccountRepo,
  AlertRepo,
  BlockRepo,
  BucketRepo,
  ContractRepo,
  HeadRepo,
  ValidatorRepo,
  ABIFragmentRepo,
  ContractFileRepo,
  NFTRepo,
  MovementRepo,
  TokenBalanceRepo,
} from '../repo';
import { ContractFile, Validator, Bucket } from '../model';
import { ERC20 } from '@meterio/devkit/dist';
import { toChecksumAddress } from '@meterio/devkit/dist/cry';
import pino from 'pino';

import {
  GetNetworkConfig,
  LockedMeterAddrs,
  LockedMeterGovAddrs,
  MetricName,
  Token,
  ContractType,
  ValidatorStatus,
} from '../const';
import { InterruptedError, Net, Pos, Pow, sleep, PROBE_TIMEOUT } from '../utils';
import { MetricCache } from '../types';
import { postToSlackChannel } from '../utils/slack';
import { CMD } from './cmd';
import axios from 'axios';
import { FormatTypes, Interface } from 'ethers/lib/utils';
import PromisePool from '@supercharge/promise-pool/dist';
import { ABIFragment } from '../model/abiFragment.interface';
const SAMPLING_INTERVAL = 3000;

const SOURCIFY_SERVER_API = 'https://sourcify.dev/server';

const every = 1;
const every6s = 6 / (SAMPLING_INTERVAL / 1000); // count of index in 1 minute
const every24h = (3600 * 24) / (SAMPLING_INTERVAL / 1000); // count of index in 24 hours
const every30s = 30 / (SAMPLING_INTERVAL / 1000); // count of index in 30 seconds
const every1m = 60 / (SAMPLING_INTERVAL / 1000); // count of index in 1 minute
const every2m = (60 * 2) / (SAMPLING_INTERVAL / 1000); // count of index in 3 minute
const every5m = (60 * 5) / (SAMPLING_INTERVAL / 1000); // count of index in 5 minutes
const every10m = (60 * 10) / (SAMPLING_INTERVAL / 1000); // count of index in 10 minutes
const every20m = (60 * 20) / (SAMPLING_INTERVAL / 1000); // count of index in 20 minutes
const every30m = (60 * 30) / (SAMPLING_INTERVAL / 1000); // count of index in 30 minutes
const every2h = (2 * 60 * 60) / (SAMPLING_INTERVAL / 1000); // count of index in 2 hours
const every4h = (4 * 60 * 60) / (SAMPLING_INTERVAL / 1000); // count of index in 4 hours
const every6h = (6 * 60 * 60) / (SAMPLING_INTERVAL / 1000); // count of index in 6 hours

export class MetricCMD extends CMD {
  private shutdown = false;
  private ev = new EventEmitter();
  private name = 'metric';
  private pos: Pos;
  private pow: Pow;
  private network: Network;
  private coingecko = new Net('https://api.coingecko.com/api/v3/');
  private blockchainInfo = new Net('https://api.blockchain.info');
  private validatorRepo = new ValidatorRepo();
  private bucketRepo = new BucketRepo();
  private accountRepo = new AccountRepo();
  private blockRepo = new BlockRepo();
  private alertRepo = new AlertRepo();
  private headRepo = new HeadRepo();
  private nftRepo = new NFTRepo();
  private tokenBalanceRepo = new TokenBalanceRepo();
  private movementRepo = new MovementRepo();
  private contractRepo = new ContractRepo();
  private abiFragmentRepo = new ABIFragmentRepo();
  private contractFileRepo = new ContractFileRepo();

  private cache = new MetricCache();

  constructor(net: Network) {
    super();
    this.log = pino({
      transport: {
        target: 'pino-pretty',
      },
    });
    this.pow = new Pow(net);
    this.pos = new Pos(net);
    this.network = net;
  }

  public async beforeStart() {
    await this.cache.init();
  }

  public async start() {
    await this.beforeStart();
    this.log.info('start');
    await this.loop();
    return;
  }

  public stop() {
    this.shutdown = true;

    return new Promise((resolve) => {
      this.log.info('shutting down......');
      this.ev.on('closed', resolve);
    });
  }

  private async updatePowInfo(index: number, interval: number) {
    if (index % interval === 0) {
      this.log.info('update PoW info');
      const mining = await this.pow.getMiningInfo();
      if (!!mining) {
        await this.cache.update(MetricName.DIFFICULTY, mining.difficulty);
        await this.cache.update(MetricName.HASHRATE, mining.networkhashps);
        await this.cache.update(MetricName.POW_BEST, mining.blocks);
      }
      let efficiency = new BigNumber(0.053);
      try {
        const curCoef = await this.pos.getCurCoef();
        // const coefStorage = await this.pos.getStorage(ParamsAddress, KeyPowPoolCoef);
        // this.log.info('Coef Storage:', coefStorage);
        // if (!!coefStorage && coefStorage.value) {
        if (!!curCoef) {
          const coef = parseInt(curCoef.toString());
          efficiency = new BigNumber(coef)
            .dividedBy(1e6)
            .times(300 * 120)
            .dividedBy(2 ** 32);
          await this.cache.update(MetricName.COEF, efficiency.toFixed());
        }
      } catch (e) {}

      this.log.info(`efficiency: ${efficiency.toFixed()}`);
      const btcHashrate = this.cache.get(MetricName.BTC_HASHRATE);
      const btcPrice = this.cache.get(MetricName.BTC_PRICE);
      const rewardPerDay = new BigNumber(efficiency).dividedBy(10).times(24);
      const costParity = new BigNumber(6.25) // bitcoin reward
        .times(24 * 6)
        .times(1000)
        .times(btcPrice)
        .dividedBy(btcHashrate)
        .dividedBy(rewardPerDay);
      this.log.info(`rewardPerDay: ${rewardPerDay.toFixed()}, cost parity: ${costParity}`);
      await this.cache.update(MetricName.COST_PARITY, costParity.toFixed());
      await this.cache.update(MetricName.REWARD_PER_DAY, rewardPerDay.toFixed());
      this.log.info('done update PoW info');
    }
  }

  private async updatePosInfo(index: number, interval: number) {
    if (index % interval === 0) {
      this.log.info('update PoS info');
      const blk = await this.pos.getBlock('best', 'regular');
      if (!!blk) {
        const seq = blk.number - blk.lastKBlockHeight;
        await this.cache.update(MetricName.POS_BEST, String(blk.number));
        await this.cache.update(MetricName.KBLOCK, String(blk.lastKBlockHeight));
        await this.cache.update(MetricName.SEQ, String(seq));
        let epoch = 0;
        if (blk.lastKBlockHeight + 1 === blk.number) {
          epoch = blk.epoch;
        } else {
          epoch = blk.qc.epochID;
        }
        if (epoch > 0) {
          await this.cache.update(MetricName.EPOCH, String(epoch));
        }
      }
      this.log.info('done update PoS info');
    }
  }

  private async checkOrSendAlert(network: string, epoch: number, number: number, channel: string, msg: string) {
    const exist = await this.alertRepo.existMsg(network, epoch, number, channel, msg);
    if (!exist) {
      try {
        await this.alertRepo.create({ network, epoch, number, channel, msg });
        await postToSlackChannel({ text: msg });
      } catch (e) {
        this.log.error({ err: e }, 'could not send alert');
      }
    }
  }

  private async alertIfNetworkHalt(index: number, interval: number) {
    if (index % interval === 0) {
      this.log.info('check if network halted');
      const bestBlock = await this.pos.getBlock('best', 'regular');
      const recentBlks = await this.blockRepo.findRecent();
      if (recentBlks && recentBlks.length > 0) {
        const head = recentBlks[0];
        if (head.number !== bestBlock.number) {
          return;
        }
        const now = Math.floor(Date.now() / 1000);
        if (now - head.timestamp > 120) {
          // alert
          const netName = Network[this.network];
          const channel = 'slack';
          const msg = `network ${netName} halted for over 2 minutes at epoch:${head.epoch} and number:${head.number}`;
          await this.checkOrSendAlert(netName, head.epoch, head.number, channel, msg);
          this.log.info(msg, `alert sent`);
        }
      }
      this.log.info('done check if network halted');
    }
  }

  private async updateValidatorRewards(index: number, interval: number) {
    if (index % interval === 0) {
      this.log.info('update validate rewards');
      const rwds = await this.pos.getValidatorRewards();
      if (!!rwds) {
        const updated = await this.cache.update(MetricName.VALIDATOR_REWARDS, JSON.stringify(rwds));
        if (!updated) {
          return;
        }
      }
      this.log.info('done update validate rewards');
    }
  }

  private async updateBitcoinInfo(index: number, interval: number) {
    if (index % interval === 0) {
      //blockchain.info/q/hashrate
      this.log.info('update Bitcoin info');
      const stats = await this.blockchainInfo.http<any>('GET', 'stats');
      this.log.info('BTC Hashrate:', stats.hash_rate);
      if (!!stats) {
        this.cache.update(MetricName.BTC_HASHRATE, String(stats.hash_rate));
      }
      const price = await this.coingecko.http<any>('GET', 'simple/price', {
        query: { ids: 'bitcoin', vs_currencies: 'usd', include_24hr_change: 'false' },
      });

      if (!!price && price.bitcoin) {
        this.log.info('BTC Price', price.bitcoin);
        this.cache.update(MetricName.BTC_PRICE, String(price.bitcoin.usd));
      }
      this.log.info('done update Bitcoin info');
    }
  }

  private async updateMarketPrice(index: number, interval: number) {
    if (index % interval === 0) {
      this.log.info('update market price');
      const config = GetNetworkConfig(this.network);

      if (typeof config.coingeckoEnergy === 'string') {
        const price = await this.coingecko.http<any>('GET', 'simple/price', {
          query: { ids: `${config.coingeckoEnergy}`, vs_currencies: 'usd', include_24hr_change: 'true' },
        });
        this.log.info(`Got energy price: ${price}`);
        if (!!price && config.coingeckoEnergy in price) {
          const m = price[config.coingeckoEnergy];
          const percent20h = Math.floor(parseFloat(m.usd_24h_change) * 100) / 100;
          this.cache.update(MetricName.MTR_PRICE, String(m.usd));
          this.cache.update(MetricName.MTR_PRICE_CHANGE, `${percent20h}%`);
        }
      } else if (typeof config.coingeckoEnergy === 'number') {
        this.cache.update(MetricName.MTR_PRICE, String(config.coingeckoEnergy));
        this.cache.update(MetricName.MTR_PRICE_CHANGE, `0%`);
      } else {
        this.log.info('invalid type for coingeckoEnergy');
      }

      if (typeof config.coingeckoBalance === 'string') {
        const price = await this.coingecko.http<any>('GET', 'simple/price', {
          query: { ids: `${config.coingeckoBalance}`, vs_currencies: 'usd', include_24hr_change: 'true' },
        });
        if (!!price && config.coingeckoBalance in price) {
          const m = price[config.coingeckoBalance];
          const percent20h = Math.floor(parseFloat(m.usd_24h_change) * 100) / 100;
          this.cache.update(MetricName.MTRG_PRICE, String(m.usd));
          this.cache.update(MetricName.MTRG_PRICE_CHANGE, `${percent20h}%`);
        }
      } else if (typeof config.coingeckoBalance === 'number') {
        this.cache.update(MetricName.MTRG_PRICE, String(config.coingeckoBalance));
        this.cache.update(MetricName.MTRG_PRICE_CHANGE, `0%`);
      } else {
        this.log.info('invalid type for coingeckoBalance');
      }
      this.log.info('done update market price');
    }
  }

  private async updateAuctionInfo(index: number, interval: number) {
    if (index % interval === 0) {
      this.log.info('update auction info');
      const present = await this.pos.getPresentAuction();
      const summaries = await this.pos.getAuctionSummaries();
      if (!!present) {
        await this.cache.update(MetricName.PRESENT_AUCTION, JSON.stringify(present));
      }
      if (!!summaries) {
        await this.cache.update(MetricName.AUCTION_SUMMARIES, JSON.stringify(summaries));
      }
      this.log.info('done update auction info');
    }
  }

  private async updateInvalidNodes(index: number, interval: number) {
    if (index % interval === 0) {
      this.log.info('update invalid nodes');
      try {
        let invalidNodes = [];
        const validators = await this.validatorRepo.findAll();
        await PromisePool.withConcurrency(10)
          .for(validators)
          .process(async (v, index, pool) => {
            let probe: Pos.ProbeInfo;
            const base = { name: v.name, ip: v.ipAddress, pubKey: v.pubKey };
            try {
              const result = await Promise.race<Pos.ProbeInfo | void>([
                this.pos.probe(v.ipAddress),
                sleep(PROBE_TIMEOUT),
              ]);
              if (!result) {
                throw new Error('timed out');
              }
              probe = result;
            } catch (e) {
              this.log.error({ err: e }, `could not probe ${v.ipAddress}`);
              invalidNodes.push({ ...base, reason: 'could not probe' });
              return;
            }
            this.log.info(`got probe for ${v.ipAddress}`);
            if (!(probe.isCommitteeMember && probe.isPacemakerRunning)) {
              invalidNodes.push({ ...base, reason: 'in committee without pacemaker running' });
              return;
            }
            if (!probe.pubkeyValid) {
              invalidNodes.push({ ...base, reason: 'invalid pubkey' });
              return;
            }
            if (probe.pow && probe.pow.PoolSize <= 1) {
              invalidNodes.push({ ...base, reason: `invalid powpool size ${probe.pow.PoolSize} <=1` });
              return;
            }
            const headHeight = Number(this.cache.get(MetricName.POS_BEST));
            if (probe.chain && probe.chain.bestBlock && headHeight - probe.chain.bestBlock.number > 3) {
              invalidNodes.push({ ...base, reason: 'fall behind' });
            }
          });

        await this.cache.update(MetricName.INVALID_NODES, JSON.stringify(invalidNodes));
        await this.cache.update(MetricName.INVALID_NODES_COUNT, `${invalidNodes.length}`);
      } catch (e) {
        this.log.info({ err: e }, 'could not query pos height');
      }
      this.log.info('done update invalid nodes');
    }
  }

  private async updateSlashingInfo(index: number, interval: number) {
    if (index % interval === 0) {
      this.log.info('update slashing info');
      let updated = false;
      const stats = await this.pos.getValidatorStats();
      if (!!stats) {
        updated = await this.cache.update(MetricName.STATS, JSON.stringify(stats));
      }
      if (updated) {
        try {
          await this.validatorRepo.emptyPenaltyPoints();
          const vs = await this.validatorRepo.findAll();
          let statMap = {};
          for (const stat of stats) {
            statMap[stat.address] = stat.totalPoints;
          }

          for (const v of vs) {
            let curTotalPoints = 0;
            if (v.address in statMap) {
              curTotalPoints = statMap[v.address];
            }
            if (v.totalPoints != curTotalPoints) {
              v.totalPoints = curTotalPoints;
              await v.save();
            }
          }
        } catch (e) {
          this.log.error({ err: e }, 'could not update penalty points');
        }
      }
      this.log.info('done update slashing info');
    }
  }

  private async updateStakingInfo(index: number, interval: number) {
    // update staking/slashing every 5 minutes
    if (index % interval === 0) {
      this.log.info('update staking info');
      let cUpdated = false,
        jUpdated = false,
        bUpdated = false,
        dUpdated = false,
        sUpdated = false;
      const candidates = await this.pos.getCandidates();
      const stakeholders = await this.pos.getStakeholders();
      if (!!candidates) {
        cUpdated = await this.cache.update(MetricName.CANDIDATES, JSON.stringify(candidates));
        await this.cache.update(MetricName.CANDIDATE_COUNT, `${candidates.length}`);
      }
      const buckets = await this.pos.getBuckets();
      if (!!buckets) {
        bUpdated = await this.cache.update(MetricName.BUCKETS, JSON.stringify(buckets));
        await this.cache.update(MetricName.BUCKET_COUNT, `${buckets.length}`);
      }

      const jailed = await this.pos.getJailed();
      if (!!jailed) {
        jUpdated = await this.cache.update(MetricName.JAILED, JSON.stringify(jailed));
        await this.cache.update(MetricName.JAILED_COUNT, `${jailed.length}`);
      }
      const delegates = await this.pos.getDelegates();
      if (!!delegates) {
        dUpdated = await this.cache.update(MetricName.DELEGATES, JSON.stringify(delegates));
        await this.cache.update(MetricName.DELEGATE_COUNT, `${delegates.length}`);
      }
      if (!!stakeholders) {
        sUpdated = await this.cache.update(MetricName.STAKEHOLDERS, JSON.stringify(stakeholders));
        await this.cache.update(MetricName.STAKEHOLDER_COUNT, `${stakeholders.length}`);
      }

      // if delegates/candidates/jailed all exists and any one of them got updated
      if (!!delegates && !!candidates && !!jailed && (jUpdated || dUpdated || cUpdated)) {
        const statsStr = this.cache.get(MetricName.STATS);
        let statMap = {};
        try {
          const stats = JSON.parse(statsStr);
          for (const stat of stats) {
            statMap[stat.address] = stat.totalPoints;
          }
        } catch (e) {
          this.log.error({ err: e }, 'could not parse stats');
        }

        let vs: { [key: string]: Validator } = {}; // address -> validator object
        for (const c of candidates) {
          if (!(c.address in vs)) {
            vs[c.address] = {
              ...c,
              address: c.address.toLowerCase(),
              ipAddress: c.ipAddr,
              status: ValidatorStatus.CANDIDATE,
              totalVotes: new BigNumber(c.totalVotes),
            };
          } else {
            // duplicate pubkey
            // TODO: handle this
          }
        }
        for (const d of delegates) {
          if (d.address in vs) {
            let can = vs[d.address];
            vs[d.address] = {
              ...can,
              address: can.address.toLowerCase(),
              delegateCommission: d.commission,
              distributors: d.distributors,
              votingPower: new BigNumber(d.votingPower),
              status: ValidatorStatus.DELEGATE,
            };
          } else {
            // delegate key is not in candiate list?
            // TODO: handle this
          }
        }

        for (const j of jailed) {
          if (j.address in vs) {
            let can = vs[j.address];
            vs[j.address] = {
              ...can,
              address: can.address.toLowerCase(),
              jailedTime: j.jailedTime,
              totalPoints: j.totalPoints,
              bailAmount: j.bailAmount,
              status: ValidatorStatus.JAILED,
            };
          } else {
            // jailed key not in candiate list ?
            // TODO: handle this
          }
        }

        for (const address in vs) {
          let totalPoints = 0;
          if (address in statMap) {
            totalPoints = statMap[address];
          }
          vs[address].totalPoints = totalPoints;
        }

        await this.validatorRepo.deleteAll();
        await this.validatorRepo.bulkInsert(...Object.values(vs));
      }

      // refresh bucket collection if updated
      if (bUpdated) {
        const buckets = await this.pos.getBuckets();
        const bkts: Bucket[] = [];

        for (const b of buckets) {
          bkts.push({
            ...b,
            value: new BigNumber(b.value),
            bonusVotes: new BigNumber(b.bonusVotes),
            totalVotes: new BigNumber(b.totalVotes),
          });
        }
        await this.bucketRepo.deleteAll();
        await this.bucketRepo.bulkInsert(...bkts);
      }
      this.log.info('done update staking info');
    }
  }

  private async updateCirculationAndRank(index: number, interval: number) {
    if (index % interval === 0) {
      // Update circulation
      this.log.info('update circulation and rank');
      const bucketStr = this.cache.get(MetricName.BUCKETS);
      const buckets = JSON.parse(bucketStr);
      let totalStaked = new BigNumber(0);
      let totalStakedLocked = new BigNumber(0);
      for (const b of buckets) {
        if (b.owner in LockedMeterGovAddrs) {
          totalStakedLocked = totalStakedLocked.plus(b.totalVotes);
        }
        totalStaked = totalStaked.plus(b.totalVotes);
      }
      await this.cache.update(MetricName.MTRG_STAKED, totalStaked.toFixed(0));
      await this.cache.update(MetricName.MTRG_STAKED_LOCKED, totalStakedLocked.toFixed(0));

      const accts = await this.accountRepo.findAll();
      let mtrCirculation = new BigNumber(0);
      let mtrgCirculation = new BigNumber(0);
      let mtrgTotalSupply = new BigNumber(0);
      let mtrTotalSupply = new BigNumber(0);

      for (const acct of accts) {
        // add mtr to circulation
        if (!(acct.address in LockedMeterAddrs)) {
          if (acct.mtrBalance.isGreaterThan(0)) {
            mtrCirculation = mtrCirculation.plus(acct.mtrBalance);
          }
          if (acct.mtrBounded && acct.mtrBounded.isGreaterThan(0)) {
            mtrCirculation = mtrCirculation.plus(acct.mtrBounded);
          }
        }

        // add mtr to total supply
        if (acct.mtrBalance.isGreaterThan(0)) {
          mtrTotalSupply = mtrTotalSupply.plus(acct.mtrBalance);
        }
        if (acct.mtrBounded && acct.mtrBounded.isGreaterThan(0)) {
          mtrTotalSupply = mtrTotalSupply.plus(acct.mtrBounded);
        }

        // add mtrg to circulation
        if (!(acct.address in LockedMeterGovAddrs)) {
          if (acct.mtrgBalance.isGreaterThan(0)) {
            mtrgCirculation = mtrgCirculation.plus(acct.mtrgBalance);
          }
          if (acct.mtrgBounded && acct.mtrgBounded.isGreaterThan(0)) {
            mtrgCirculation = mtrgCirculation.plus(acct.mtrgBounded);
          }
        }

        // add mtrg to total supply
        if (!(acct.address in SubFromTotalSupply)) {
          if (acct.mtrgBalance.isGreaterThan(0)) {
            mtrgTotalSupply = mtrgTotalSupply.plus(acct.mtrgBalance);
          }
          if (acct.mtrgBounded && acct.mtrgBounded.isGreaterThan(0)) {
            mtrgTotalSupply = mtrgTotalSupply.plus(acct.mtrgBounded);
          }
        }
      }
      await this.cache.update(MetricName.MTR_CIRCULATION, mtrCirculation.toFixed());
      await this.cache.update(MetricName.MTRG_CIRCULATION, mtrgCirculation.toFixed());
      await this.cache.update(MetricName.MTRG_TOTALSUPPLY, mtrgTotalSupply.toFixed());
      await this.cache.update(MetricName.MTR_TOTALSUPPLY, mtrTotalSupply.toFixed());

      // Update rank information
      const mtrRanked = accts.sort((a, b) => {
        let aTotalMTR = a.mtrBalance;
        let bTotalMTR = b.mtrBalance;
        if (a.mtrBounded) {
          aTotalMTR = aTotalMTR.plus(a.mtrBounded);
        }
        if (b.mtrBounded) {
          bTotalMTR = bTotalMTR.plus(b.mtrBounded);
        }
        return aTotalMTR.isGreaterThan(bTotalMTR) ? -1 : 1;
      });

      for (const [i, a] of mtrRanked.entries()) {
        if (a.mtrRank !== i + 1) {
          await this.accountRepo.updateMTRRank(a.address, i + 1);
        }
      }

      const mtrgRanked = accts.sort((a, b) => {
        let aTotalMTRG = a.mtrgBalance;
        let bTotalMTRG = b.mtrgBalance;
        if (a.mtrgBounded) {
          aTotalMTRG = aTotalMTRG.plus(a.mtrgBounded);
        }
        if (b.mtrgBounded) {
          bTotalMTRG = bTotalMTRG.plus(b.mtrgBounded);
        }
        return aTotalMTRG.isGreaterThan(bTotalMTRG) ? -1 : 1;
      });
      for (const [i, a] of mtrgRanked.entries()) {
        if (a.mtrgRank !== i + 1) {
          await this.accountRepo.updateMTRGRank(a.address, i + 1);
        }
      }
      this.log.info('done update circulation and rank');
    }
  }

  private async updateVerifiedContracts(index: number, interval: number) {
    if (index % interval === 0) {
      this.log.info('update verified contract');
      const conf = GetNetworkConfig(this.network);
      const chainId = conf.chainId;
      if (!chainId) {
        this.log.info('could not get correct chainId to check verified contracts');
        return;
      }

      const res = await axios.get(`${SOURCIFY_SERVER_API}/files/contracts/${chainId}`);
      const addresses = res.data.full.map((s) => s.toLowerCase()).concat(res.data.partial.map((s) => s.toLowerCase()));
      this.log.info(addresses, 'sourcify verified addresses');
      const unverified = await this.contractRepo.findUnverifiedContracts(addresses);
      this.log.info(unverified, 'known unverified: ');

      for (const c of unverified) {
        const addr = toChecksumAddress(c.address);
        const fileRes = await axios.get(`${SOURCIFY_SERVER_API}/files/any/${chainId}/${addr}`);
        const { data } = fileRes;
        c.verified = true;
        c.status = data.status;

        let contractFiles: ContractFile[] = [];
        for (const file of data.files) {
          contractFiles.push({
            ...file,
            address: c.address,
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

            this.log.info('fragments: ', fragments);

            await this.abiFragmentRepo.bulkUpsert(...fragments);
          }
        }
        this.log.info(
          'contract files: ',
          contractFiles.map((c) => ({ name: c.name, path: c.path }))
        );
        await this.contractFileRepo.bulkUpsert(...contractFiles);
        if (!c.tokensCount) {
          c.tokensCount = new BigNumber(0);
        }
        if (!c.transfersCount) {
          c.transfersCount = new BigNumber(0);
        }
        if (!c.holdersCount) {
          c.holdersCount = new BigNumber(0);
        }

        await c.save();
        const relateds = await this.contractRepo.findUnverifiedContractsWithCreationInputHash(c.creationInputHash);
        for (const rc of relateds) {
          if (rc.address === c.address) {
            continue;
          }
          console.log(
            `found related existing contracts sharing the same creationInputHash, verify now for ${rc.address}`
          );
          rc.verified = true;
          rc.status = 'match';
          rc.verifiedFrom = c.address;
          await rc.save();
        }
      }
      this.log.info('done update verified contract');
    }
  }

  private async adjustTotalSupply(index: number, interval: number) {
    if (index % interval === 0) {
      const contracts = await this.contractRepo.findByType(ContractType.ERC20);
      console.log(`start checking ${contracts.length} contracts...`);
      let updateCount = 0;
      for (const p of contracts) {
        try {
          const ret = await this.pos.explain(
            { clauses: [{ to: p.address, value: '0x0', data: ERC20.totalSupply.encode(), token: Token.MTR }] },
            'best'
          );
          const decoded = ERC20.totalSupply.decode(ret[0].data);
          const amount = decoded['0'];
          let updated = false;
          if (!p.totalSupply.isEqualTo(amount)) {
            console.log(`Update total supply for token ${p.symbol} from ${p.totalSupply.toFixed(0)} to ${amount}`);
            p.totalSupply = new BigNumber(amount);
            updated = true;
          }
          if (updated) {
            updateCount++;
            await p.save();
          }
        } catch (e) {
          console.log('ignore error: ', e);
        }
      }
      console.log(`Updated ${updateCount} token contracts`);
    }
  }

  public async loop() {
    let index = 0;

    const config = GetNetworkConfig(this.network);
    for (;;) {
      try {
        if (this.shutdown) {
          throw new InterruptedError();
        }
        await sleep(SAMPLING_INTERVAL);

        // update verified contracts from sourcify
        if (config.sourcifyEnabled) {
          await this.updateVerifiedContracts(index, every4h);
        }

        if (config.powEnabled) {
          // update pow best, difficulty && hps
          await this.updatePowInfo(index, every5m);

          // update bitcoin info every 5 minutes
          await this.updateBitcoinInfo(index, every20m);
        }

        // update pos best, kblock & seq
        await this.updatePosInfo(index, every);

        // check network, if halt for 2 mins, send alert
        await this.alertIfNetworkHalt(index, every2m);

        // update price/change every 10 minutes
        await this.updateMarketPrice(index, every5m);

        // update circulation
        await this.updateCirculationAndRank(index, every4h);

        // update candidate/delegate/jailed info
        await this.updateStakingInfo(index, every5m);

        // update slashing penalty points
        await this.updateSlashingInfo(index, every5m);

        // update network status
        await this.updateInvalidNodes(index, every5m);

        // update auction info
        if (config.auctionEnabled) {
          await this.updateAuctionInfo(index, every5m);
        }

        // update validator rewards
        await this.updateValidatorRewards(index, every5m);

        // adjust total supply
        await this.adjustTotalSupply(index, every6h);

        index = (index + 1) % every24h; // clear up 24hours
      } catch (e) {
        if (!(e instanceof InterruptedError)) {
          this.log.error({ err: e }, `error in loop`);
        } else {
          if (this.shutdown) {
            this.ev.emit('closed');
            break;
          }
        }
      }
    }
  }
}

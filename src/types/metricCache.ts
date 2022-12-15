import { MetricRepo } from '../repo';

import { MetricName, MetricType } from '../const';

export const METRIC_DEFS = [
  { key: MetricName.DIFFICULTY, type: MetricType.BIGNUM, default: '1' },
  { key: MetricName.HASHRATE, type: MetricType.BIGNUM, default: '0' },
  { key: MetricName.EPOCH, type: MetricType.NUM, default: '0' },
  { key: MetricName.SEQ, type: MetricType.NUM, default: '0' },
  { key: MetricName.KBLOCK, type: MetricType.NUM, default: '0' },
  { key: MetricName.POS_BEST, type: MetricType.NUM, default: '0' },
  { key: MetricName.POW_BEST, type: MetricType.NUM, default: '0' },
  { key: MetricName.COST_PARITY, type: MetricType.NUM, default: '0' },
  { key: MetricName.REWARD_PER_DAY, type: MetricType.NUM, default: '0' },
  { key: MetricName.COEF, type: MetricType.NUM, default: '0.053' },

  // Price
  { key: MetricName.MTRG_PRICE, type: MetricType.NUM, default: '1' },
  { key: MetricName.MTRG_PRICE_CHANGE, type: MetricType.STRING, default: '0%' },
  { key: MetricName.MTR_PRICE, type: MetricType.NUM, default: '0.5' },
  { key: MetricName.MTR_PRICE_CHANGE, type: MetricType.STRING, default: '0%' },

  // Bitcoin
  { key: MetricName.BTC_PRICE, type: MetricType.NUM, default: '1' },
  { key: MetricName.BTC_HASHRATE, type: MetricType.NUM, default: '1' },

  // Circulation
  { key: MetricName.MTR_CIRCULATION, type: MetricType.STRING, default: '0' },
  { key: MetricName.MTRG_CIRCULATION, type: MetricType.STRING, default: '0' },
  { key: MetricName.MTRG_TOTALSUPPLY, type: MetricType.STRING, default: '0' },

  // Staking
  { key: MetricName.CANDIDATES, type: MetricType.STRING, default: '[]' },
  { key: MetricName.DELEGATES, type: MetricType.STRING, default: '[]' },
  { key: MetricName.BUCKETS, type: MetricType.STRING, default: '[]' },
  { key: MetricName.JAILED, type: MetricType.STRING, default: '[]' },
  { key: MetricName.CANDIDATE_COUNT, type: MetricType.NUM, default: '0' },
  { key: MetricName.DELEGATE_COUNT, type: MetricType.NUM, default: '0' },
  { key: MetricName.BUCKET_COUNT, type: MetricType.NUM, default: '0' },
  { key: MetricName.JAILED_COUNT, type: MetricType.NUM, default: '0' },

  // Validator rewards
  { key: MetricName.VALIDATOR_REWARDS, type: MetricType.STRING, default: '[]' },

  // Stake holder
  { key: MetricName.STAKEHOLDER_COUNT, type: MetricType.NUM, default: '0' },
  { key: MetricName.STAKEHOLDERS, type: MetricType.STRING, default: '0' },

  // Auction
  { key: MetricName.PRESENT_AUCTION, type: MetricType.STRING, default: '{}' },
  { key: MetricName.AUCTION_SUMMARIES, type: MetricType.STRING, default: '[]' },

  // Slashing
  { key: MetricName.STATS, type: MetricType.STRING, default: '[]' },

  // Invalid Nodes
  { key: MetricName.INVALID_NODES, type: MetricType.STRING, default: '[]' },
  { key: MetricName.INVALID_NODES_COUNT, type: MetricType.NUM, default: '0' },

  // Staked
  { key: MetricName.MTRG_STAKED, type: MetricType.STRING, default: '0' },
  { key: MetricName.MTRG_STAKED_LOCKED, type: MetricType.STRING, default: '0' },
  { key: MetricName.TX_FEE_BENEFICIARY, type: MetricType.STRING, default: '0x' },
];

export class MetricCache {
  private map: { [key: string]: string } = {};
  private metricRepo = new MetricRepo();

  public async init() {
    const metrics = await this.metricRepo.findByKeys(METRIC_DEFS.map((item) => item.key as string));
    for (const m of metrics) {
      this.map[m.key] = m.value;
    }
    for (const m of METRIC_DEFS) {
      if (!(m.key in this.map)) {
        this.map[m.key] = m.default;
        await this.metricRepo.create(m.key, m.default, m.type);
      }
    }
  }

  public async update(key: string, value: string): Promise<boolean> {
    if (key in this.map && value !== undefined) {
      if (value != this.map[key]) {
        this.map[key] = value;
        console.log(`UPDATE ${key} with ${value}`);
        await this.metricRepo.update(key, value);
        return true;
      }
    }
    return false;
  }

  public get(key: string) {
    if (key in this.map) {
      return this.map[key];
    } else {
      for (const m of METRIC_DEFS) {
        if (m.key === key) {
          return m.default;
        }
      }
    }
    return '';
  }
}

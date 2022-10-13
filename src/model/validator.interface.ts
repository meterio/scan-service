import BigNumber from 'bignumber.js';

import { ValidatorStatus } from '../const';

export interface Distributor {
  address: string;
  shares: number;
}

export interface Validator {
  pubKey: string; // primary key

  // updatable attributes
  name: string;
  address: string;
  ipAddress: string;
  port: number;
  commission: number; // candidate commission （unit: shannon, aka 1e9)

  status: ValidatorStatus;

  // candidate
  totalVotes: BigNumber;
  buckets: string[];

  // jailed fields
  totalPoints?: number;
  bailAmount?: string;
  jailedTime?: number;
  infractions?: string;

  // only delegate has this field
  delegateCommission?: number; // delegate commission （unit: shannon, aka 1e9)
  votingPower?: BigNumber;
  distributors?: Distributor[];
}

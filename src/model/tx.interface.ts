import BigNumber from 'bignumber.js';

import { Token } from '../const';
import { BlockConcise } from './blockConcise.interface';

export interface PosEvent {
  address: string;
  topics: string[];
  data: string;
  overallIndex?: number;
}

export interface PosTransfer {
  sender: string;
  recipient: string;
  amount: string;
  token: number;
  overallIndex?: number;
}

export interface TxOutput {
  contractAddress: string | null;
  events: PosEvent[];
  transfers: PosTransfer[];
}

export interface VMError {
  error: string;
  reason: string | null;
  clauseIndex: number;
}

export interface Clause {
  to: string | null;
  value: BigNumber;
  token: Token;
  data: string;
}

export interface TraceOutput {
  json: string;
  clauseIndex: number;
}

export interface Transfer {
  sender: string;
  recipient: string;
  amount: BigNumber;
  token: number;
}

export interface Tx {
  hash: string;

  block: BlockConcise;
  txIndex: number;

  chainTag: number;
  blockRef: string;
  expiration: number;
  gasPriceCoef: number;
  gas: number;
  nonce: string;
  dependsOn: string | null;
  origin: string;

  clauses: Clause[];
  traces: TraceOutput[];
  clauseCount: number;
  size: number;

  // receipt
  gasUsed: number;
  gasPayer: string;
  paid: BigNumber;
  reward: BigNumber;
  reverted: boolean;
  outputs: TxOutput[];
  vmError: VMError;

  // virtual
  signature?: string;

  toSummary?(): object;
}

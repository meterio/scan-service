import BigNumber from 'bignumber.js';

import { BlockType } from '../const';

export interface CommitteeMember {
  index: number;
  netAddr: string;
  pubKey: string;
}

export interface QC {
  qcHeight: number;
  qcRound: number;
  voterBitArrayStr: string;
  epochID: number;
}

export interface PowInfo {
  hash: string;
  prevBlock: string;
  beneficiary: string;
  height: number;
}

export interface Block {
  // basics
  hash: string;
  number: number;
  parentID: string;
  timestamp: number;
  gasLimit: number;
  gasUsed: number;
  txsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  signer: string;
  beneficiary: string;
  size: number;
  nonce: string;
  lastKBlockHeight: number;
  committee: CommitteeMember[];
  qc: QC;

  // calculated
  txHashs: string[];
  totalScore: number;
  txCount: number;
  score: number;
  reward: BigNumber;
  actualReward: BigNumber;
  gasChanged: number;
  blockType: BlockType;

  epoch: number;
  kblockData: string[];
  powBlocks?: PowInfo[];
  toSummary?(): object;
}

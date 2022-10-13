import BigNumber from 'bignumber.js';

export interface PowBlock {
  hash: string;
  confirmations: number;
  strippedSize: number;
  size: number;
  weight: number;
  height: number;
  version: number;
  versionHex: string;
  merkleRoot: string;
  tx: string[];
  time: number;
  medianTime: BigNumber;
  nonce: BigNumber;
  bits: string;
  difficulty: BigNumber;
  chainWork: string;
  nTx: number;
  previousBlockHash: string;
  nextBlockHash: string;

  beneficiary?: string;
}

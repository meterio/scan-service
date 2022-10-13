import BigNumber from 'bignumber.js';

export interface PowIn {
  hash: string;
  index: number;
  script: string;
  sequence: number;
  witness: any[];
}

export interface PowOut {
  value: number;
  script: string;
}

export interface PowTx {
  hash: string;
  version: number;
  locktime: number;
  ins: PowIn[];
  outs: PowOut[];
}

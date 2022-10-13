import { BigNumber } from 'bignumber.js';
import { Request } from 'express';

import { LIMIT_WINDOW, UNIT_WEI } from '../const';

export const MAX_BLOCK_PROPOSERS = 101;
export const BLOCK_INTERVAL = 10;

export const blockIDtoNum = (blockID: string) => {
  if (typeof blockID === 'string' && !/^0x[0-9a-fA-f]{64}$/i.test(blockID)) {
    throw new Error('bytes32 required as param but got: ' + blockID);
  }

  return parseInt(blockID.slice(0, 10), 16);
};

export const bufferToHex = (val: Buffer) => {
  return '0x' + val.toString('hex');
};

export const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const displayID = (blockID: string) => {
  return `${blockIDtoNum(blockID)}...${blockID.slice(58)}`;
};

export const sanitizeHex = (val: string) => {
  if (val.startsWith('0x')) {
    val = val.slice(2);
  }
  if (val.length % 2) {
    val = '0' + val;
  }
  return val;
};

export const hexToBuffer = (val: string) => {
  if (!/^0x[0-9a-fA-f]+/i.test(val)) {
    throw new Error('hex string required as param but got: ' + val);
  }

  return Buffer.from(sanitizeHex(val), 'hex');
};

export const isBytes32 = (val: string) => {
  return /^0x[0-9a-fA-f]{64}/i.test(val);
};

export const isNumString = (val: string) => {
  return /^\d+$/.test(val);
};

export const commaSeparated = (x: number | string) => {
  const tgt = x.toString();
  const items = tgt.split('.');
  return items[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (items.length >= 2 ? '.' + items[1] : '');
};

export const fromWei = (val: string | number | BigNumber, precision = -1) => {
  let p = undefined;
  if (precision >= 0) {
    p = precision;
  }
  const num = new BigNumber(val).dividedBy(UNIT_WEI).toFixed(p);
  return commaSeparated(num);
};

export const toWei = (val: string | number | BigNumber) => {
  return new BigNumber(val).times(UNIT_WEI).toFixed();
};

class Metric {
  private duration = BigInt(0);
  constructor(readonly name: string) {}
  public start() {
    const s = process.hrtime.bigint();
    return () => {
      this.duration += process.hrtime.bigint() - s;
    };
  }
  public stats() {
    console.log(`Task[${this.name}] duration: ${this.duration / BigInt(1e6)}ms`);
    this.duration = BigInt(0);
  }
}

export class InterruptedError extends Error {
  constructor() {
    super('interrupted');
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, InterruptedError.prototype);
  }
}

export class WaitNextTickError extends Error {
  constructor() {
    super();
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, WaitNextTickError.prototype);
  }
}

export const formalizePageAndLimit = (page?: number, limit?: number) => {
  // convert page (1 .. n) to (0 .. n-1)
  if (!!page && page > 0) {
    page = page - 1;
  } else {
    page = 0;
  }
  if (!limit) {
    limit = LIMIT_WINDOW;
  }
  return { page, limit };
};

export const extractPageAndLimitQueryParam = (req: Request) => {
  let page = 1,
    limit = LIMIT_WINDOW;

  // try get page param
  try {
    const pageParam = Number(req.query.page);
    page = pageParam > 1 ? pageParam : page;
  } catch (e) {
    // ignore
    console.log('Invalid page param: ', req.query.page);
  }

  // try get limit query param
  try {
    const limitParam = Number(req.query.limit);
    limit = limitParam > 0 ? limitParam : limit;
  } catch (e) {
    // ignore
    console.log('Invalid limit param: ', req.query.limit);
  }
  return { page, limit };
};

WaitNextTickError.prototype.name = 'WaitNextTickError';
InterruptedError.prototype.name = 'InterruptedError';

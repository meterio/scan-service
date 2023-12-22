import { BigNumber } from 'bignumber.js';
import { ScriptEngine } from '@meterio/devkit';
import { Network, UNIT_WEI } from '../const';
import commander from 'commander';

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

export const sleep = (ms: number): Promise<void> => {
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
export class InterruptedError extends Error {
  constructor() {
    super('interrupted');
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, InterruptedError.prototype);
  }
}

export const fromWei = (val: string | number | BigNumber, precision: number | undefined = undefined) => {
  return new BigNumber(val).dividedBy(UNIT_WEI).toFixed(precision);
};

export const toWei = (val: string | number | BigNumber) => {
  return new BigNumber(val).times(UNIT_WEI).toFixed();
};

export class WaitNextTickError extends Error {
  constructor() {
    super();
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, WaitNextTickError.prototype);
  }
}

export const isHex = (str: string): boolean => {
  return /^[a-f0-9]+$/i.test(str.toLowerCase());
};

export const isTraceable = (data: string) => {
  // has data and not script engine data
  return data.length > 0 && data !== '0x' && !ScriptEngine.IsScriptEngineData(data) && !data.startsWith('0x64617461');
};

WaitNextTickError.prototype.name = 'WaitNextTickError';
InterruptedError.prototype.name = 'InterruptedError';

const parseNetwork = (value) => {
  let network: Network;
  switch (value) {
    case 'main':
    case 'metermain':
      network = Network.MainNet;
      break;
    case 'test':
    case 'metertest':
      network = Network.TestNet;
      break;
    case 'verse-test':
      network = Network.VerseTest;
      break;
    case 'verse-main':
      network = Network.VerseMain;
      break;
    default:
      throw new commander.InvalidArgumentError('Not a valid network');
  }
  return network;
};

export const runWithOptions = async (runAsync) => {
  const program = new commander.Command();
  program
    .command('run')
    .requiredOption('-n, --network <network>', 'Network to use', parseNetwork)
    .option('-s, --standby', 'Standby mode')
    .action(runAsync);
  await program.parseAsync(process.argv);
};

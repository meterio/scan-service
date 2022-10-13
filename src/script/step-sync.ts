#!/usr/bin/env node
require('../utils/validateEnv');
import { Network } from '../const';
import { connectDB, disconnectDB } from '../utils/db';
import { PosCMD } from '../cmd/pos.cmd';
import { Net, Pos, runWithOptions } from '../utils';

// other imports

const runAsync = async (options) => {
  const { network, standby } = options;
  const blockNum = 23022537;
  await connectDB(network, standby);
  console.log('process blockNum: ', blockNum);
  const cmd = new PosCMD(network);
  const pos = new Pos(network);
  const blk = await pos.getBlock(blockNum, 'expanded');
  await cmd.processBlock(blk);
  await disconnectDB();
  cmd.printCache();
};

(async () => {
  await runWithOptions(runAsync);
})();

#!/usr/bin/env node
require('../utils/validateEnv');

import { connectDB, disconnectDB } from '../utils/db';
import { PosCMD } from '../cmd/pos.cmd';
import { Pos, runWithOptions } from '../utils';

const runAsync = async (options) => {
  // const blockQueue = new BlockQueue('block');
  const { network, standby } = options;
  let shutdown = false;
  const blockNum = 27896;
  const cmd = new PosCMD(network);
  const posREST = new Pos(network);
  const blk = await posREST.getBlock(blockNum, 'expanded');
  console.log(`Process block ${blockNum} with pos cmd`);

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
  signals.forEach((sig) => {
    process.on(sig, async (s) => {
      process.stdout.write(`Got signal: ${s}, terminating...\n`);
      if (!shutdown) {
        shutdown = true;
        await disconnectDB();
        await cmd.stop();
        process.exit(0);
      }
    });
  });

  await connectDB(network, standby);
  const result = await cmd.processBlock(blk);
  console.log(result);
};

(async () => {
  // const blockQueue = new BlockQueue('block');
  try {
    await runWithOptions(runAsync);
    await disconnectDB();
  } catch (e) {
    console.log(`process error: ${e.name} ${e.message} - ${e.stack}`);
    process.exit(-1);
  }
})();

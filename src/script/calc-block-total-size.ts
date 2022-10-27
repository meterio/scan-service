#!/usr/bin/env node
require('../utils/validateEnv');

import { BlockRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';

import { checkNetworkWithDB, runWithOptions } from '../utils';
import BigNumber from 'bignumber.js';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const blockRepo = new BlockRepo();
  await checkNetworkWithDB(network);

  //   const posHead = await headRepo.findByKey('pos');
  //   const best = posHead.num;
  const best = 25000000;
  const step = 100000;

  let totalSize = new BigNumber(0);
  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const blks = await blockRepo.findByNumberInRange(start, end);
    for (const b of blks) {
      totalSize = totalSize.plus(b.size);
    }
    console.log(`total size ${totalSize} at block ${end}`);
  }
  console.log(`total size: ${totalSize.div(1024).div(1024).div(1024).toFixed(2)} GB`);
};

(async () => {
  try {
    await runWithOptions(runAsync);
    await disconnectDB();
  } catch (e) {
    console.log(`error: ${e.name} ${e.message} - ${e.stack}`);
    process.exit(-1);
  }
})();

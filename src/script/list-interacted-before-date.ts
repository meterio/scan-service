#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, TxRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import * as fs from 'fs';

import { checkNetworkWithDB, runWithOptions } from '../utils';

const cutOffTimestamp = 1672560000;

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const txRepo = new TxRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 10000;
  const start = 0;

  let addrMap = {};
  for (let i = start; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const txs = await txRepo.findInRange(start, end);

    console.log(`scanning txs in blocks [${start}, ${end}]`);
    for (const tx of txs) {
      if (tx.block.timestamp > cutOffTimestamp) {
        break;
      }
      if (!(tx.origin in addrMap)) {
        addrMap[tx.origin] = 0;
      }
      addrMap[tx.origin] += 1;
    }
  }
  let validAddrs = [];
  for (const addr in addrMap) {
    const count = addrMap[addr];
    if (count >= 5) {
      validAddrs.push(addr);
    }
  }
  fs.writeFileSync('interacted.txt', validAddrs.join('\n'));
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

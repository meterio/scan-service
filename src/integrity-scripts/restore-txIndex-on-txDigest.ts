#!/usr/bin/env node
require('../utils/validateEnv');

import { connectDB, disconnectDB } from '../utils/db';
import { HeadRepo, TxDigestRepo, TxRepo } from '../repo';
import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const txDigestRepo = new TxDigestRepo();
  const txRepo = new TxRepo();

  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 1000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const digests = await txDigestRepo.findInRangeWithoutTxIndex(start, end);
    console.log(`searching digests without txIndex from ${start} to ${end}`);
    for (const d of digests) {
      const tx = await txRepo.findByHash(d.txHash);
      if (tx) {
        if (d.txIndex !== tx.txIndex) {
          console.log(`update txIndex from ${d.txIndex} to ${tx.txIndex}`);
          d.txIndex = tx.txIndex;
          await d.save();
        }
      }
    }
  }
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

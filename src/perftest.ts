#!/usr/bin/env node
require('./utils/validateEnv');

import { Network } from './const';
import { connectDB, disconnectDB } from './utils/db';
import { TxDigestRepo } from './repo';

(async () => {
  console.time('connect');
  await connectDB(Network.MainNet, false);
  console.timeEnd('connect');

  const txDigestRepo = new TxDigestRepo();
  await txDigestRepo.paginateByAccount('0x9e12b67111c0049f9e3f208fd9e1c9598c152e37', 0, 30);

  console.time('disconnect');
  await disconnectDB();
  console.timeEnd('disconnect');
})();

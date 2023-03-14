#!/usr/bin/env node
require('../utils/validateEnv');

import { connectDB, disconnectDB } from '../utils/db';
import { AccountRepo } from '../repo';
import { runWithOptions } from '../utils';
import * as fs from 'fs';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const accountRepo = new AccountRepo();
  const accts = await accountRepo.findAll();
  const addrs = accts.map((a) => a.address);
  fs.writeFileSync('./addrs.txt', addrs.join('\n'));
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

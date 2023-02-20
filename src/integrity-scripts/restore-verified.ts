#!/usr/bin/env node
require('../utils/validateEnv');

import { ContractRepo, HeadRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { Keccak } from 'sha3';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const contractRepo = new ContractRepo();
  const headRepo = new HeadRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;
    const verified = await contractRepo.findVerifiedContractsInRange(start, end);
    for (const v of verified) {
      if (!v.codeHash) {
        continue;
      }
      const unv = await contractRepo.findUnverifiedContractsWithCodeHash(v.codeHash);
      for (const u of unv) {
        u.verified = true;
        u.status = 'match';
        u.verifiedFrom = v.address;
        console.log(`found ${u.address} could be verified from ${v.address}`);
        await u.save();
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

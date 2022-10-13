#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, ContractRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';

import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const contractRepo = new ContractRepo();
  await checkNetworkWithDB(network);

  const head = await headRepo.findByKey('pos');
  const best = head.num;
  const step = 100000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const verified = await contractRepo.findVerifiedContractsInRange(start, end);
    console.log(`searching for verified contracts in blocks [${start}, ${end}]`);
    for (const vc of verified) {
      console.log(`analyzing verified contract ${vc.address}`);
      const relateds = await contractRepo.findUnverifiedContractsWithCreationInputHash(vc.creationInputHash);
      console.log(`found ${relateds.length} contracts with the same creationInputHash: ${vc.creationInputHash}`);
      for (const rc of relateds) {
        if (rc.address === vc.address) {
          continue;
        }
        console.log(`verify related contract: ${rc.address}`);
        rc.verified = true;
        rc.status = 'match';
        rc.verifiedFrom = vc.address;
        await rc.save();
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

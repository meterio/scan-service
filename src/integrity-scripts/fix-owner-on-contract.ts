#!/usr/bin/env node
require('../utils/validateEnv');

import { ContractRepo, HeadRepo, LogEventRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { EIP173 } from '@meterio/devkit';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const contractRepo = new ContractRepo();
  const eventRepo = new LogEventRepo();
  const headRepo = new HeadRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const step = 10000;
  const best = pos.num; // pos.num;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;
    console.log(`filter events in [${start}, ${end}]`);
    const events = await eventRepo.findByTopic0InBlockRangeSortAsc(EIP173.OwnershipTransferred.signature, start, end);
    for (const evt of events) {
      const decoded = EIP173.OwnershipTransferred.decode(evt.data, evt.topics);
      const { previousOwner, newOwner } = decoded;
      const contract = await contractRepo.findByAddress(evt.address);
      console.log(`transfer ownership found for ${evt.address} from ${previousOwner} to ${newOwner}`);
      if (!contract) {
        continue;
      }
      if (!contract.owner || contract.owner === previousOwner.toLowerCase()) {
        contract.owner = newOwner.toLowerCase();
        await contract.save();
        console.log(`transfer contract ${contract.address} from ${previousOwner} to ${newOwner}`);
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

#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, LogEventRepo, ContractRepo } from '../repo';
import { UpgradedEvent, BeaconUpgradedEvent, AdminChangedEvent } from '../const';
import { connectDB, disconnectDB } from '../utils/db';

import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const evtRepo = new LogEventRepo();
  const contractRepo = new ContractRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    console.log(`searching for ERC1967 events in blocks [${start}, ${end}]`);
    const upgradedEvts = await evtRepo.findByTopic0InBlockRangeSortAsc(UpgradedEvent.signature, start, end);
    const beaconUpgradedEvts = await evtRepo.findByTopic0InBlockRangeSortAsc(BeaconUpgradedEvent.signature, start, end);
    const adminChangedEvts = await evtRepo.findByTopic0InBlockRangeSortAsc(AdminChangedEvent.signature, start, end);

    for (const e of upgradedEvts) {
      const decoded = UpgradedEvent.decode(e.data, e.topics);
      let c = await contractRepo.findByAddress(e.address);
      if (c && !c.isProxy) {
        c.isProxy = true;
        c.proxyType = 'ERC-1967';
        await c.save();
      }
      if (c && c.implAddr != decoded.implementation) {
        c.prevImplAddr = c.implAddr;
        c.implAddr = decoded.implementation;
        console.log(`update impl for proxy ${e.address} to ${c.implAddr}`);
        await c.save();
      }
    }

    for (const e of beaconUpgradedEvts) {
      const decoded = BeaconUpgradedEvent.decode(e.data, e.topics);
      let c = await contractRepo.findByAddress(e.address);
      if (c && c.beaconAddr != decoded.beacon) {
        c.beaconAddr = decoded.beacon;
        console.log(`update beacon for proxy ${e.address} to ${c.beaconAddr}`);
        await c.save();
      }
    }

    for (const e of adminChangedEvts) {
      const decoded = AdminChangedEvent.decode(e.data, e.topics);
      let c = await contractRepo.findByAddress(e.address);
      if (c && c.adminAddr != decoded.newAdmin) {
        c.adminAddr = decoded.newAdmin;
        console.log(`update admin for proxy ${e.address} to ${c.adminAddr}`);
        await c.save();
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

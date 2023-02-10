#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, ContractRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';

import { checkNetworkWithDB, runWithOptions } from '../utils';
const Minimal_Proxy = '363d3d373d3d3d363d73bebebebebebebebebebebebebebebebebebebebe5af43d82803e903d91602b57fd5bf3';
const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const contractRepo = new ContractRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    console.log(`searching for contracts first seen in blocks [${start}, ${end}]`);
    const contracts = await contractRepo.findFirstSeenInRange(start, end);

    for (const c of contracts) {
      const codeHex = c.code.replace('0x', '');
      if (codeHex.startsWith(Minimal_Proxy.substring(0, 20)) && codeHex.endsWith(Minimal_Proxy.substring(60))) {
        // is minimal proxy
        c.isProxy = true;
        c.proxyType = 'ERC-1167';
        c.implAddr = '0x' + codeHex.substring(20, 60);
        console.log({ implAddr: c.implAddr }, `identified contract ${c.address} as min proxy`);
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

#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, ContractRepo, TxRepo } from '../repo';
import { DeployStatus } from '../const';
import { connectDB, disconnectDB } from '../utils/db';

import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const contractRepo = new ContractRepo();
  const txRepo = new TxRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    console.log(`searching for SELFDESTRUCT tx in blocks [${start}, ${end}]`);
    const txs = await txRepo.findByTraceInRange(/SELFDESTRUCT/, start, end);

    let destructedContracts = {};
    for (const tx of txs) {
      for (const trace of tx.traces) {
        const tracer = JSON.parse(trace.json);
        let q = [tracer];
        while (q.length) {
          const node = q.shift();
          if (node.calls) {
            for (const c of node.calls) {
              q.push(c);
            }
          }
          if (node.type === 'SELFDESTRUCT') {
            destructedContracts[node.from] = { txHash: tx.hash, block: tx.block };
          }
        }
      }

      if (Object.keys(destructedContracts).length > 0) {
        for (const addr in destructedContracts) {
          const { txHash, block } = destructedContracts[addr];
          let ec = await contractRepo.findByAddress(addr);
          if (ec) {
            ec.destructBlock = block;
            ec.destructTxHash = txHash;
            if (ec.firstSeen.number > block.number) {
              ec.deployStatus = DeployStatus.ReDeployed;
            } else {
              ec.deployStatus = DeployStatus.SelfDestructed;
            }
            console.log(`found destructed contract: ${ec.address}`);
            await ec.save();
          }
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

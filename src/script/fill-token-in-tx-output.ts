#!/usr/bin/env node
require('../utils/validateEnv');
import { Network } from '../const';
import { connectDB, disconnectDB } from '../utils/db';
import { TxRepo } from '../repo';
import { Pos, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;
  const pos = new Pos(network);
  await connectDB(network, standby);
  const txRepo = new TxRepo();
  let txs = await txRepo.findAll();
  for (let tx of txs) {
    console.log('fix for tx: ', tx.hash);
    const receipt = await pos.getReceipt(tx.hash);
    let changed = false;
    for (const [clauseIndex, o] of tx.outputs.entries()) {
      for (let [logIndex, tr] of o.transfers.entries()) {
        console.log(tr);
        if (tr.token !== 0 && tr.token !== 1) {
          const rtr = receipt.outputs[clauseIndex].transfers[logIndex];
          if (rtr && rtr.hasOwnProperty('token')) {
            console.log('rtr:', rtr);
            tx.outputs[clauseIndex].transfers[logIndex].token = rtr.token;
            changed = true;
          }
        }
      }
    }
    if (changed) {
      await tx.save();
      console.log(`! updated tx`);
    }
  }
  await disconnectDB();
};

(async () => {
  try {
    await runWithOptions(runAsync);
    await disconnectDB();
  } catch (e) {
    console.log(`start error: ${e.name} ${e.message} - ${e.stack}`);
    process.exit(-1);
  }
})();

#!/usr/bin/env node
require('../utils/validateEnv');

import { LogEvent, LogTransfer } from '../model';
import { HeadRepo, LogEventRepo, LogTransferRepo, TxRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const evtRepo = new LogEventRepo();
  const transRepo = new LogTransferRepo();
  const txRepo = new TxRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const step = 2000;
  const best = 21000200; // pos.num;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;
    const txs = await txRepo.findInBlockRangeSortAsc(start, end);

    console.log(`start checking tx ${start} - ${end}`);
    let trs: LogTransfer[] = [];
    let evts: LogEvent[] = [];
    for (const tx of txs) {
      const block = tx.block;
      for (const [clauseIndex, o] of tx.outputs.entries()) {
        for (const [logIndex, e] of o.events.entries()) {
          const evt = {
            address: e.address,
            topics: e.topics,
            data: e.data,
            txHash: tx.hash,
            block,
            clauseIndex,
            logIndex,
          } as LogEvent;
          evts.push(evt);
        }
        for (const [logIndex, t] of o.transfers.entries()) {
          const tr = {
            sender: t.sender,
            recipient: t.recipient,
            amount: t.amount,
            token: t.token,
            txHash: tx.hash,
            block,
            clauseIndex,
            logIndex,
          } as LogTransfer;
          trs.push(tr);
        }
      }
    }
    if (evts.length > 0) {
      console.log(`saving ${evts.length} events `);
      const r = await evtRepo.bulkUpsert(...evts);
      console.log(`saved, r: ${r}`);
    }
    if (trs.length > 0) {
      console.log(`saving ${trs.length} transfers `);
      const r = await transRepo.bulkUpsert(...trs);
      console.log(`saved, r: ${r}`);
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

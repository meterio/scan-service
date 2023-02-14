#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, TxRepo } from '../repo';
import { TraceOutput } from '../model';
import { connectDB, disconnectDB } from '../utils/db';

import { checkNetworkWithDB, Pos, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const txRepo = new TxRepo();
  const pos = new Pos(network);
  await checkNetworkWithDB(network);

  const posHead = await headRepo.findByKey('pos');
  const best = posHead.num;
  const step = 50000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const txs = await txRepo.findRevertedWOTxErrorInRange(start, end);
    console.log(`searching for txs without vmError in blocks [${start}, ${end}]`);
    for (const tx of txs) {
      console.log(`processing tx ${tx.hash}`);

      let traces: TraceOutput[] = [];
      for (let i = 0; i < tx.clauseCount; i++) {
        const trace = await pos.newTraceClause(tx.hash, i);
        if (trace.error) {
          tx.vmError = { error: trace.error, reason: '', clauseIndex: i };
          console.log(`tx ${tx.hash} failed due to ${tx.vmError.error}`);
          await tx.save();
          break;
        }
        const t: TraceOutput = { json: JSON.stringify(trace), clauseIndex: i };
        traces.push(t);
      }

      if (traces.length > 0) {
        tx.traces = traces;
        console.log(`update tx ${tx.hash} with ${traces.length} traces`);
        await tx.save();
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

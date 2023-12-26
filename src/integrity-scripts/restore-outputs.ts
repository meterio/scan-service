#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, TxRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { Pos, checkNetworkWithDB, runWithOptions } from '../utils';
import { ITxOutput } from '../model';
import PromisePool from '@supercharge/promise-pool';

const runAsync = async (options) => {
  const { network, standby } = options;
  const pos = new Pos(network);

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const txRepo = new TxRepo();
  await checkNetworkWithDB(network);

  const posHead = await headRepo.findByKey('pos');
  const best = posHead.num;
  const step = 10;

  for (let i = 47272549; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const txs = await txRepo.findEmptyOutputsInBlockRangeSortAsc(start, end);
    console.log(`found ${txs.length} txs in blocks [${start}, ${end}]`);
    await PromisePool.withConcurrency(10)
      .for(txs)
      .process(async (tx, index, pool) => {
        if (tx.outputs.length > 0) {
          // skip tx without traces
          // console.log('traces not exist, skip tx: ', tx.hash);
          return;
        }
        if (tx.clauseCount <= 0) {
          return;
        }
        if (tx.clauses[0].data == '') {
          return;
        }

        const receipt = await pos.getReceipt(tx.hash);
        const converted = convertTxOutputs(receipt.outputs);
        tx.outputs = converted;
        console.log(`tx ${tx.hash} outputs from 0 to ${converted.length}`);
        await tx.save();
      });
  }
};

const convertTxOutputs = (originalOutputs: ITxOutput[]) => {
  let outputs: ITxOutput[] = [];
  for (const [clauseIndex, o] of originalOutputs.entries()) {
    const output: ITxOutput = {
      contractAddress: o.contractAddress,
      events: [],
      transfers: [],
    };
    if (o.events.length && o.transfers.length) {
      let logIndex = 0;
      output.transfers = [];
      output.events = [];
      for (const t of o.transfers) {
        output.transfers.push({
          ...t,
          overallIndex: logIndex++,
        });
      }
      for (const e of o.events) {
        output.events.push({
          ...e,
          overallIndex: logIndex++,
        });
      }
    } else if (o.events.length) {
      for (let i = 0; i < o.events.length; i++) {
        output.events.push({
          ...o.events[i],
          overallIndex: i,
        });
      }
    } else {
      for (let i = 0; i < o.transfers.length; i++) {
        output.transfers.push({
          ...o.transfers[i],
          overallIndex: i,
        });
      }
    }
    outputs.push(output);
  }
  return outputs;
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

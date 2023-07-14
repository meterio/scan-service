#!/usr/bin/env node
require('../utils/validateEnv');

import { BigNumber } from 'bignumber.js';
import { IInternalTx } from '../model';
import { HeadRepo, TxRepo, InternalTxRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { ZeroAddress } from '../const';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { GetBucketRequestPaymentRequest } from '@aws-sdk/client-s3';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const txRepo = new TxRepo();
  const internalTxRepo = new InternalTxRepo();
  await checkNetworkWithDB(network);

  const posHead = await headRepo.findByKey('pos');
  const best = posHead.num;
  const step = 5000;

  for (let i = 0; i < best; i += step) {
    let internalTxs: IInternalTx[] = [];
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const txs = await txRepo.findInBlockRangeSortAsc(start, end);
    console.log(`searching for txs in blocks [${start}, ${end}]`);
    for (const tx of txs) {
      console.log(`blk:${tx.block.number}, processing tx ${tx.hash}`);

      if (tx.traces.length <= 0) {
        // skip tx without traces
        // console.log('traces not exist, skip tx: ', tx.hash);
        continue;
      }

      if (tx.traces) {
        for (const t of tx.traces) {
          const trace = JSON.parse(t.json);
          let q = [[trace, '0']];
          while (q) {
            const item = q.shift();
            if (!item) {
              break;
            }

            const node = item[0];
            const suffix = item[1];

            const name = node.type.toLowerCase() + '_' + suffix;
            const signature = node.input.substring(0, 10);
            if (['CALL', 'CREATE', 'CREATE2'].includes(node.type)) {
              internalTxs.push({
                txHash: tx.hash,
                block: tx.block,
                txIndex: tx.txIndex,
                name,
                from: node.from,
                to: node.to || ZeroAddress,
                value: node.value ? new BigNumber(node.value) : new BigNumber(0),
                fee: tx.paid,
                gasUsed: node.gasUsed ? new BigNumber(node.gasUsed).toNumber() : 0,
                clauseIndex: t.clauseIndex,
                reverted: tx.reverted,
                signature: signature,
              });
              console.log(`found internal tx on ${tx.hash}: ${node.type} ${node.from} -> ${node.to} `);
            }

            if (node.calls) {
              for (const [index, c] of node.calls.entries()) {
                let childSuffix = suffix + '_' + index;
                q.push([c, childSuffix]);
              }
            }
          }
        }
      }
    }
    await internalTxRepo.bulkInsert(...internalTxs);
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

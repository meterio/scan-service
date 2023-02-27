#!/usr/bin/env node
require('../utils/validateEnv');

import { BigNumber } from 'bignumber.js';
import { TxDigest } from '../model';
import { HeadRepo, TxRepo, TxDigestRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { ZeroAddress, Token } from '../const';
import { ScriptEngine } from '@meterio/devkit';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const txRepo = new TxRepo();
  const txDigestRepo = new TxDigestRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 1000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const txs = await txRepo.findInBlockRangeSortAsc(start, end);
    console.log(`searching for txs in blocks [${start}, ${end}]`);

    let txDigests: TxDigest[] = [];
    for (const tx of txs) {
      txDigests = [];
      console.log(`handling tx: ${tx.hash} at ${tx.block.number}`);
      for (const [clauseIndex, clause] of tx.clauses.entries()) {
        if (clause.data && clause.data.length >= 10) {
          const isSE = ScriptEngine.IsScriptEngineData(clause.data);
          const token = clause.token;
          let signature = '';
          if (isSE) {
            const decoded = ScriptEngine.decodeScriptData(clause.data);
            // this.log.info('decoded: ', decoded);
            signature = decoded.action;
          } else {
            signature = clause.data.substring(0, 10);
          }

          // if (signature != '0x00000000') {
          txDigests.push({
            block: tx.block,
            txHash: tx.hash,
            fee: new BigNumber(tx.paid),
            from: tx.origin,
            to: clause.to || ZeroAddress,
            mtr: token === Token.MTR ? new BigNumber(clause.value) : new BigNumber(0),
            mtrg: token === Token.MTRG ? new BigNumber(clause.value) : new BigNumber(0),
            method: signature,
            reverted: tx.reverted,
            clauseIndexs: [clauseIndex],
            txIndex: tx.txIndex,
            seq: 0,
          });
          // }
        } else {
          txDigests.push({
            block: tx.block,
            txHash: tx.hash,
            fee: new BigNumber(tx.paid),
            from: tx.origin,
            to: clause.to || ZeroAddress,
            mtr: clause.token === Token.MTR ? new BigNumber(clause.value) : new BigNumber(0),
            mtrg: clause.token === Token.MTRG ? new BigNumber(clause.value) : new BigNumber(0),
            method: 'Transfer',
            reverted: tx.reverted,
            clauseIndexs: [clauseIndex],
            txIndex: tx.txIndex,
            seq: 0,
          });
        }
      }
      const d = await txDigestRepo.deleteByTxHash(tx.hash);
      console.log(`deleted ${d.deletedCount} tx digests`);
      if (txDigests.length) {
        await txDigestRepo.bulkInsert(...txDigests);
        console.log(`saved ${txDigests.length} tx digests`);
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

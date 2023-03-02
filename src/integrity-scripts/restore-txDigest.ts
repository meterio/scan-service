#!/usr/bin/env node
require('../utils/validateEnv');

import { BigNumber } from 'bignumber.js';
import { Tx, TxDigest } from '../model';
import { HeadRepo, TxRepo, TxDigestRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { ZeroAddress, Token } from '../const';
import { ScriptEngine } from '@meterio/devkit';
import { sha1 } from 'object-hash';

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

  const extractDigests = (tx: Tx) => {
    let digests: TxDigest[] = [];
    let ids = {};
    // -------------------------------------
    // Handle direct digests
    // related to tx.origin and clause.to
    // -------------------------------------
    for (const [clauseIndex, clause] of tx.clauses.entries()) {
      // save direct digests with data
      let signature = 'Transfer'; // default is transfer
      const token = clause.token;
      if (clause.data && clause.data.length >= 10) {
        // this.log.info('data', clause.data);
        const isSE = ScriptEngine.IsScriptEngineData(clause.data);
        // this.log.info('clause.to: ', clause.to);
        if (isSE) {
          const decoded = ScriptEngine.decodeScriptData(clause.data);
          // this.log.info('decoded: ', decoded);
          signature = decoded.action;
        } else {
          signature = clause.data.substring(0, 10);
        }
      }

      const d = {
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
      };
      const id = sha1({ from: d.from, to: d.to, clauseIndex });
      if (id in ids) {
        continue;
      }
      ids[id] = true;
      digests.push(d);
    }

    // ---------------------------------------------
    // Handle special case to KBlock ScriptEngine tx
    // related to transfers (indicating staking reward)
    // ---------------------------------------------
    let kblockDigestMap: { [key: string]: TxDigest } = {};
    for (const [clauseIndex, o] of tx.outputs.entries()) {
      const clause = tx.clauses[clauseIndex];
      // special case for KBlock ScritpEngine tx
      if (!tx.reverted && tx.origin === ZeroAddress && clause && ScriptEngine.IsScriptEngineData(clause.data)) {
        for (const [logIndex, tr] of o.transfers.entries()) {
          let mtr = new BigNumber(0);
          let mtrg = new BigNumber(0);
          if (tr.token == 0) {
            mtr = new BigNumber(tr.amount);
          }
          if (tr.token == 1) {
            mtrg = new BigNumber(tr.amount);
          }

          const d = {
            block: tx.block,
            txHash: tx.hash,
            fee: new BigNumber(tx.paid),
            from: tr.sender,
            to: tr.recipient,
            mtr,
            mtrg,
            method: 'Transfer',
            reverted: tx.reverted,
            clauseIndexs: [clauseIndex],
            txIndex: tx.txIndex,
            seq: 0,
          };
          const id = sha1({ from: d.from, to: d.to, clauseIndex });
          if (id in kblockDigestMap) {
            kblockDigestMap[id].clauseIndexs.push(clauseIndex);
            kblockDigestMap[id].mtr = kblockDigestMap[id].mtr.plus(mtr);
            kblockDigestMap[id].mtrg = kblockDigestMap[id].mtrg.plus(mtrg);
            continue;
          }
          ids[id] = true;
          digests.push(d);
        }
      }
    }

    for (const id in kblockDigestMap) {
      const d = kblockDigestMap[id];
      if (id in ids) {
        continue;
      }
      ids[id] = true;
      digests.push(d);
    }
    return digests;
  };

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const txs = await txRepo.findInBlockRangeSortAsc(start, end);
    console.log(`searching for txs in blocks [${start}, ${end}]`);

    for (const tx of txs) {
      console.log(`handling tx: ${tx.hash} at ${tx.block.number}`);
      const digests = extractDigests(tx);
      const d = await txDigestRepo.deleteByTxHash(tx.hash);
      console.log(`deleted ${d.deletedCount} tx digests`);
      if (digests.length) {
        await txDigestRepo.bulkInsert(...digests);
        console.log(`saved ${digests.length} tx digests`);
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

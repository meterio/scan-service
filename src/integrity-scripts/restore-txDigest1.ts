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

const FROM_ADDR = '0x61746f722d62656e656669742d61646472657373'
const TO_ADDR = '0x74696f6e2d6163636f756e742d61646472657373'

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const txDigestRepo = new TxDigestRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 1000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const txDigests = await txDigestRepo.findInRange(start, end)
    const aimTx = txDigests.filter(t => t.from === FROM_ADDR && t.to === TO_ADDR && t.method === 'Transfer')
    if (aimTx.length) {

      console.log(`${start}-${end}:${aimTx.length}`)
      const groupByHash = {}
      const deleteIds = []
      for (const t of aimTx) {
        
        if (!(t.txHash in groupByHash)) {
          groupByHash[t.txHash] = t
        } else {
          groupByHash[t.txHash].fee = groupByHash[t.txHash].fee.plus(t.fee)
          groupByHash[t.txHash].mtr = groupByHash[t.txHash].mtr.plus(t.mtr)
          groupByHash[t.txHash].mtr = groupByHash[t.txHash].mtrg.plus(t.mtrg)
          groupByHash[t.txHash].clauseIndexs.push(...t.clauseIndexs)
          // t.delete()
          deleteIds.push(t._id)
        }

      }

      const txDigest: {id : TxDigest[]} | {} = {}
      for (const hash in groupByHash) {
        // groupByHash[hash].save()
        txDigest[groupByHash[hash]._id] = groupByHash[hash]
      }

      console.log('txDigests', txDigest)
      console.log('delete ids', deleteIds)
      await txDigestRepo.bulkUpsert(txDigest)
      console.log('bulk upserted')

      await txDigestRepo.deleteByIds(deleteIds)
      console.log('deleted')
    } else {
      console.log(`no aim tx in ${start}-${end}`)
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

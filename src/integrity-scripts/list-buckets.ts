#!/usr/bin/env node
require('../utils/validateEnv');

import { ScriptEngine } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';
import { TxRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { fromWei, runWithOptions } from '../utils';

const origin = '0x1ce46b7bf47e144e3aa0203e5de1395e85fce087';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const txRepo = new TxRepo();
  const txs = await txRepo.findByOrigin(origin);
  let buckets = {};
  let sorted = txs.sort((a, b) => {
    return a.block.number < b.block.number ? -1 : 1;
  });
  for (const tx of sorted) {
    for (const c of tx.clauses) {
      try {
        if (c.data.length < 2) {
          continue;
        }
        const scriptData = ScriptEngine.decodeScriptData(c.data);
        if (scriptData.header.modId !== ScriptEngine.ModuleID.Staking) {
          continue;
        }
        const body = ScriptEngine.decodeStakingBody(scriptData.payload);

        if (body.opCode === ScriptEngine.StakingOpCode.Bound) {
          const bucketID = ScriptEngine.getBucketID(body.holderAddr, body.nonce, body.timestamp);
          if (!(bucketID in buckets)) {
            buckets[bucketID] = new BigNumber(body.amount);
          }
          console.log(`[${bucketID}] create bucket, amount: ${fromWei(body.amount)}`);
          console.log(`on tx ${tx.hash}`);
          console.log('-'.repeat(40));
        }
        if (body.opCode === ScriptEngine.StakingOpCode.BucketUpdate) {
          const bucketID = body.bucketID;
          if (bucketID in buckets) {
            buckets[bucketID] = buckets[bucketID].plus(body.amount);
          }
          console.log(`[${bucketID}] bucket update , amount: ${fromWei(body.amount)}`);
          console.log(`on tx ${tx.hash}`);
          console.log('-'.repeat(40));
        }
        if (body.opCode === ScriptEngine.StakingOpCode.Unbound) {
          const bucketID = body.bucketID;
          console.log(`[${bucketID}] unbound bucket`);
          console.log(`on tx ${tx.hash}`);
          console.log('-'.repeat(40));
        }
      } catch (e) {
        continue;
      }
    }
  }
  console.log('-'.repeat(40));
  for (const id in buckets) {
    console.log(`bucket ${id}: amount ${fromWei(buckets[id])}`);
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

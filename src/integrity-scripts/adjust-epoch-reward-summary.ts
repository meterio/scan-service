#!/usr/bin/env node
require('../utils/validateEnv');

import { ScriptEngine } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';
import { connectDB, disconnectDB } from '../utils/db';
import { BlockRepo, EpochRewardRepo, EpochRewardSummaryRepo, TxRepo } from '../repo';
import { StakingModuleAddress } from '../const';
import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  await checkNetworkWithDB(network);

  const epochRewardRepo = new EpochRewardRepo();
  const epochRewardSummaryRepo = new EpochRewardSummaryRepo();
  const blockRepo = new BlockRepo();
  const txRepo = new TxRepo();

  const summaries = await epochRewardSummaryRepo.findAll();
  for (const summary of summaries) {
    if (summary.totalReward.isLessThanOrEqualTo(0)) {
      continue;
    }
    const rewards = await epochRewardRepo.findByEpoch(summary.epoch);
    let autobidTotal = new BigNumber(0);
    let autobidCount = 0;
    let transferTotal = new BigNumber(0);
    let transferCount = 0;
    for (const r of rewards) {
      if (r.type == 'autobid') {
        autobidTotal = autobidTotal.plus(r.amount);
        autobidCount++;
      }
    }

    const blk = await blockRepo.findByNumber(summary.blockNum);
    for (const txHash of blk.txHashs) {
      const tx = await txRepo.findByHash(txHash);
      if (tx.clauseCount == 1) {
        const first = tx.clauses[0];
        if (first.to.toLowerCase() == StakingModuleAddress.toLowerCase()) {
          const scriptData = ScriptEngine.decodeScriptData(first.data);
          if (scriptData.header.modId === ScriptEngine.ModuleID.Staking) {
            const body = ScriptEngine.decodeStakingBody(scriptData.payload);
            if (body.opCode === ScriptEngine.StakingOpCode.Governing) {
              if (body.extra instanceof Array) {
                for (const ex of body.extra) {
                  if (ex instanceof ScriptEngine.RewardInfo) {
                    transferTotal = transferTotal.plus(ex?.amount);
                  } else if (ex instanceof ScriptEngine.RewardInfoV2) {
                    transferTotal = transferTotal.plus(ex?.distAmount);
                  }
                  transferCount++;
                }
              }
            }
          }
        }
      }
    }

    let updated = true;
    if (!autobidTotal.isEqualTo(summary.autobidTotal)) {
      console.log(`update autobidTotal from: ${summary.autobidTotal.toFixed()} to ${autobidTotal.toFixed()}`);
      summary.autobidTotal = autobidTotal;
      updated = true;
    }
    if (!transferTotal.isEqualTo(summary.transferCount)) {
      summary.transferTotal = transferTotal;
      console.log(`update transferTotal from: ${summary.transferTotal.toFixed()} to ${transferTotal.toFixed()}`);
      updated = true;
    }
    if (autobidCount != summary.autobidCount) {
      summary.autobidCount = autobidCount;
      console.log(`update autobidCount from: ${summary.autobidCount} to ${autobidCount}`);
      updated = true;
    }
    if (transferCount != summary.transferCount) {
      summary.transferCount = transferCount;
      console.log(`update transferCount from: ${summary.transferCount} to ${transferCount}`);
      updated = true;
    }
    if (updated) {
      summary.totalReward = summary.autobidTotal.plus(summary.transferTotal);
      console.log(`saved summary on epoch ${summary.epoch}`);
      // await summary.save();
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

#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, TxDigestRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';

const FROM_ADDR = '0x61746f722d62656e656669742d61646472657373';
const TO_ADDR = '0x74696f6e2d6163636f756e742d61646472657373';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const txDigestRepo = new TxDigestRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;
  const start = 0;

  for (let i = start; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;
    console.log(`searching for txDigests in blocks [${start}, ${end}]`);
    const txHashs = await txDigestRepo.findDistinctTxInRangeWithFromAndTo(start, end, FROM_ADDR, TO_ADDR, 'Transfer');
    console.log(txHashs);
    for (const txHash of txHashs) {
      const digests = await txDigestRepo.findByTxHashList(txHash.toString());
      const targetDigests = digests.filter(
        (d) => d.from === FROM_ADDR.toLowerCase() && d.to === TO_ADDR.toLowerCase() && d.method === 'Transfer'
      );
      if (targetDigests.length <= 1) {
        continue;
      }
      console.log(`process tx: ${txHash}`);
      let deleteCount = 0;
      const first = targetDigests[0];
      for (const d of targetDigests.slice(1)) {
        first.mtr = first.mtr.plus(d.mtr);
        first.mtrg = first.mtrg.plus(d.mtrg);
        first.clauseIndexs.push(...d.clauseIndexs);
        console.log(`delete digest (${d.txHash}, ${d.from}, ${d.to}, ${d.clauseIndexs})`);
        await d.delete();
        deleteCount++;
      }
      first.clauseIndexs = Array.from(new Set(first.clauseIndexs));
      first.clauseIndexs.sort((a, b) => (a < b ? -1 : 1));
      console.log(`update digest (${first.txHash}, ${first.from}, ${first.to}, ${first.clauseIndexs})`);
      console.log(`deleted digests: ${deleteCount}`);
      await first.save();
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

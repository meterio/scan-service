import * as fs from 'fs';
import * as readline from 'readline';
require('../utils/validateEnv');
import { TxRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { checkNetworkWithDB, runWithOptions } from '../utils';

const window = 20000;

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const txRepo = new TxRepo();
  await checkNetworkWithDB(network);

  const fileStream = fs.createReadStream('will.txt');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input.txt as a single line break.

  let count = 0;
  let txhashs = [];
  let totalFees = BigInt(0);
  for await (const line of rl) {
    txhashs.push(line.trimEnd().replaceAll('"', ''));
    // Each line in input.txt will be successively available here as `line`.
    // console.log(`Line from file: ${line}`);
    if (txhashs.length == window) {
      console.log(`searching txs in batch [${count - window}, ${count}], totalFees: ${totalFees}`);
      const txs = await txRepo.findByHashs(txhashs);
      for (const tx of txs) {
        totalFees += BigInt(tx.paid.toFixed(0));
      }
      txhashs = [];
    }
    count++;
  }

  console.log('FINISHED', totalFees, totalFees);
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

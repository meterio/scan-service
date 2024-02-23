#!/usr/bin/env node
require('../utils/validateEnv');
import { connectDB, disconnectDB } from '../utils/db';
import { NFTCMD } from '../cmd/nft.cmd';
import { runWithOptions } from '../utils';

// other imports

const runAsync = async (options) => {
  const { network, standby } = options;
  const blockNum = 49743197;
  const startNum = blockNum;
  const endNum = blockNum + 5;
  await connectDB(network, standby);
  console.log('process blockNum: ', blockNum);
  const cmd = new NFTCMD(network);

  await cmd.scanEIP173InRange(network, startNum, endNum);
  await cmd.scanERC721InRange(network, startNum, endNum);
  await cmd.scanERC1155SinglesInRange(network, startNum, endNum);
  await cmd.scanERC1155BatchsInRange(network, startNum, endNum);

  console.log(cmd.nftCache);

  await disconnectDB();
};

(async () => {
  await runWithOptions(runAsync);
})();

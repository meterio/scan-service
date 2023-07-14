#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, NFTRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { Pos, checkNetworkWithDB, runWithOptions } from '../utils';
import { PromisePool } from '@supercharge/promise-pool';
import BigNumber from 'bignumber.js';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const nftRepo = new NFTRepo();
  const headRepo = new HeadRepo();
  const pos = new Pos(network);
  await checkNetworkWithDB(network);

  const poshead = await headRepo.findByKey('pos');
  const best = poshead.num;
  const step = 100000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;
    const nfts = await nftRepo.findByTypeInRange('ERC1155', start, end);

    await PromisePool.withConcurrency(20)
      .for(nfts)
      .process(async (nft, index, pool) => {
        try {
          const bal = await pos.getERC1155BalanceOf(nft.owner, nft.address, nft.tokenId, poshead.hash);
          if (bal && !new BigNumber(nft.value).eq(bal)) {
            console.log(`updated NFT ${nft.address}[${nft.tokenId}] value from ${nft.value} to ${bal}`, nft);
            if (new BigNumber(0).eq(bal)) {
              await nft.deleteOne();
            } else {
              nft.value = new BigNumber(bal).toNumber();
              await nft.save();
            }
          }
        } catch (e) {
          console.log(`could not cache nft image for [${nft.tokenId}] on ${nft.address} `, e);
        }
      });
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

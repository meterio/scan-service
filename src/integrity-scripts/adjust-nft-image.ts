#!/usr/bin/env node
require('../utils/validateEnv');

import { connectDB, disconnectDB } from '../utils/db';
import { HeadRepo, NFTRepo } from '../repo';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { NFTCache } from '../types/nftCache';

const runAsync = async (options) => {
  const { network, standby } = options;
  await connectDB(network, standby);

  const headRepo = new HeadRepo();
  const nftRepo = new NFTRepo();

  await checkNetworkWithDB(network);

  const nftCache = new NFTCache(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const nfts = await nftRepo.findInRange(start, end);
    console.log(`Found ${nfts.length} nfts in blocks [${start}, ${end}]`);
    for (const nft of nfts) {
      try {
        if (nft.mediaType === 'base64') {
          // redo with correct content-type
          const j = JSON.parse(nft.tokenJSON);
          const uri = j.image;
          const buf = Buffer.from(uri.split(';base64,').pop(), 'base64');
          const mediaType = uri.split(';base64,').shift().replace('data:', '');
          await nftCache.uploadToAlbum(nft.address, nft.tokenId, buf, mediaType);
        } else if (nft.mediaType) {
          // reset with correct content-type
          await nftCache.updateContentType(nft.mediaURI, nft.mediaType);
        } else {
          // warn about this nft
          console.log('NFT has an empty media type');
        }
      } catch (e) {
        console.log(`could not process nft: [${nft.tokenId}]@${nft.address} with error: ${e}`);
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

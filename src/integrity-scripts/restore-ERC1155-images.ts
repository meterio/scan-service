#!/usr/bin/env node
require('../utils/validateEnv');

import { ERC1155ABI } from '@meterio/devkit';
import { HeadRepo, NFTRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { ethers } from 'ethers';
import { checkNetworkWithDB, runWithOptions } from '../utils';
import { GetNetworkConfig } from '../const';
import { NFTCache } from '../types/nftCache';

// Set the AWS Region
const BASE64_ENCODED_JSON = 'base64 encoded json';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const nftRepo = new NFTRepo();

  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;
  const nftCache = new NFTCache(network);

  const config = GetNetworkConfig(network);
  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const nft1155s = await nftRepo.findByTypeInRange('ERC1155', start, end);
    for (const nft of nft1155s) {
      const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(nft.address, [ERC1155ABI.uri], provider);

      let tokenURI = '';
      try {
        tokenURI = await contract.uri(nft.tokenId);
        tokenURI = nftCache.convertUrl(tokenURI);
      } catch (e) {
        console.log(`error getting tokenURI for ERC1155 ${nft.address}[${nft.tokenId}]`, e);
      }
      let tokenJSON = {};
      if (tokenURI.startsWith('data:application/json;base64,')) {
        const content = Buffer.from(tokenURI.substring(29), 'base64').toString();
        tokenURI = BASE64_ENCODED_JSON;
        try {
          tokenJSON = JSON.parse(content);
        } catch (e) {
          tokenJSON = JSON.parse(content.replaceAll("'", '"'));
        }
      }

      nft.tokenURI = tokenURI;
      nft.tokenJSON = JSON.stringify(tokenJSON);

      try {
        await nftCache.updateNFTInfo(nft);
        console.log(`updated NFT ${nft.address}[${nft.tokenId}]`, nft);
        await nft.save();
      } catch (e) {
        console.log(`could not update info for NFT ${nft.address}[${nft.tokenId}]: `, e);
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

#!/usr/bin/env node
require('../utils/validateEnv');

import { ERC721, abi } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';
import { Movement } from '../model';
import { HeadRepo, LogEventRepo, MovementRepo, ContractRepo } from '../repo';
import { Token, ContractType } from '../const';
import { connectDB, disconnectDB } from '../utils/db';
import { NFTBalanceAuditor } from '../types';

import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const evtRepo = new LogEventRepo();
  const mvtRepo = new MovementRepo();
  const contractRepo = new ContractRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;

  await mvtRepo.deleteByToken(Token.ERC721);

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const transferEvts = await evtRepo.findByTopic0InBlockRangeSortAsc(ERC721.Transfer.signature, start, end);
    console.log(`searching for ERC721 transfers in blocks [${start}, ${end}]`);
    let movementsCache: Movement[] = [];
    let nftAuditor = new NFTBalanceAuditor();
    for (const evt of transferEvts) {
      if (evt.topics && evt.topics[0] === ERC721.Transfer.signature) {
        let decoded: abi.Decoded;
        try {
          decoded = ERC721.Transfer.decode(evt.data, evt.topics);
        } catch (e) {
          // console.log('error decoding transfer event');
          continue;
        }
        console.log(`tx: ${evt.txHash}`);

        const from = decoded.from.toLowerCase();
        const to = decoded.to.toLowerCase();
        const tokenId = new BigNumber(decoded.tokenId).toFixed();
        const nftTransfers = [{ tokenId, value: 1 }];
        // ### Handle movement
        let movement: Movement = {
          from,
          to,
          amount: new BigNumber(0),
          token: Token.ERC721,
          tokenAddress: evt.address,
          nftTransfers,
          txHash: evt.txHash,
          block: evt.block,
          clauseIndex: evt.clauseIndex,
          logIndex: evt.logIndex,
        };

        const contract = await contractRepo.findByAddress(evt.address);
        if (contract && contract.type === ContractType.ERC721) {
          nftAuditor.minusNFT(from, evt.address, nftTransfers, evt.block);
          nftAuditor.plusNFT(to, evt.address, nftTransfers, evt.block);
        } else {
          console.log('[Warning] Found ERC721 transfer event, but ERC721 contract is not tracked!!');
          console.log('contract address: ', evt.address);
          console.log('event: ', evt);
          console.log('tx hash: ', evt.txHash);
        }

        movementsCache.push(movement);
      }
    }
    await nftAuditor.updateDB();
    if (movementsCache.length > 0) {
      console.log(`prepare to save ${movementsCache.length} movements`);
      const m = await mvtRepo.bulkUpsert(...movementsCache);
      console.log(`done`, m);
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

#!/usr/bin/env node
require('../utils/validateEnv');

import { abi, ERC1155 } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';

import { INFTTransfer, IMovement } from '../model';
import { HeadRepo, LogEventRepo, MovementRepo } from '../repo';
import { Token } from '../const';
import { connectDB, disconnectDB } from '../utils/db';
import { NFTBalanceAuditor } from '../types';

import { checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const evtRepo = new LogEventRepo();
  const mvtRepo = new MovementRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;

  await mvtRepo.deleteByToken(Token.ERC1155);

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const singles = await evtRepo.findByTopic0InBlockRangeSortAsc(ERC1155.TransferSingle.signature, start, end);
    console.log(`searching for ERC1155 singles in blocks [${start}, ${end}]`);
    let movementsCache: IMovement[] = [];
    let nftAuditor = new NFTBalanceAuditor();
    for (const evt of singles) {
      if (evt.topics && evt.topics[0] === ERC1155.TransferSingle.signature) {
        let decoded: abi.Decoded;
        try {
          decoded = ERC1155.TransferSingle.decode(evt.data, evt.topics);
        } catch (e) {
          console.log('error decoding transfer event');
          continue;
        }
        const from = decoded.from.toLowerCase();
        const to = decoded.to.toLowerCase();
        const nftTransfers = [{ tokenId: decoded.id, value: Number(decoded.value) }];
        const movement: IMovement = {
          from,
          to,
          token: Token.ERC1155,
          amount: new BigNumber(0),
          tokenAddress: evt.address,
          nftTransfers,
          txHash: evt.txHash,
          block: evt.block,
          clauseIndex: evt.clauseIndex,
          logIndex: evt.logIndex,
        };
        nftAuditor.minusNFT(from, evt.address, nftTransfers, evt.block);
        nftAuditor.plusNFT(to, evt.address, nftTransfers, evt.block);
        movementsCache.push(movement);
      }
    }

    console.log(`searching for ERC1155 batches in blocks [${start}, ${end}]`);
    const batchs = await evtRepo.findByTopic0InBlockRangeSortAsc(ERC1155.TransferBatch.signature, start, end);
    for (const evt of batchs) {
      if (evt.topics && evt.topics[0] === ERC1155.TransferBatch.signature) {
        let decoded: abi.Decoded;
        try {
          decoded = ERC1155.TransferBatch.decode(evt.data, evt.topics);
        } catch (e) {
          console.log('error decoding transfer event');
          return;
        }
        let nftTransfers: INFTTransfer[] = [];
        for (const [i, id] of decoded.ids.entries()) {
          nftTransfers.push({ tokenId: id, value: Number(decoded.values[i]) });
        }
        const from = decoded.from.toLowerCase();
        const to = decoded.to.toLowerCase();
        const movement: IMovement = {
          from,
          to,
          token: Token.ERC20,
          amount: new BigNumber(0),
          tokenAddress: evt.address,
          nftTransfers,
          txHash: evt.txHash,
          block: evt.block,
          clauseIndex: evt.clauseIndex,
          logIndex: evt.logIndex,
        };
        nftAuditor.minusNFT(from, evt.address, nftTransfers, evt.block);
        nftAuditor.plusNFT(to, evt.address, nftTransfers, evt.block);

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

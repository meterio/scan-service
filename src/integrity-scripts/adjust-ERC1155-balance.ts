#!/usr/bin/env node
require('../utils/validateEnv');

import { ERC1155, ERC20 } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';
import { Token } from '../const';
import { HeadRepo, NFTRepo, TokenBalanceRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { Pos, checkNetworkWithDB, runWithOptions } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const nftRepo = new NFTRepo();
  const headRepo = new HeadRepo();
  await checkNetworkWithDB(network);

  const pos = new Pos(network);
  const posHead = await headRepo.findByKey('pos');
  const best = posHead.num;
  const step = 100000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;
    const erc1155s = await nftRepo.findByTypeInRange('ERC1155', start, end);
    for (const nft of erc1155s) {
      const outputs = await pos.explain(
        {
          clauses: [
            { to: nft.address, value: '0x0', data: ERC1155.balanceOf.encode(nft.owner, nft.tokenId), token: Token.MTR },
          ],
        },
        'best'
      );
      const decoded = ERC1155.balanceOf.decode(outputs[0].data);
      const chainBal = new BigNumber(decoded[0]);
      if (!chainBal.isEqualTo(nft.value)) {
        console.log(
          `found mismatch: ${nft.address}[${nft.tokenId}]_${nft.owner} value:${
            nft.value
          }, chain balance:${chainBal.toNumber()}`
        );
        if (chainBal.isGreaterThan(0)) {
          console.log(`set balance to ${chainBal.toNumber()}`);
          nft.value = chainBal.toNumber();
          await nft.save();
        } else {
          console.log(`delete nft`);
          await nft.delete();
        }
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

#!/usr/bin/env node
require('../utils/validateEnv');

import { ContractRepo, HeadRepo, LogEventRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import * as fs from 'fs';
import { Interface } from 'ethers/lib/utils';

import { checkNetworkWithDB, runWithOptions } from '../utils';
import { ZeroAddress } from '../const';

const pairs = {
  'MTRG-BUSD.bsc': '0xaca210bd7d12c15560994e4c7b2bec1b538ad306',
  'MTRG-VOLT': '0x1071392e4cdf7c01d433b87be92beb1f8fd663a8',
  'AMPL-MTRG': '0x7d93b4a5fb25b4693801a654dfe67804daf9196c',
  'BUSD.bsc-USDC.eth': '0x5abea0c0da9615101c7d4a4906609650cc9ad16c',
  'BUSD.bsc-VOLT': '0x8b584f17dac4bef59dde71475cd3628face97901',
  'MTRG-MTR': '0x0d7365300e85fc87ef4da53ab05f1637dd4f73cc',
  'BUSD.bsc-USDT.eth': '0xe9a976c31ddd76abdb441342850c29307f1dd3d7',
  'MTRG-MOVR': '0x33b860f32706670dfd41ec133847b4d2c5886b40',
  'MTRG-USDC.eth': '0x3bb40a0765fe25db3c12a934c0dd32dfc7638b6d',
  'MTRG-FTB': '0x931bb8c7fb6cd099678fae36a5370577cee18ade',
  'MTRG-USDT.eth': '0xcb89b1705474cd0bcc820df98539b71605f15476',
  'MTRG-BNB.bsc': '0x3618cd973518eaf9bb0c430b93a850faaa278e3d',
  'BUSD.bsc-WETH.eth': '0xe81171e3e984285caf2e2a89ffedb92f4e424125',
  'WETH.eth-VOLT': '0xd93c37ce6936f85e1287299952bda98588a0c062',
  'BUSD.bsc-PASS': '0xbf9afcb87e54588b1fb547bde632f637b86fcaec',
  'WETH.eth-BNB.bsc': '0x49fd97327ed080c6806ff3b4c74f756b15acc572',
  'MTR-USDC.eth': '0x8eba676e62617548e1a238456c306fe3a9863110',
  'MTR-VOLT': '0xf3a9258427fcaf2001450849d042f68d3f405a97',
  'WETH.eth-WBTC.eth': '0x3d0ca02704d45ba2966c0be7a4f3c6cd4163569e',
  'AMPL-MTR': '0xa3a3fe5e266cb4c536c9911ee19ae6963ed49561',
  'AMPL-BUSD.bsc': '0xbd897c76485c2e49a5c4e24708c3363407839ce6',
  'USDT.eth-WETH.eth': '0x9f488b8448141e348231912b7e200b208b7bb486',
};
let targetAddrs = [];
for (const name in pairs) {
  targetAddrs.push(pairs[name].toLowerCase());
}

// function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)
const iface = new Interface(['event Transfer(address indexed _from, address indexed _to, uint256 _value)']);
const transferTopic = iface.getEventTopic('Transfer');
const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const evtRepo = new LogEventRepo();
  const contractRepo = new ContractRepo();
  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 10000;
  const start = 0;

  let addrMap = {};
  for (let i = start; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const evts = await evtRepo.findByTopic0InBlockRangeSortAsc(transferTopic, start, end);
    console.log(`scanning events in blocks [${start}, ${end}]`);

    for (const e of evts) {
      try {
        const decoded = iface.decodeEventLog('Transfer', e.data, e.topics);
        const from = decoded._from;
        const to = decoded._to;

        if (targetAddrs.includes(e.address.toLowerCase()) && from === ZeroAddress) {
          console.log(`${to} added liquidity to ${e.address}`);
          // add liquidity to pools
          addrMap[to.toLowerCase()] = true;
        }
      } catch (e) {}
    }
  }
  let validAddrs = [];
  for (const addr in addrMap) {
    if (addr === ZeroAddress) {
      continue;
    }
    const c = await contractRepo.findByAddress(addr);
    if (c) {
      continue;
    }
    validAddrs.push(addr);
  }
  fs.writeFileSync('liquidity-providers.txt', validAddrs.join('\n'));
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

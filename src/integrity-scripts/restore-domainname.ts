require('../utils/validateEnv');

import { AccountRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import { ethers } from 'ethers';

import { checkNetworkWithDB, runWithOptions } from '../utils';

const MAINNET_JSON_RPC = 'https://rpc.meter.io';
const MAINNET_CONTRACT_ADDR = '0x7fd85de6312bdbd8d4f625f7b80a254777c00b17';
const MAINNET_ABI =
  '[{"inputs":[{"internalType":"string","name":"_tld","type":"string"}],"stateMutability":"payable","type":"constructor"},{"inputs":[],"name":"AlreadyRegistered","type":"error"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"InvalidName","type":"error"},{"inputs":[],"name":"Unauthorized","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"register","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"record","type":"string"},{"internalType":"enumRecordType","name":"recordType","type":"uint8"}],"name":"setRecord","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"_avatar","type":"string"},{"internalType":"string","name":"_twitterTag","type":"string"},{"internalType":"string","name":"_website","type":"string"},{"internalType":"string","name":"_email","type":"string"},{"internalType":"string","name":"_description","type":"string"}],"name":"setRecords","outputs":[],"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"basePrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAllNames","outputs":[{"internalType":"string[]","name":"","type":"string[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"getId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"enumRecordType","name":"recordType","type":"uint8"}],"name":"getRecord","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"getRecords","outputs":[{"internalType":"string[]","name":"","type":"string[]"},{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"ids","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isOwner","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"isSet","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"names","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"addresspayable","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"price","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"records","outputs":[{"internalType":"string","name":"avatar","type":"string"},{"internalType":"string","name":"twitterTag","type":"string"},{"internalType":"string","name":"website","type":"string"},{"internalType":"string","name":"email","type":"string"},{"internalType":"string","name":"description","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tld","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"valid","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"}]';

const SIGNER = new ethers.providers.JsonRpcProvider(MAINNET_JSON_RPC).getSigner();
const contract = new ethers.Contract(MAINNET_CONTRACT_ADDR, MAINNET_ABI, SIGNER);

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const accountRepo = new AccountRepo();
  await checkNetworkWithDB(network);

  const allNames = await contract.getAllNames();
  console.log('all names ', allNames);
  const accountList = await accountRepo.findByNameList(allNames);
  console.log('get accouns by all names counts', accountList.length);

  const existentNames: string[] = [];
  const aliases: { [address: string]: string[] } = {};
  for (const a of accountList) {
    console.log({ name: a.name, alias: a.alias });
    const alias = [];
    if (a.alias) {
      alias.push(...a.alias);
    }
    existentNames.push(a.name, ...alias);
    aliases[a.address] = [...alias, a.name];
  }
  console.log('existentNames', existentNames);
  console.log('aliases', aliases);

  const willUpdateData = {};
  for (const name of allNames) {
    if (!existentNames.includes(name)) {
      const address = await contract.getAddress(name);
      const lowerCaseAddr = String(address).toLowerCase();
      if (Object.keys(willUpdateData).includes(lowerCaseAddr)) {
        willUpdateData[lowerCaseAddr] = {
          name,
          alias: [willUpdateData[lowerCaseAddr].name, ...willUpdateData[lowerCaseAddr].alias],
        };
      } else {
        if (Object.keys(aliases).includes(lowerCaseAddr)) {
          willUpdateData[lowerCaseAddr] = {
            name,
            alias: aliases[lowerCaseAddr],
          };
        } else {
          willUpdateData[lowerCaseAddr] = {
            name,
            alias: [],
          };
        }
      }

      console.log(`name ${name} => ${address}`);
    } else {
      console.log(`name ${name} exsit, skip`);
    }
  }

  console.log('willUpdateData', willUpdateData);

  for (const address in willUpdateData) {
    await accountRepo.updateName(address, willUpdateData[address].name, willUpdateData[address].alias);
    console.log(`saved ${address}: ${willUpdateData[address].name} ${willUpdateData[address].alias}`);
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

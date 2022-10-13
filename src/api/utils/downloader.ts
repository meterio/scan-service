import * as fs from 'fs';
import * as path from 'path';

import { keccak256 } from '@meterio/devkit/dist/cry';
import axios from 'axios';

const DOWNLOAD_DIR = '/tmp';
const CACHE_TTL = 1 * 3600;
let listCache: object | undefined;
let listUpdatedAt = 0;

export const getVersionList = async () => {
  console.log('Retrieving available version list...');

  if (listCache !== undefined) {
    if (new Date().getTime() / 1000 - listUpdatedAt <= CACHE_TTL) {
      console.log('cache not expired, use cache directly');
    }
    return listCache;
  }
  const res = await axios.get('https://solc-bin.ethereum.org/bin/list.json');
  if (res.status === 200) {
    listCache = res.data;
    listUpdatedAt = new Date().getTime() / 1000;
    return res.data;
  }
};

export const downloadBinary = async (outputName, filepath, expectedHash) => {
  const prefix = path.dirname(outputName);
  if (!fs.existsSync(prefix)) {
    fs.mkdirSync(prefix, { recursive: true });
  }
  if (fs.existsSync(outputName)) {
    console.log(`file ${outputName} exists, return.`);
    return;
  }

  console.log('Downloading version', filepath);
  const handleInt = () => {
    console.log(`\nInterrupted before download, removing file: ${filepath}.`);
    fs.unlinkSync(outputName);
    process.exit(1);
  };
  process.on('SIGINT', handleInt);

  const res = await axios.get(`https://solc-bin.ethereum.org/bin/${filepath}`, {
    responseType: 'blob',
  });
  if (res.status === 200) {
    fs.writeFileSync(outputName, res.data);
    const content = fs.readFileSync(outputName);
    const hash = keccak256(content);

    if (expectedHash !== '0x' + hash.toString('hex')) {
      console.log(
        `hash mismatch, expected ${expectedHash} got ${
          '0x' + hash.toString('hex')
        }`
      );
      fs.unlinkSync(outputName);
    } else {
      console.log('Downloaded version: ', filepath);
      console.log('Saved in ', outputName);
    }
  } else {
    console.log('status is not 200:', res.status);
  }
  //   console.log('data: ', res.data);
};

export const downloadByVersion = async (version: string) => {
  const list = await getVersionList();
  let filepath = '';
  let expectedHash = '';
  for (const config of list.builds) {
    if (config.version === version && !config.path.includes('-nightly')) {
      filepath = config.path;
      expectedHash = config.keccak256;
      break;
    }
  }

  // if version not found, return
  if (filepath && expectedHash) {
  } else {
    console.log('could not find this version: ', version);
  }

  // if file exists, check hash
  const outputName = path.join(DOWNLOAD_DIR, filepath);
  if (fs.existsSync(outputName)) {
    const content = fs.readFileSync(outputName);
    const hash = keccak256(content);
    if (expectedHash === '0x' + hash.toString('hex')) {
      console.log(`already downloaded ${outputName}, skip for now`);
      console.log('Saved in ', outputName);
      return outputName;
    }
    fs.unlinkSync(outputName);
  }

  await downloadBinary(outputName, filepath, expectedHash);
  return outputName;
};

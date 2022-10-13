#!/usr/bin/env node
require('./utils/validateEnv');

import { serveAPI } from './api/server';
import { Network } from './const';

const parsePort = (value) => {
  try {
    let port = Number(value);
    if (port > 1000 && port < 65536) {
      return port;
    }
  } catch (e) {
    throw new Error('Not a valid port');
  }
};

const parseStandby = (value) => {
  if (value === 'yes' || value === 'y' || value === 'Y') {
    return true;
  }
  if (value === 'no' || value === 'n' || value === 'N') {
    return false;
  }
  return !!value;
};

const parseNetwork = (value) => {
  let network: Network;
  switch (value) {
    case 'main':
    case 'metermain':
      network = Network.MainNet;
      break;
    case 'test':
    case 'metertest':
      network = Network.TestNet;
      break;
    case 'verse-test':
      network = Network.VerseTest;
      break;
    case 'verse-main':
      network = Network.VerseMain;
      break;
    default:
      throw new Error('Not a valid network');
  }
  return network;
};

(async () => {
  try {
    const port = parsePort(process.env.API_PORT);
    const network = parseNetwork(process.env.API_NETWORK);
    const standby = parseStandby(process.env.API_STANDBY);
    await serveAPI(network, standby, port);
  } catch (e) {
    console.log('ERROR: ', e);
    process.exit(-1);
  }
})();

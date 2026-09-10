#!/usr/bin/env node
require('./utils/validateEnv');

import { Option } from 'commander';
import { serveAPI } from './api/server';
import { CMD } from './cmd/cmd';
import { MetricCMD } from './cmd/metric.cmd';
import { NFTCMD } from './cmd/nft.cmd';
import { PosCMD } from './cmd/pos.cmd';
import { PowCMD } from './cmd/pow.cmd';
import { ScriptEngineCMD } from './cmd/scriptEngine.cmd';
import { Network } from './const';
import { connectDB, disconnectDB } from './utils/db';
import { RebaseCMD } from './cmd/rebase.cmd';

const commander = require('commander');
const program = new commander.Command();

const runSync = async (task, options) => {
  console.log(`Starting sync:${task} service on network ${options.network}:${options.standby}`);
  await connectDB(options.network, !!options.standby);
  //   await cmd.start();
  let cmd: CMD;
  switch (task) {
    case 'pos':
      cmd = new PosCMD(options.network);
      break;
    case 'pow':
      cmd = new PowCMD(options.network);
      break;
    case 'nft':
      cmd = new NFTCMD(options.network);
      break;
    case 'metric':
      cmd = new MetricCMD(options.network);
      break;
    case 'scriptengine':
      cmd = new ScriptEngineCMD(options.network);
      break;
    case 'rebase':
      cmd = new RebaseCMD(options.network);
      break;
    default:
      throw new commander.InvalidArgumentError('Not a valid task to sync');
  }
  // Docker sends SIGTERM on stop/restart and SIGKILLs ~10s later. Without a
  // handler the process is killed mid-write, leaving rows above the persisted
  // head that the next startup has to clean up - which on a slow disk costs
  // minutes. Ask the loop to stop instead: it finishes the block it is on,
  // persists what it has, and exits cleanly.
  let stopping = false;
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
  for (const sig of signals) {
    process.on(sig, () => {
      if (stopping) {
        process.stdout.write(`Got ${sig} again, exiting immediately\n`);
        process.exit(1);
      }
      stopping = true;
      process.stdout.write(`Got ${sig}, finishing current block then shutting down...\n`);
      cmd.stop();
    });
  }

  await cmd.start();
  await disconnectDB();
};

const runAPI = async (options) => {
  console.log(`Starting API service on network ${options.network}:${options.standby} port ${options.port}`);
  // await connectDB(options.network, !!options.standby);
  await serveAPI(options.network, !!options.standby, options.port);
  // await disconnectDB();
};

const parsePort = (value) => {
  try {
    let port = Number(value);
    if (port > 1000 && port < 65536) {
      return port;
    }
  } catch (e) {
    throw new commander.InvalidArgumentError('Not a valid port number');
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
      throw new commander.InvalidArgumentError('Not a valid network');
  }
  return network;
};

program
  .command('sync')
  .argument('<task>', 'task to run')
  .requiredOption('-n, --network <network>', 'Network to use', parseNetwork)
  .option('-s, --standby', 'Standby mode')
  .action(runSync);
program
  .command('api')
  .addOption(
    new Option('-n, --network <network>', 'Network to use')
      .env('API_NETWORK')
      .argParser(parseNetwork)
      .makeOptionMandatory(true)
  )
  .addOption(
    new Option('-p, --port <port>', 'Port to listen').env('API_PORT').argParser(parsePort).makeOptionMandatory(true)
  )
  .addOption(new Option('-s, --standby [no]', 'Standby mode').env('API_STANDBY').argParser(parseStandby))
  .action(runAPI);

(async () => {
  await program.parseAsync(process.argv);
})();

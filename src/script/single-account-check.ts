#!/usr/bin/env node
require('../utils/validateEnv');
import { BigNumber } from 'bignumber.js';
import { Network, WMTRDeposit, WMTRWithdrawal } from '../const';
import { disconnectDB } from '../utils/db';
import { BoundEvent, GetNetworkConfig, UnboundEvent } from '../const';
import { Net, Pos, fromWei } from '../utils';
import { Balance } from './types/balance';
import { ERC20 } from '@meterio/devkit';

const network = Network.MainNet;
const posConfig = GetNetworkConfig(network);
const net = new Net(posConfig.posUrl);
const pos = new Pos(network);
const MTRGSysContratAddr = '0x228ebBeE999c6a7ad74A6130E81b12f9Fe237Ba3'.toLowerCase();
const MTRSysContratAddr = '0x687A6294D0D6d63e751A059bf1ca68E4AE7B13E2'.toLowerCase();
const WMTRAddr = '0x160361ce13ec33c993b5cca8f62b6864943eb083'.toLowerCase();
const args = process.argv.slice(2);
const receipts = {};

if (args.length < 1) {
  console.log('Usage: ts-node single-account-check.ts [address]');
  process.exit(-1);
}
const acctAddress = args[0];
const acctAddressBytes32 = '0x' + acctAddress.replace('0x', '').padStart(64, '0').toLowerCase();

const startBlock = 9539811;

const handleEvent = async (evt: any, receipt: Flex.Meter.Receipt) => {
  let isSend = false;
  if (!evt.topics || evt.topics.length !== 3) {
    console.log("can't handle event: ", evt);
    return;
  }
  const amount = new BigNumber(evt.data);
  let paid = new BigNumber(0);
  let mtrDelta = new BigNumber(0);
  let mtrgDelta = new BigNumber(0);
  let token = '';
  if (evt.address.toLowerCase() === MTRGSysContratAddr) {
    token = 'MTRG';
  } else if (evt.address.toLowerCase() === MTRSysContratAddr) {
    token = 'MTR';
  } else {
    return;
  }

  let sender = '0x' + evt.topics[1].slice(-40);
  let recipient = '0x' + evt.topics[1].slice(-40);

  if (evt.topics[1].toLowerCase() === acctAddressBytes32) {
    // send
    isSend = true;
    if (token === 'MTR') {
      mtrDelta = mtrDelta.minus(amount);
    } else {
      mtrgDelta = mtrgDelta.minus(amount);
    }
    paid = new BigNumber(receipt.paid);
    // paid = new BigNumber(0);
  } else if (evt.topics[2].toLowerCase() === acctAddressBytes32) {
    // recv
    if (token === 'MTR') {
      mtrDelta = mtrDelta.plus(amount);
    } else {
      mtrgDelta = mtrgDelta.plus(amount);
    }
  }

  return {
    isSend,
    mtrDelta,
    mtrgDelta,
    amount,
    token,
    paid,
    blockNumber: evt.meta.blockNumber,
    sender,
    recipient,
    isSysContract: true,
  };
};

const handleTransfer = async (transfer: any, receipt: Flex.Meter.Receipt) => {
  const token = transfer.token === 1 ? 'MTRG' : 'MTR';
  const amount = new BigNumber(transfer.amount);
  let paid = new BigNumber(0);
  let isSend = false;
  let mtrDelta = new BigNumber(0);
  let mtrgDelta = new BigNumber(0);
  if (transfer.sender.toLowerCase() === acctAddress.toLowerCase()) {
    isSend = true;
    if (token === 'MTR') {
      mtrDelta = mtrDelta.minus(amount);
    } else {
      mtrgDelta = mtrgDelta.minus(amount);
    }
    paid = new BigNumber(receipt.paid);
    // paid = new BigNumber(0);
  }
  if (transfer.recipient.toLowerCase() === acctAddress.toLowerCase()) {
    isSend = false;
    if (token === 'MTR') {
      mtrDelta = mtrDelta.plus(amount);
    } else {
      mtrgDelta = mtrgDelta.plus(amount);
    }
  }

  return {
    isSend,
    mtrDelta,
    mtrgDelta,
    token,
    amount,
    paid,
    blockNumber: transfer.meta.blockNumber,
    sender: transfer.sender.toLowerCase(),
    recipient: transfer.recipient.toLowerCase(),
    isSysContract: false,
  };
};

const processAccount = async () => {
  const genesisBalance = await net.http<any>('GET', `accounts/${acctAddress}?revision=${startBlock}`);
  const chainAcc = await net.http<any>('GET', `accounts/${acctAddress}`);
  let mtr = new BigNumber(genesisBalance.energy);
  let mtrg = new BigNumber(genesisBalance.balance);
  let mtrBounded = new BigNumber(genesisBalance.boundenergy);
  let mtrgBounded = new BigNumber(genesisBalance.boundbalance);
  let balance = new Balance(acctAddress, mtr, mtrg, mtrBounded, mtrgBounded);
  console.log(`INIT Balance : ${balance.String()}`);
  let chainBalance = new Balance(
    acctAddress,
    chainAcc.energy,
    chainAcc.balance,
    chainAcc.boundenergy,
    chainAcc.boundbalance
  );

  const res = await net.http<any>('POST', 'logs/transfer', {
    body: {
      criteriaSet: [{ sender: acctAddress }, { recipient: acctAddress }],
      range: {
        unit: 'block',
        from: startBlock,
      },
    },
  });
  const transfers = res.sort((a, b) => a.meta.blockNumber - b.meta.blockNumber);
  const evtRes = await net.http<any>('POST', 'logs/event', {
    body: {
      criteriaSet: [
        // erc20 transfer out
        { topic0: ERC20.Transfer.signature, topic1: acctAddressBytes32 },
        // erc20 transfer in
        { topic0: ERC20.Transfer.signature, topic2: acctAddressBytes32 },
        // bound
        { topic0: BoundEvent.signature, topic2: acctAddressBytes32 },
        // unbound
        { topic0: UnboundEvent.signature, topic2: acctAddressBytes32 },
        // { topic0: WMTRDeposit.signature, topic1: acctAddressBytes32 },
        // { topic0: WMTRWithdrawal.signature, topic1: acctAddressBytes32 },
      ],
      range: {
        unit: 'block',
        from: startBlock,
      },
    },
  });
  const events = evtRes.sort((a, b) => a.meta.blockNumber - b.meta.blockNumber);
  let trSend = 0,
    trRecv = 0,
    scSend = 0,
    scRecv = 0;

  let outputs = transfers.concat(events);
  outputs = outputs.sort((a, b) => a.meta.blockNumber - b.meta.blockNumber);

  for (const o of outputs) {
    let d;
    let receipt: Flex.Meter.Receipt;
    const { txID } = o.meta;
    if (txID in receipts) {
      receipt = receipts[txID];
    } else {
      receipt = await pos.getReceipt(txID);
      receipts[txID] = receipt;
    }
    if ('topics' in o) {
      if (
        o.topics[0] ===
        ERC20.Transfer.signature /*'0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'*/
      ) {
        d = await handleEvent(o, receipt);
        if (!d) {
          continue;
        }
      } else if (
        o.topics[0] === BoundEvent.signature /*'0xcd509811b292f7fa41cc2c45a621fcd510e31a4dd5b0bb6b8b1ee3622a59e67d'*/
      ) {
        // handle bound
        const decoded = BoundEvent.decode(o.data, o.topics);
        console.log('Bound ', new BigNumber(decoded.amount).toFixed(), 'token:', decoded.token);
        if (decoded.token == 1) {
          balance.boundMTRG(decoded.amount);
        } else {
          balance.boundMTR(decoded.amount);
        }
        continue;
      } else if (
        o.topics[0] === UnboundEvent.signature /*'0x745b53e5ab1a6d7d25f17a8ed30cbd14d6706acb1b397c7766de275d7c9ba232'*/
      ) {
        // handle unbound
        const decoded = UnboundEvent.decode(o.data, o.topics);
        console.log('Unbound ', new BigNumber(decoded.amount).toFixed(), 'token:', decoded.token);
        if (decoded.token == 1) {
          balance.unboundMTRG(decoded.amount);
        } else {
          balance.unboundMTR(decoded.amount);
        }
        continue;
      } else if (o.topics[0] === WMTRDeposit.signature) {
        const decoded = WMTRDeposit.decode(o.data, o.topics);
        balance.minusMTR(decoded.amount);
        console.log(`Deposit`, fromWei(decoded.amount), 'token: MTR');
        continue;
      } else if (o.topics[0] === WMTRWithdrawal.signature) {
        const decoded = WMTRWithdrawal.decode(o.data, o.topics);
        balance.plusMTR(decoded.amount);
        console.log(`Withdraw`, fromWei(decoded.amount), 'token: MTR');
        continue;
      }
    } else {
      d = await handleTransfer(o, receipt);
    }
    console.log('----------------------------------------------------------------------');
    console.log(`Block ${d.blockNumber}`);
    console.log(
      `${d.isSysContract ? '[SysContract] ' : ''} ${d.isSend ? 'Sent' : 'Recv'} ${fromWei(d.amount)} ${d.token} ${
        d.isSend ? 'to' : 'from'
      } ${d.isSend ? d.recipient : d.sender}`
    );
    console.log(receipt.meta.txID);
    balance.plusMTR(d.mtrDelta);
    balance.plusMTRG(d.mtrgDelta);
    if (d.paid.isGreaterThan(0) && d.sender.toLowerCase() === receipt.gasPayer.toLowerCase()) {
      console.log(`Fee: ${fromWei(d.paid)} MTR`);
      balance.minusMTR(d.paid);
    }
    console.log(`Balance after ${balance.String()}`);
    if (d.isSysContract) {
      d.isSend ? scSend++ : scRecv++;
    } else {
      d.isSend ? trSend++ : trRecv++;
    }
  }

  console.log('======================================================================');
  console.log(`Address: ${acctAddress}`);
  console.log(`Transfer    Sent: ${trSend}, Recv: ${trRecv}`);
  console.log(`SysContract Sent: ${scSend}, Recv: ${scRecv}`);
  const mtrMatch = balance.MTR().isEqualTo(chainBalance.MTR());
  const mtrgMatch = balance.MTRG().isEqualTo(chainBalance.MTRG());
  console.log(`Balance FINAL : ${balance.String()}`);
  console.log(`Balance CHAIN : ${chainBalance.String()}`);
  console.log(`MTR: ${mtrMatch ? 'match' : 'MISMATCH!!'}, MTRG: ${mtrgMatch ? 'match' : 'MISMATCH!!'}`);
};

(async () => {
  try {
    await processAccount();
    await disconnectDB();
  } catch (e) {
    console.log('error happened: ', e);
  }
})();

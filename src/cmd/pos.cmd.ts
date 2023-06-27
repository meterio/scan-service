import { EventEmitter } from 'events';

import { abi, cry, ERC20, ERC1155, ERC721 } from '@meterio/devkit';
import { ScriptEngine } from '@meterio/devkit';
import { AdminChangedEvent, BeaconUpgradedEvent, DeployStatus, EmptyBytes32, Network, UpgradedEvent } from '../const';
import {
  BlockRepo,
  BoundRepo,
  CommitteeRepo,
  HeadRepo,
  MovementRepo,
  TxDigestRepo,
  TxRepo,
  UnboundRepo,
  ContractRepo,
  TokenBalanceRepo,
  MetricRepo,
  AccountRepo,
  LogEventRepo,
  LogTransferRepo,
  InternalTxRepo,
  ContractFileRepo,
  BucketRepo,
} from '../repo';
import { Token, ContractType, BlockType } from '../const';
import {
  Block,
  BlockConcise,
  Bound,
  Committee,
  CommitteeMember,
  TxOutput,
  Movement,
  Clause,
  LogTransfer,
  InternalTx,
  Account,
  LogEvent,
  Unbound,
  VMError,
  TraceOutput,
  TokenBalance,
  NFTTransfer,
  Contract,
  Head,
  Tx,
  TxDigest,
  Bucket,
} from '../model';
import { BigNumber } from 'bignumber.js';
import { sha1 } from 'object-hash';
import pino from 'pino';
import { Keccak } from 'sha3';

import {
  BoundEvent,
  GetNetworkConfig,
  TokenBasic,
  UnboundEvent,
  ZeroAddress,
  getSysContractToken,
  prototype,
  getAccountName,
  ParamsAddress,
  WMTRDeposit,
  WMTRWithdrawal,
} from '../const';
import { Pos, fromWei, isHex } from '../utils';
import { InterruptedError, isTraceable, sleep } from '../utils';
import { CMD } from './cmd';
import { newIterator, LogItem } from '../utils/log-traverser';
import { AccountCache, TokenBalanceCache } from '../types';
import { MetricName, getPreAllocAccount } from '../const';
import { KeyTransactionFeeAddress } from '../const/key';
import { Withdraw } from '../model/withdraw.interface';
import WithdrawRepo from '../repo/withdraw.repo';
import { Script } from 'vm';
import { decode } from 'punycode';

const Web3 = require('web3');
const meterify = require('meterify').meterify;

const FASTFORWARD_INTERVAL = 300; // 0.3 second gap between each loop
const NORMAL_INTERVAL = 2000; // 2 seconds gap between each loop
const PRELOAD_WINDOW = 100;
const LOOP_WINDOW = 100;
const RECOVERY_INTERVAL = 2 * 60 * 1000; // 2 min for recovery

// ERC-1967 standard (Proxy Storage Slots)
// https://eips.ethereum.org/EIPS/eip-1967
const Logic_StorageSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const Beacon_StorageSlot = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const Admin_StorageSlot = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

// ERC-1167 standard (Minimal Proxy Contract)
// https://eips.ethereum.org/EIPS/eip-1967
// address embeded at bytes 10 to 29 (inclusive)
const Minimal_Proxy = '363d3d373d3d3d363d73bebebebebebebebebebebebebebebebebebebebe5af43d82803e903d91602b57fd5bf3';

const revertReasonSelector = '0x' + cry.keccak256('Error(string)').toString('hex').slice(0, 8);
const panicErrorSelector = '0x' + cry.keccak256('Panic(uint256)').toString('hex').slice(0, 8);

export class PosCMD extends CMD {
  private shutdown = false;
  private ev = new EventEmitter();
  private name = 'pos';

  private web3: any;

  private blockRepo = new BlockRepo();
  private txRepo = new TxRepo();
  private headRepo = new HeadRepo();
  private committeeRepo = new CommitteeRepo();
  private txDigestRepo = new TxDigestRepo();
  private movementRepo = new MovementRepo();
  private boundRepo = new BoundRepo();
  private unboundRepo = new UnboundRepo();
  private withdrawRepo = new WithdrawRepo();
  private contractRepo = new ContractRepo();
  private contractFileRepo = new ContractFileRepo();
  private accountRepo = new AccountRepo();
  private tokenBalanceRepo = new TokenBalanceRepo();
  private logEventRepo = new LogEventRepo();
  private logTransferRepo = new LogTransferRepo();
  private internalTxRepo = new InternalTxRepo();
  private bucketRepo = new BucketRepo();

  private metricRepo = new MetricRepo(); // readonly

  private pos: Pos;
  private network: Network;

  private mtrSysToken: TokenBasic;
  private mtrgSysToken: TokenBasic;
  private mtrgV2SysToken: TokenBasic;

  // cache
  private blocksCache: Block[] = [];
  private txsCache: Tx[] = [];
  private committeesCache: Committee[] = [];
  private txDigestsCache: TxDigest[] = [];
  private movementsCache: Movement[] = [];
  private boundsCache: Bound[] = [];
  private unboundsCache: Unbound[] = [];
  private withdrawCache: Withdraw[] = [];
  private rebasingsCache: string[] = [];
  private contractsCache: Contract[] = [];
  private accountCache: AccountCache;
  private tokenBalanceCache: TokenBalanceCache;
  private beneficiaryCache = ZeroAddress;
  private logEventCache: LogEvent[] = [];
  private logTransferCache: LogTransfer[] = [];
  private internalTxCache: InternalTx[] = [];

  constructor(net: Network) {
    super();
    const dest = pino.destination({ sync: true });
    this.log = pino({
      transport: {
        target: 'pino-pretty',
      },
    });
    this.pos = new Pos(net);
    this.network = net;
    this.mtrSysToken = getSysContractToken(this.network, Token.MTR);
    this.mtrgSysToken = getSysContractToken(this.network, Token.MTRG);
    this.mtrgV2SysToken = getSysContractToken(this.network, Token.MTRGV2);
    this.tokenBalanceCache = new TokenBalanceCache(net);
    const posConfig = GetNetworkConfig(net);
    this.web3 = meterify(new Web3(), posConfig.posUrl);
    this.accountCache = new AccountCache(this.network);
    this.cleanCache();
  }

  public async start() {
    this.log.info(`${this.name}: start`);
    await this.loop();
    return;
  }

  public stop() {
    this.shutdown = true;
  }

  private cleanCache() {
    this.blocksCache = [];
    this.txsCache = [];
    this.committeesCache = [];

    this.txDigestsCache = [];
    this.movementsCache = [];
    this.boundsCache = [];
    this.unboundsCache = [];
    this.withdrawCache = [];

    this.contractsCache = [];
    this.accountCache.clean();
    this.tokenBalanceCache.clean();
    this.rebasingsCache = [];
    // this.beneficiaryCache = ZeroAddress;

    this.logEventCache = [];
    this.logTransferCache = [];
    this.internalTxCache = [];
  }

  private async getBlockFromREST(num: number) {
    const b = await this.pos.getBlock(num, 'expanded');

    // preload blocks
    (async () => {
      for (let i = 1; i <= PRELOAD_WINDOW; i++) {
        await this.pos.getBlock(num + i, 'expanded');
      }
    })().catch();
    return b;
  }

  private async fixAccount(acct: Account & { save() }, blockNum: number) {
    this.log.info(`Start to fix account on block ${blockNum}`);
    const blk = await this.blockRepo.findByNumber(blockNum);
    if (!blk) {
      this.log.info(`[WARN] could not find block ${blockNum}`);
      return;
    }
    const blockConcise = { number: blk.number, timestamp: blk.timestamp, hash: blk.hash } as BlockConcise;
    const chainAcc = await this.pos.getAccount(acct.address, blockNum.toString());

    const balance = new BigNumber(chainAcc.balance);
    const energy = new BigNumber(chainAcc.energy);
    const boundedBalance = new BigNumber(chainAcc.boundbalance);
    const boundedEnergy = new BigNumber(chainAcc.boundenergy);
    if (
      acct.mtrgBalance.toFixed() !== balance.toFixed() ||
      acct.mtrBalance.toFixed() !== energy.toFixed() ||
      acct.mtrgBounded.toFixed() !== boundedBalance.toFixed() ||
      acct.mtrBounded.toFixed() !== boundedEnergy.toFixed()
    ) {
      const preMTR = acct.mtrBalance;
      const preMTRG = acct.mtrgBalance;
      const preBoundedMTR = acct.mtrBounded;
      const preBoundedMTRG = acct.mtrgBounded;
      acct.mtrBalance = energy;
      acct.mtrgBalance = balance;
      acct.mtrBounded = boundedEnergy;
      acct.mtrgBounded = boundedBalance;
      acct.lastUpdate = blockConcise;
      await acct.save();

      this.log.info(`Fixed Account ${acct.address}:`);
      if (!preMTR.isEqualTo(energy)) {
        this.log.info(`  MTR: ${fromWei(preMTR)} -> ${fromWei(energy)} `);
      }
      if (!preMTRG.isEqualTo(balance)) {
        this.log.info(`  MTRG: ${fromWei(preMTRG)} -> ${fromWei(balance)}`);
      }
      if (!preBoundedMTR.isEqualTo(boundedEnergy)) {
        this.log.info(`  Bounded MTR: ${fromWei(preBoundedMTR)} -> ${fromWei(boundedEnergy)}`);
      }
      if (!preBoundedMTRG.isEqualTo(boundedBalance)) {
        this.log.info(`  Bounded MTRG: ${fromWei(preBoundedMTRG)} -> ${fromWei(boundedBalance)}`);
      }
    }
  }

  private async fixTokenBalance(bal: TokenBalance & { save() }, blockNum: number) {
    this.log.info(`Start to fix token balance on block ${blockNum}`);
    const blk = await this.blockRepo.findByNumber(blockNum);
    if (!blk) {
      this.log.info(`[WARN] could not find block ${blockNum}`);
      return;
    }
    const blockConcise = { number: blk.number, timestamp: blk.timestamp, hash: blk.hash } as BlockConcise;
    const chainBal = await this.pos.getERC20BalanceOf(bal.address, bal.tokenAddress, blockNum.toString());

    const preBal = bal.balance;
    if (!preBal.isEqualTo(chainBal)) {
      bal.balance = new BigNumber(chainBal);
      this.log.info(`Fixed balance on ${bal.address} for token ${bal.tokenAddress}:`);
      this.log.info(`  Balance: ${preBal.toFixed()} -> ${bal.balance.toFixed()}`);
      bal.lastUpdate = blockConcise;
      await bal.save();
    }
  }

  private async updateTxFeeBeneficiary(head: Head) {
    const txFeeAddr = await this.pos.getStorage(ParamsAddress, KeyTransactionFeeAddress, head.hash);
    if (!!txFeeAddr && txFeeAddr.value) {
      const addrVal = txFeeAddr.value;
      const n = 40;
      const newBeneficiary = '0x' + addrVal.substring(addrVal.length - n);
      if (newBeneficiary !== this.beneficiaryCache) {
        this.log.info('Beneficiary updated to :', newBeneficiary);
        this.beneficiaryCache = newBeneficiary;
        await this.metricRepo.update(MetricName.TX_FEE_BENEFICIARY, newBeneficiary);
      }
    }
  }

  public async cleanUpIncompleteData(head: Head) {
    const blockNum = head.num;
    const blockHash = head.hash;
    // delete invalid/incomplete blocks
    this.log.info(`Start to fix dirty data on block ${blockNum}`);
    const block = await this.blockRepo.deleteAfter(blockNum);
    const tx = await this.txRepo.deleteAfter(blockNum);
    const logEvent = await this.logEventRepo.deleteAfter(blockNum);
    const logTransfer = await this.logTransferRepo.deleteAfter(blockNum);
    const committee = await this.committeeRepo.deleteAfter(blockNum);
    const bound = await this.boundRepo.deleteAfter(blockNum);
    const unbound = await this.unboundRepo.deleteAfter(blockNum);
    const txDigest = await this.txDigestRepo.deleteAfter(blockNum);
    const movement = await this.movementRepo.deleteAfter(blockNum);
    const contract = await this.contractRepo.deleteAfter(blockNum);
    const internalTxs = await this.internalTxRepo.deleteAfter(blockNum);
    const accts = await this.accountRepo.findLastUpdateAfter(blockNum);
    for (const acct of accts) {
      await this.fixAccount(acct, blockNum);
    }
    const incorrectAccts = await this.accountRepo.findIncorrect();
    for (const acct of incorrectAccts) {
      await this.fixAccount(acct, blockNum);
    }
    const bals = await this.tokenBalanceRepo.findLastUpdateAfter(blockNum);
    for (const bal of bals) {
      await this.fixTokenBalance(bal, blockNum);
    }
    const incorrectBals = await this.tokenBalanceRepo.findIncorrect();
    for (const bal of incorrectBals) {
      await this.fixTokenBalance(bal, blockNum);
    }
    this.log.info(
      {
        block,
        tx,
        logEvent,
        logTransfer,
        committee,
        bound,
        unbound,
        txDigest,
        movement,
        contract,
        accounts: accts.length,
        tokenBalance: bals.length,
        internalTxs,
      },
      `deleted dirty data higher than head ${blockNum}`
    );
  }

  public async loop() {
    let fastforward = true;

    let head = await this.headRepo.findByKey(this.name);
    if (head) {
      await this.cleanUpIncompleteData(head);
    }

    for (;;) {
      try {
        if (this.shutdown) {
          throw new InterruptedError();
        }

        let head = await this.headRepo.findByKey(this.name);
        let headNum = !!head ? head.num : -1;

        if (headNum === -1) {
          await this.processGenesis();
        } else {
          await this.updateTxFeeBeneficiary(head);
        }

        const bestNum = await this.web3.eth.getBlockNumber();
        let endNum = headNum + LOOP_WINDOW > bestNum ? bestNum : headNum + LOOP_WINDOW;
        fastforward = endNum < bestNum;

        if (endNum <= headNum) {
          this.log.info(
            { best: bestNum, head: headNum, mode: fastforward ? 'fast-forward' : 'normal' },
            `skip this import round`
          );
          await sleep(NORMAL_INTERVAL);
          continue;
        }

        this.log.info(
          { mode: fastforward ? 'fast-forward' : 'normal' },
          `start import PoS block from number ${headNum + 1} to ${endNum}`
        );
        // begin import round from headNum+1 to tgtNum
        for (let num = headNum + 1; num <= endNum; num++) {
          // fetch block from RESTful API
          const blk = await this.getBlockFromREST(num);

          if (!blk) {
            this.log.info('block is empty');
            await sleep(FASTFORWARD_INTERVAL);
            continue;
          }
          // process block
          try {
            await this.processBlock(blk);
          } catch (e) {
            this.log.error({ err: e }, `Error happened during block processing for:`, blk.number);
            this.log.error(`sleep for ${RECOVERY_INTERVAL / 1000 / 60} mintues, hope it will recover`);
            await sleep(RECOVERY_INTERVAL);
            throw new InterruptedError();
          }

          if (!fastforward) {
            // step over mode
            // save blocks/txs along the way
            await this.saveCacheToDB();
            this.cleanCache();
          }
        }

        if (fastforward) {
          // fastforward mode, save blocks/txs with bulk insert
          await this.saveCacheToDB();
          this.cleanCache();
          this.beneficiaryCache = ZeroAddress;
          await sleep(FASTFORWARD_INTERVAL);
        } else {
          await sleep(NORMAL_INTERVAL);
        }
      } catch (e) {
        if (e instanceof InterruptedError) {
          this.log.info('quit loop');
          break;
        } else {
          this.log.error({ err: e }, 'Error happened in loop: ', e);

          const start = new Date().getTime();
          let head = await this.headRepo.findByKey(this.name);
          if (head) {
            await this.cleanUpIncompleteData(head);
          }
          const elapsed = new Date().getTime() - start;

          this.log.info(`clean up elapsed: ${elapsed / 1000} seconds`);
          this.log.error(`sleep for ${RECOVERY_INTERVAL / 1000 / 60} minutes, hope it will resolve`);
          await sleep(RECOVERY_INTERVAL - elapsed);
        }
      }
    }
  }

  async saveCacheToDB() {
    if (this.txsCache.length > 0) {
      await this.txRepo.bulkInsert(...this.txsCache);
      this.log.info(`saved ${this.txsCache.length} txs`);
    }
    if (this.logEventCache.length > 0) {
      await this.logEventRepo.bulkInsert(...this.logEventCache);
      this.log.info(`saved ${this.logEventCache.length} logEvents`);
    }
    if (this.logTransferCache.length > 0) {
      await this.logTransferRepo.bulkInsert(...this.logTransferCache);
      this.log.info(`saved ${this.logTransferCache.length} logTransfers`);
    }
    if (this.committeesCache.length > 0) {
      await this.committeeRepo.bulkInsert(...this.committeesCache);
      this.log.info(`saved ${this.committeesCache.length} committees`);
    }

    if (this.txDigestsCache.length > 0) {
      await this.txDigestRepo.bulkInsert(...this.txDigestsCache);
      this.log.info(`saved ${this.txDigestsCache.length} tx digests`);
    }
    if (this.movementsCache.length > 0) {
      await this.movementRepo.bulkInsert(...this.movementsCache);
      for (const mvt of this.movementsCache) {
        if (mvt.token === Token.ERC20 && (mvt.from === ZeroAddress || mvt.to === ZeroAddress)) {
          this.log.info({ token: mvt.tokenAddress }, `mint/burn noticed, update totalSupply for ERC20 token`);
          const erc20Data = await this.pos.fetchERC20Data(mvt.tokenAddress, '');
          const tokenContract = await this.contractRepo.findByAddress(mvt.tokenAddress);
          if (tokenContract && tokenContract.type === ContractType.ERC20) {
            tokenContract.totalSupply = new BigNumber(erc20Data.totalSupply);
            await tokenContract.save();
            this.log.info({ token: mvt.tokenAddress, totalSupply: erc20Data.totalSupply }, `token totalSupply updated`);
          }
        }
      }
      this.log.info(`saved ${this.movementsCache.length} movements`);
    }
    if (this.boundsCache.length > 0) {
      await this.boundRepo.bulkInsert(...this.boundsCache);
      this.log.info(`saved ${this.boundsCache.length} bounds`);
    }
    if (this.unboundsCache.length > 0) {
      await this.unboundRepo.bulkInsert(...this.unboundsCache);
      this.log.info(`saved ${this.unboundsCache.length} unbounds`);
    }
    if (this.withdrawCache.length > 0) {
      await this.withdrawRepo.bulkInsert(...this.withdrawCache);
      this.log.info(`saved ${this.withdrawCache.length} withdraws`);
    }

    if (this.contractsCache.length > 0) {
      for (const c of this.contractsCache) {
        // find if contract address existed before
        const ec = await this.contractRepo.findByAddress(c.address);
        if (ec) {
          this.log.info(`save contract ${c.address} with existing`);
          if (ec.deployStatus && ec.deployStatus === DeployStatus.SelfDestructed) {
            // if contract was self-destructed, delete this and save the latest info
            await ec.delete();
            await this.contractFileRepo.deleteByContract(c.address);
            c.deployStatus = DeployStatus.ReDeployed;
            await this.contractRepo.bulkInsert(c);
          } else {
            throw new Error(`contract ${c.address} existed`);
          }
        } else {
          this.log.info(`save contract ${c.address}`);
          await this.contractRepo.bulkInsert(c);
        }
      }
      // await this.contractRepo.bulkInsert(...this.contractsCache);
      this.log.info(`saved ${this.contractsCache.length} contracts`);
    }
    if (this.internalTxCache.length > 0) {
      await this.internalTxRepo.bulkInsert(...this.internalTxCache);
      this.log.info(`saved ${this.internalTxCache.length} internalTxs`);
    }
    await this.accountCache.saveToDB();
    await this.tokenBalanceCache.saveToDB();
    if (this.blocksCache.length > 0) {
      const first = this.blocksCache[0];
      const last = this.blocksCache[this.blocksCache.length - 1];
      await this.blockRepo.bulkInsert(...this.blocksCache);
      // this.log.info(`saved ${this.blocksCache.length} blocks`);
      // update head
      await this.updateHead(last.number, last.hash);

      this.log.info(`saved ${this.blocksCache.length} blocks in [${first.number}, ${last.number}]`);
      this.log.info(`update head to ${last.number}`);
    }
    this.log.debug('handling rebasing');
    await this.handleRebasing();
    this.log.debug('done handling rebasing');
  }

  async updateHead(num, hash): Promise<Head> {
    const exist = await this.headRepo.exists(this.name);
    if (!exist) {
      return await this.headRepo.create(this.name, num, hash);
    } else {
      let head = await this.headRepo.findByKey(this.name);
      // this.log.info({ num: num }, 'update head');
      // head = await this.headRepo.update(this.name, res.block.number, res.block.hash);
      head.num = num;
      head.hash = hash;
      return await head.save();
    }
  }

  async handleContractCreation(
    evt: Flex.Meter.Event,
    txHash: string,
    blockConcise: BlockConcise,
    tracer: Pos.CallTracerOutput | undefined
  ) {
    if (!evt.topics || evt.topics[0] !== prototype.$Master.signature) {
      return;
    }

    const codeRes = await this.pos.getCode(evt.address, blockConcise.hash);
    let code: string | undefined = undefined;
    if (codeRes) {
      // there's a case where tx create a contract address with no code
      // take a look at this: http://testnet.meter.io:8669/transactions/0xf2a9e4f458ace6488e03b7c4e050bca888e0c2da1acd6437629496fb40d160ef
      code = codeRes.code;
    }
    const decoded = prototype.$Master.decode(evt.data, evt.topics);
    const master = decoded.newMaster;

    let verified = false;
    let verifiedFrom = '';
    let status = '';
    const hash = new Keccak(256);
    hash.update(code.replace('0x', ''));
    const codeHash = hash.digest('hex');
    let creationInputHash = '';

    if (tracer) {
      try {
        // find creationInput in tracing
        let q = [tracer];
        while (q.length) {
          const node = q.shift();
          if (node.calls) {
            for (const c of node.calls) {
              q.push(c);
            }
          }
          if ((node.type === 'CREATE' || node.type === 'CREATE2') && node.to === evt.address) {
            const creationInput = node.input;
            const hash = new Keccak(256);
            hash.update(creationInput.replace('0x', ''));
            creationInputHash = hash.digest('hex');
            break;
          }
        }

        // creation-match verification
        // if verified contract is found by the same input data, recognize the newly deployed contract as verified
        const verifiedContract = await this.contractRepo.findVerifiedContractsWithCreationInputHash(creationInputHash);
        if (verifiedContract) {
          verified = true;
          status = 'match';
          verifiedFrom = verifiedContract.address;
        }
      } catch (e) {
        this.log.error({ err: e }, 'decode tracing error');
      }
    }

    // code-match verification
    const verifiedContract = await this.contractRepo.findVerifiedContractWithCodeHash(codeHash);
    if (verifiedContract) {
      verified = true;
      status = 'match';
      verifiedFrom = verifiedContract.address;
    }

    let c: Contract = {
      type: ContractType.Unknown,
      name: '',
      symbol: '',
      decimals: 0,
      address: evt.address,
      officialSite: '',
      totalSupply: new BigNumber(0),
      holdersCount: new BigNumber(0),
      transfersCount: new BigNumber(0),
      tokensCount: new BigNumber(0),
      creationTxHash: txHash,
      creationInputHash,
      codeHash,
      master: master.toLowerCase(),
      owner: master.toLowerCase(),
      code,
      status,
      verified,
      verifiedFrom,
      firstSeen: blockConcise,
    };

    // proxy detection
    const implAddr = await this.pos.getStorage(evt.address, Logic_StorageSlot);
    const adminAddr = await this.pos.getStorage(evt.address, Admin_StorageSlot);
    const beaconAddr = await this.pos.getStorage(evt.address, Beacon_StorageSlot);
    if (implAddr.value != EmptyBytes32 || beaconAddr.value != EmptyBytes32) {
      // is standard proxy
      c.isProxy = true;
      c.proxyType = 'ERC-1967';
      c.implAddr = '0x' + implAddr.value.substring(26);
      c.adminAddr = '0x' + adminAddr.value.substring(26);
      c.beaconAddr = '0x' + beaconAddr.value.substring(26);
      this.log.info(
        { implAddr: c.implAddr, adminAddr: c.adminAddr, beaconAddr: c.beaconAddr },
        'Identified as standard proxy'
      );
    }

    // mini proxy detection
    const codeHex = code.replace('0x', '');
    if (codeHex.startsWith(Minimal_Proxy.substring(0, 20)) && codeHex.endsWith(Minimal_Proxy.substring(60))) {
      // is minimal proxy
      c.isProxy = true;
      c.proxyType = 'ERC-1167';
      c.implAddr = '0x' + codeHex.substring(20, 60);
      this.log.info({ implAddr: c.implAddr }, 'Identified as min proxy');
    }

    const e721_1155 = await this.pos.fetchERC721AndERC1155Data(evt.address, blockConcise.hash);
    if (e721_1155 && (e721_1155.supports721 || e721_1155.supports1155)) {
      c.type = e721_1155.supports721 ? ContractType.ERC721 : ContractType.ERC1155;
      c.name = e721_1155.name;
      c.symbol = e721_1155.symbol;
    } else {
      const erc20 = await this.pos.fetchERC20Data(evt.address, blockConcise.hash);
      if (erc20 && !!erc20.symbol && !!erc20.decimals) {
        c.type = ContractType.ERC20;
        c.name = erc20.name;
        c.symbol = erc20.symbol;
        c.decimals = erc20.decimals;
      }
    }
    this.log.info(c, 'found contract: ');
    this.contractsCache.push(c);
  }

  async handleSelfdestruct(tracer: Pos.CallTracerOutput | undefined, txHash: string, block: BlockConcise) {
    let destructedContracts = {};
    try {
      if (tracer) {
        // find creationInput in tracing
        let q = [tracer];
        while (q.length) {
          const node = q.shift();
          if (node.calls) {
            for (const c of node.calls) {
              q.push(c);
            }
          }
          if (node.type === 'SELFDESTRUCT') {
            destructedContracts[node.from] = { txHash, block };
          }
        }
      }

      //
      if (Object.keys(destructedContracts).length > 0) {
        for (const addr in destructedContracts) {
          this.log.info(`found selfdestructed contract ${addr}`);
          const { block, txHash } = destructedContracts[addr];
          let inCache = false;
          for (const c of this.contractsCache) {
            if (c.address.toLowerCase() === addr.toLowerCase()) {
              c.deployStatus = DeployStatus.SelfDestructed;
              c.destructTxHash = txHash;
              c.destructBlock = block;
              inCache = true;
              break;
            }
          }

          if (!inCache) {
            let c = await this.contractRepo.findByAddress(addr);
            if (c) {
              c.deployStatus = DeployStatus.SelfDestructed;
              c.destructTxHash = txHash;
              c.destructBlock = block;
              await c.save();
            }
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
  async handleERC1967Events(evt: Flex.Meter.Event) {
    try {
      if (evt.topics && evt.topics[0] && evt.topics[0] == UpgradedEvent.signature) {
        const decoded = UpgradedEvent.decode(evt.data, evt.topics);
        let inCache = false;
        for (const c of this.contractsCache) {
          if (c.address.toLowerCase() === evt.address.toLowerCase()) {
            if (c.implAddr !== decoded.implementation) {
              c.prevImplAddr = c.implAddr;
              c.implAddr = decoded.implementation;
              this.log.info(
                { prevImplAddr: c.prevImplAddr, implAddr: c.implAddr },
                `update impl for proxy ${evt.address} in cache`
              );
              inCache = true;
              break;
            }
          }
        }
        if (!inCache) {
          let c = await this.contractRepo.findByAddress(evt.address);
          if (c && c.implAddr !== decoded.implementation) {
            c.prevImplAddr = c.implAddr;
            c.implAddr = decoded.implementation;
            this.log.info(
              { prevImplAddr: c.prevImplAddr, implAddr: c.implAddr },
              `update impl for proxy ${evt.address} in db`
            );
            await c.save();
          }
        }
      }
      if (evt.topics && evt.topics[0] && evt.topics[0] == BeaconUpgradedEvent.signature) {
        const decoded = BeaconUpgradedEvent.decode(evt.data, evt.topics);
        let inCache = false;
        for (const c of this.contractsCache) {
          if (c.address.toLowerCase() === evt.address.toLowerCase()) {
            c.beaconAddr = decoded.beacon;
            this.log.info({ beaconAddr: c.beaconAddr }, `update beacon for proxy ${evt.address} in cache`);

            inCache = true;
            break;
          }
        }
        if (!inCache) {
          let c = await this.contractRepo.findByAddress(evt.address);
          if (c && c.beaconAddr !== decoded.beacon) {
            c.beaconAddr = decoded.beacon;
            this.log.info({ beaconAddr: c.beaconAddr }, `update beacon for proxy ${evt.address} in db`);
            await c.save();
          }
        }
      }
      if (evt.topics && evt.topics[0] && evt.topics[0] == AdminChangedEvent.signature) {
        const decoded = AdminChangedEvent.decode(evt.data, evt.topics);
        let inCache = false;
        for (const c of this.contractsCache) {
          if (c.address.toLowerCase() === evt.address.toLowerCase()) {
            c.adminAddr = decoded.newAdmin;
            this.log.info({ adminAddr: c.adminAddr }, `update admin for proxy ${evt.address} in cache`);
            inCache = true;
            break;
          }
        }
        if (!inCache) {
          let c = await this.contractRepo.findByAddress(evt.address);
          if (c && c.adminAddr !== decoded.newAdmin) {
            c.adminAddr = decoded.newAdmin;
            this.log.info({ adminAddr: c.adminAddr }, `update admin for proxy ${evt.address} in db`);
            await c.save();
          }
        }
      }
    } catch (e) {
      this.log.error(e, 'could not handle ERC-1967');
      return;
    }
  }

  async handleBound(
    evt: Flex.Meter.Event,
    txHash: string,
    clauseIndex: number,
    logIndex: number,
    blockConcise: BlockConcise
  ) {
    if (!evt.topics || evt.topics[0] != BoundEvent.signature) {
      return;
    }
    const decoded = BoundEvent.decode(evt.data, evt.topics);
    const owner = decoded.owner.toLowerCase();
    const token = decoded.token == 1 ? Token.MTRG : Token.MTR;
    const amount = new BigNumber(decoded.amount.toString());
    this.boundsCache.push({
      owner,
      amount,
      token,
      txHash,
      block: blockConcise,
      clauseIndex,
      logIndex,
    });
    await this.accountCache.bound(owner, token, amount, blockConcise);
  }

  async handleNativeBucketEvent(
    evt: Flex.Meter.Event,
    txHash: string,
    clauseIndex: number,
    logIndex: number,
    blockConcise: BlockConcise
  ) {
    if (!evt.topics || evt.topics.length <= 0) {
      return;
    }
    let bucketIDs = [];

    try {
      var decoded: abi.Decoded;
      switch (evt.topics[0]) {
        case ScriptEngine.NativeBucketOpen.signature:
          decoded = ScriptEngine.NativeBucketOpen.decode(evt.data, evt.topics);
          bucketIDs.push(decoded.bucketID);
          break;

        case ScriptEngine.NativeBucketClose.signature:
          decoded = ScriptEngine.NativeBucketClose.decode(evt.data, evt.topics);
          bucketIDs.push(decoded.bucketID);
          break;

        case ScriptEngine.NativeBucketDeposit.signature:
          decoded = ScriptEngine.NativeBucketDeposit.decode(evt.data, evt.topics);
          bucketIDs.push(decoded.bucketID);
          break;

        case ScriptEngine.NativeBucketWithdraw.signature:
          decoded = ScriptEngine.NativeBucketWithdraw.decode(evt.data, evt.topics);
          const owner = decoded.owner.toLowerCase();
          const recipient = decoded.recipient.toLowerCase();
          const token = decoded.token == 1 ? Token.MTRG : Token.MTR;
          const amount = new BigNumber(decoded.amount.toString());
          this.withdrawCache.push({
            owner,
            recipient,
            amount,
            token,
            txHash,
            block: blockConcise,
            clauseIndex,
            logIndex,
          });
          bucketIDs.push(decoded.fromBktID);
          bucketIDs.push(decoded.toBktID);
          await this.accountCache.withdraw(owner, recipient, token, amount, blockConcise);
          break;

        case ScriptEngine.NativeBucketMerge.signature:
          decoded = ScriptEngine.NativeBucketMerge.decode(evt.data, evt.topics);
          bucketIDs.push(decoded.fromBktID);
          bucketIDs.push(decoded.toBktID);
          break;

        case ScriptEngine.NativeBucketTransferFund.signature:
          decoded = ScriptEngine.NativeBucketTransferFund.decode(evt.data, evt.topics);
          bucketIDs.push(decoded.fromBktID);
          bucketIDs.push(decoded.toBktID);
          break;

        case ScriptEngine.NativeBucketUpdateCandidate.signature:
          decoded = ScriptEngine.NativeBucketUpdateCandidate.decode(evt.data, evt.topics);
          bucketIDs.push(decoded.bucketID);
          break;
      }
      if (bucketIDs.length > 0) {
        for (const id of bucketIDs) {
          console.log('bucket needs update: ', id);
          const b = await this.pos.getBucketByID(id);
          const bkt = await this.bucketRepo.findByID(b.id);
          if (bkt) {
            bkt.value = new BigNumber(b.value);
            bkt.bonusVotes = new BigNumber(b.totalVotes).minus(b.value);
            bkt.totalVotes = new BigNumber(b.totalVotes);
            bkt.candidate = b.candidate;
            bkt.autobid = b.autobid;
            bkt.unbounded = b.unbounded;
            bkt.matureTime = b.matureTime;
            bkt.calcLastTime = b.calcLastTime;
            await bkt.save();
            console.log('update bucket: ', bkt);
          } else {
            const newBkt = await this.bucketRepo.create({
              ...b,
              value: new BigNumber(b.value),
              bonusVotes: new BigNumber(b.totalVotes).minus(b.value),
              totalVotes: new BigNumber(b.totalVotes),
            });
            console.log('create bucket: ', newBkt);
          }
        }

        // this.log.info(`update buckets: ${bucketIDs}`);
        // await this.bucketRepo.bulkUpsert(...buckets);
      }
    } catch (e) {
      console.log('error happened during native bucket event handling: ', e);
    }
  }

  async handleUnbound(
    evt: Flex.Meter.Event,
    txHash: string,
    clauseIndex: number,
    logIndex: number,
    blockConcise: BlockConcise
  ) {
    if (!evt.topics || evt.topics[0] !== UnboundEvent.signature) {
      return;
    }
    const decoded = UnboundEvent.decode(evt.data, evt.topics);
    const owner = decoded.owner.toLowerCase();
    const token = decoded.token == 1 ? Token.MTRG : Token.MTR;
    const amount = new BigNumber(decoded.amount.toString());
    this.unboundsCache.push({
      owner,
      amount: new BigNumber(decoded.amount.toString()),
      token: decoded.token == 1 ? Token.MTRG : Token.MTR,
      txHash,
      block: blockConcise,
      clauseIndex,
      logIndex,
    });
    await this.accountCache.unbound(owner, token, amount, blockConcise);
  }

  async parseERC20Movement(
    logIndex: number,
    evt: Flex.Meter.Event,
    clauseIndex: number,
    blockConcise: BlockConcise,
    txHash: string
  ) {
    if (evt.topics && evt.topics[0] === ERC20.Transfer.signature) {
      let decoded: abi.Decoded;
      try {
        decoded = ERC20.Transfer.decode(evt.data, evt.topics);
      } catch (e) {
        this.log.warn('error decoding ERC20 transfer event');
        return;
      }

      const from = decoded.from.toLowerCase();
      const to = decoded.to.toLowerCase();
      const amount = new BigNumber(decoded.value.toString());
      let movement: Movement = {
        from,
        to,
        token: Token.ERC20,
        amount,
        tokenAddress: evt.address,
        nftTransfers: [],
        txHash,
        block: blockConcise,
        clauseIndex,
        logIndex,
      };
      if (!!this.mtrSysToken && evt.address.toLowerCase() === this.mtrSysToken.address) {
        // MTR: convert system contract event into system transfer
        // movement.token = Token.MTR;
        await this.accountCache.minus(from, Token.MTR, amount, blockConcise);
        await this.accountCache.plus(to, Token.MTR, amount, blockConcise);
      } else if (
        (!!this.mtrgSysToken && evt.address.toLowerCase() === this.mtrgSysToken.address) ||
        (!!this.mtrgV2SysToken && evt.address.toLowerCase() === this.mtrgV2SysToken.address)
      ) {
        // MTRG: convert system contract event into system transfer
        // movement.token = Token.MTRG;
        await this.accountCache.minus(from, Token.MTRG, amount, blockConcise);
        await this.accountCache.plus(to, Token.MTRG, amount, blockConcise);
      } else {
        // regular ERC20 transfer
        await this.tokenBalanceCache.minus(from, evt.address, amount, blockConcise);
        await this.tokenBalanceCache.plus(to, evt.address, amount, blockConcise);
      }
      this.movementsCache.push(movement);
    }
  }

  async parseERC721Movement(
    logIndex: number,
    evt: Flex.Meter.Event,
    clauseIndex: number,
    blockConcise: BlockConcise,
    txHash: string
  ) {
    if (evt.topics && evt.topics[0] === ERC721.Transfer.signature) {
      let decoded: abi.Decoded;
      try {
        decoded = ERC721.Transfer.decode(evt.data, evt.topics);
      } catch (e) {
        this.log.warn('error decoding ERC721 transfer event');
        return;
      }

      const from = decoded.from.toLowerCase();
      const to = decoded.to.toLowerCase();
      const tokenId = new BigNumber(decoded.tokenId.toString()).toFixed();
      const nftTransfers = [{ tokenId, value: 1 }];
      // ### Handle movement
      let movement: Movement = {
        from,
        to,
        amount: new BigNumber(0),
        token: Token.ERC721,
        tokenAddress: evt.address,
        nftTransfers,
        txHash,
        block: blockConcise,
        clauseIndex,
        logIndex,
      };

      // await this.tokenBalanceCache.minusNFT(from, evt.address, nftTransfers, blockConcise);
      // await this.tokenBalanceCache.plusNFT(to, evt.address, nftTransfers, blockConcise);

      this.movementsCache.push(movement);
    }
  }

  async parseERC1155Movement(
    logIndex: number,
    evt: Flex.Meter.Event,
    clauseIndex: number,
    blockConcise: BlockConcise,
    txHash: string
  ) {
    if (evt.topics && evt.topics[0] === ERC1155.TransferSingle.signature) {
      let decoded: abi.Decoded;
      try {
        decoded = ERC1155.TransferSingle.decode(evt.data, evt.topics);
      } catch (e) {
        this.log.warn('error decoding ERC1155 transfer event');
        return;
      }
      const from = decoded.from.toLowerCase();
      const to = decoded.to.toLowerCase();
      const nftTransfers = [{ tokenId: decoded.id, value: Number(decoded.value.toString()) }];
      const movement: Movement = {
        from,
        to,
        token: Token.ERC1155,
        amount: new BigNumber(0),
        tokenAddress: evt.address,
        nftTransfers,
        txHash,
        block: blockConcise,
        clauseIndex,
        logIndex,
      };
      // await this.tokenBalanceCache.minusNFT(from, evt.address, nftTransfers, blockConcise);
      // await this.tokenBalanceCache.plusNFT(to, evt.address, nftTransfers, blockConcise);
      this.movementsCache.push(movement);
    }

    if (evt.topics && evt.topics[0] === ERC1155.TransferBatch.signature) {
      let decoded: abi.Decoded;
      try {
        decoded = ERC1155.TransferBatch.decode(evt.data, evt.topics);
      } catch (e) {
        this.log.warn('error decoding transfer event');
        return;
      }
      let nftTransfers: NFTTransfer[] = [];
      for (const [i, id] of decoded.ids.entries()) {
        nftTransfers.push({ tokenId: id, value: Number(decoded.values[i].toString()) });
      }
      const from = decoded.from.toLowerCase();
      const to = decoded.to.toLowerCase();
      const movement: Movement = {
        from,
        to,
        token: Token.ERC1155,
        amount: new BigNumber(0),
        tokenAddress: evt.address,
        nftTransfers,
        txHash,
        block: blockConcise,
        clauseIndex,
        logIndex,
      };
      // await this.tokenBalanceCache.minusNFT(from, evt.address, nftTransfers, blockConcise);
      // await this.tokenBalanceCache.plusNFT(to, evt.address, nftTransfers, blockConcise);

      this.movementsCache.push(movement);
    }
  }

  async updateLogs(
    tx: Omit<Flex.Meter.Transaction, 'meta'> & Omit<Flex.Meter.Receipt, 'meta'>,
    blockConcise: BlockConcise
  ): Promise<void> {
    if (!tx.outputs || tx.outputs.length <= 0) {
      return;
    }

    for (const [clauseIndex, o] of tx.outputs.entries()) {
      for (const [logIndex, e] of o.events.entries()) {
        this.logEventCache.push({
          address: e.address,
          topics: e.topics,
          data: e.data,
          block: blockConcise,
          txHash: tx.id,
          clauseIndex,
          logIndex,
        });
      }
      for (const [logIndex, t] of o.transfers.entries()) {
        this.logTransferCache.push({
          sender: t.sender,
          recipient: t.recipient,
          amount: t.amount,
          token: t.token,
          block: blockConcise,
          txHash: tx.id,
          clauseIndex,
          logIndex,
        });
      }
    }
  }
  async updateWMTR(
    tx: Omit<Flex.Meter.Transaction, 'meta'> & Omit<Flex.Meter.Receipt, 'meta'>,
    blockConcise: BlockConcise
  ): Promise<void> {
    if (tx.reverted) {
      return;
    }
    const config = GetNetworkConfig(this.network);
    if (!config.wmtrEnabled || config.wmtrAddress === '') {
      this.log.info('WMTR is not enabled');
      return;
    }

    for (const [clauseIndex, o] of tx.outputs.entries()) {
      for (const [logIndex, evt] of o.events.entries()) {
        // handle WMTR deposit event
        if (
          evt.topics &&
          evt.topics.length > 0 &&
          evt.topics[0] === WMTRDeposit.signature &&
          evt.address === config.wmtrAddress
        ) {
          let decoded: abi.Decoded;
          try {
            decoded = WMTRDeposit.decode(evt.data, evt.topics);
          } catch (e) {
            this.log.info('error decoding WMTR Deposit event');
            continue;
          }
          const from = decoded.from.toLowerCase();
          const amount = new BigNumber(decoded.amount.toString());
          // await this.accountCache.minus(from, Token.MTR, amount, blockConcise);
          await this.tokenBalanceCache.plus(from, evt.address, amount, blockConcise);
        }

        // handle WMTR Withdrawal event
        if (
          evt.topics &&
          evt.topics.length > 0 &&
          evt.topics[0] === WMTRWithdrawal.signature &&
          evt.address === config.wmtrAddress
        ) {
          let decoded: abi.Decoded;
          try {
            decoded = WMTRWithdrawal.decode(evt.data, evt.topics);
          } catch (e) {
            this.log.info('error decoding WMTR Withdrawal event');
            continue;
          }

          const from = decoded.from.toLowerCase();
          const amount = new BigNumber(decoded.amount.toString());
          // await this.tokenBalanceCache.minus(from, evt.address, amount, blockConcise);
          await this.accountCache.plus(from, Token.MTR, amount, blockConcise);
        }
      }
    }
  }

  async updateMovements(
    tx: Omit<Flex.Meter.Transaction, 'meta'> & Omit<Flex.Meter.Receipt, 'meta'>,
    blockConcise: BlockConcise
  ): Promise<void> {
    if (tx.reverted) {
      return;
    }

    for (const [clauseIndex, o] of tx.outputs.entries()) {
      // ----------------------------------
      // Handle transfers
      // ----------------------------------
      for (const [logIndex, tr] of o.transfers.entries()) {
        const token = new BigNumber(tr.token).isEqualTo(1) ? Token.MTRG : Token.MTR;
        this.movementsCache.push({
          from: tr.sender.toLowerCase(),
          to: tr.recipient.toLowerCase(),
          token,
          tokenAddress: '',
          nftTransfers: [],
          amount: new BigNumber(tr.amount),
          txHash: tx.id,
          block: blockConcise,
          clauseIndex,
          logIndex,
        });
        await this.accountCache.minus(tr.sender, token, tr.amount, blockConcise);
        await this.accountCache.plus(tr.recipient, token, tr.amount, blockConcise);
      } // End of handling transfers

      // ----------------------------------
      // Handle events
      // ----------------------------------

      for (const [logIndex, evt] of o.events.entries()) {
        // ### Handle ERC20 Transfer event (they have the same signature)
        await this.parseERC20Movement(logIndex, evt, clauseIndex, blockConcise, tx.id);
        await this.parseERC721Movement(logIndex, evt, clauseIndex, blockConcise, tx.id);
        await this.parseERC1155Movement(logIndex, evt, clauseIndex, blockConcise, tx.id);
      } // End of handling events
    }
  }

  protected updateTxDigests(
    tx: Omit<Flex.Meter.Transaction, 'meta'> & Omit<Flex.Meter.Receipt, 'meta'>,
    blockConcise: BlockConcise,
    txIndex: number
  ) {
    let digests: TxDigest[] = [];
    let ids = {};
    // -------------------------------------
    // Handle direct digests
    // related to tx.origin and clause.to
    // -------------------------------------
    for (const [clauseIndex, clause] of tx.clauses.entries()) {
      // save direct digests with data
      let signature = 'Transfer'; // default is transfer
      const token = clause.token;
      if (clause.data && clause.data.length >= 10) {
        // this.log.info('data', clause.data);
        const isSE = ScriptEngine.IsScriptEngineData(clause.data);
        // this.log.info('clause.to: ', clause.to);
        if (isSE) {
          const decoded = ScriptEngine.decodeScriptData(clause.data);
          // this.log.info('decoded: ', decoded);
          signature = decoded.action;
        } else {
          signature = clause.data.substring(0, 10);
        }
      }

      const d = {
        block: blockConcise,
        txHash: tx.id,
        fee: new BigNumber(tx.paid),
        from: tx.origin,
        to: clause.to || ZeroAddress,
        mtr: token === Token.MTR ? new BigNumber(clause.value) : new BigNumber(0),
        mtrg: token === Token.MTRG ? new BigNumber(clause.value) : new BigNumber(0),
        method: signature,
        reverted: tx.reverted,
        clauseIndexs: [clauseIndex],
        txIndex,
        seq: 0,
      };
      const id = sha1({ from: d.from, to: d.to, clauseIndex });
      if (id in ids) {
        continue;
      }
      ids[id] = true;
      digests.push(d);
    }

    // ---------------------------------------------
    // Handle special case to KBlock ScriptEngine tx
    // related to transfers (indicating staking reward)
    // ---------------------------------------------
    let kblockDigestMap: { [key: string]: TxDigest } = {};
    for (const [clauseIndex, o] of tx.outputs.entries()) {
      const clause = tx.clauses[clauseIndex];
      // special case for KBlock ScritpEngine tx
      if (!tx.reverted && tx.origin === ZeroAddress && clause && ScriptEngine.IsScriptEngineData(clause.data)) {
        for (const [logIndex, tr] of o.transfers.entries()) {
          let mtr = new BigNumber(0);
          let mtrg = new BigNumber(0);
          if (tr.token == 0) {
            mtr = new BigNumber(tr.amount);
          }
          if (tr.token == 1) {
            mtrg = new BigNumber(tr.amount);
          }

          const d = {
            block: blockConcise,
            txHash: tx.id,
            fee: new BigNumber(tx.paid),
            from: tr.sender,
            to: tr.recipient,
            mtr,
            mtrg,
            method: 'Transfer',
            reverted: tx.reverted,
            clauseIndexs: [clauseIndex],
            txIndex,
            seq: 0,
          };
          const id = sha1({ from: d.from, to: d.to });
          if (id in kblockDigestMap) {
            if (!kblockDigestMap[id].clauseIndexs.includes(clauseIndex)) {
              kblockDigestMap[id].clauseIndexs.push(clauseIndex);
            }
            kblockDigestMap[id].mtr = kblockDigestMap[id].mtr.plus(mtr);
            kblockDigestMap[id].mtrg = kblockDigestMap[id].mtrg.plus(mtrg);
            // continue;
          } else {
            kblockDigestMap[id] = d;
          }
          // ids[id] = true;
          // digests.push(d);
        }
      }
    }

    for (const id in kblockDigestMap) {
      const d = kblockDigestMap[id];
      if (id in ids) {
        continue;
      }
      ids[id] = true;
      digests.push(d);
    }
    for (const d of digests) {
      this.txDigestsCache.push(d);
    }

    /*
    // prepare events and outputs
    for (const [clauseIndex, o] of tx.outputs.entries()) {
      for (const [logIndex, evt] of o.events.entries()) {
        // ### Handle ERC20 transfer event (they have the same signature)
        if (evt.topics && evt.topics[0] === ERC20.Transfer.signature) {
          let decoded: abi.Decoded;
          try {
            decoded = ERC20.Transfer.decode(evt.data, evt.topics);
          } catch (e) {
            this.log.info('error decoding ERC20 transfer event');
            continue;
          }

          const base = {
            block: blockConcise,
            txHash: tx.id,
            fee: new BigNumber(tx.paid),
            from: decoded.from.toLowerCase(),
            to: decoded.to.toLowerCase(),
            reverted: tx.reverted,
            txIndex,
          };
          const amount = new BigNumber(decoded.value);
          const isMTRSysContract = !!this.mtrSysToken && evt.address.toLowerCase() === this.mtrSysToken.address;
          const isMTRGSysContract =
            (!!this.mtrgSysToken && evt.address.toLowerCase() === this.mtrgSysToken.address) ||
            (!!this.mtrgV2SysToken && evt.address.toLowerCase() === this.mtrgV2SysToken.address);

          if (isMTRSysContract || isMTRGSysContract) {
            // ### Handle sys contract transfer events
            const key = sha1({ from: base.from, to: base.to });
            // set default value
            if (!(key in transferDigestMap)) {
              transferDigestMap[key] = {
                ...base,
                mtr: new BigNumber(0),
                mtrg: new BigNumber(0),
                method: 'Transfer',
                clauseIndexs: [],
                seq: 0, // later will sort and give it's actual value
              };
            }
            if (isMTRSysContract) {
              transferDigestMap[key].mtr = transferDigestMap[key].mtr.plus(amount);
              transferDigestMap[key].clauseIndexs.push(clauseIndex);
            } else {
              transferDigestMap[key].mtrg = transferDigestMap[key].mtrg.plus(amount);
              transferDigestMap[key].clauseIndexs.push(clauseIndex);
            }
          }
        }
      } // End of handling events

      // ----------------------------------
      // Handle transfers
      // ----------------------------------
      for (const [logIndex, tr] of o.transfers.entries()) {
        const key = sha1({ from: tr.sender, to: tr.recipient });
        if (!(key in transferDigestMap)) {
          transferDigestMap[key] = {
            block: blockConcise,
            txHash: tx.id,
            fee: new BigNumber(tx.paid),
            from: tr.sender,
            to: tr.recipient,
            mtr: new BigNumber(0),
            mtrg: new BigNumber(0),
            method: 'Transfer',
            reverted: tx.reverted,
            clauseIndexs: [],
            txIndex,
            seq: 0,
          };
        }
        transferDigestMap[key].clauseIndexs.push(clauseIndex);

        // update total transfer
        if (tr.token == 0) {
          transferDigestMap[key].mtr = transferDigestMap[key].mtr.plus(tr.amount);
        }
        if (tr.token == 1) {
          transferDigestMap[key].mtrg = transferDigestMap[key].mtrg.plus(tr.amount);
        }
      } // End of handling transfers
    }
    */

    // for (const key in transferDigestMap) {
    //   const d = transferDigestMap[key];
    //   const id = sha1({ num: d.block.number, hash: d.txHash, from: d.from, to: d.to });
    //   if (id in ids) {
    //     continue;
    //   }
    //   ids[id] = true;
    //   this.txDigestsCache.push(d);
    // }
  }

  async getVMError(
    tx: Omit<Flex.Meter.Transaction, 'meta'> & Omit<Flex.Meter.Receipt, 'meta'>,
    blockConcise: BlockConcise,
    txIndex: number
  ) {
    let vmError: VMError | null = null;
    let traces: TraceOutput[] = [];
    for (const [clauseIndex, _] of tx.clauses.entries()) {
      try {
        const tracer = await this.pos.newTraceClause(tx.id, clauseIndex);
        traces.push({ json: JSON.stringify(tracer), clauseIndex });
        if (tracer.error) {
          vmError = {
            error: tracer.error,
            clauseIndex,
            reason: null,
          };
          if (vmError.error === 'execution reverted' && tracer.output) {
            if (tracer.output.indexOf(revertReasonSelector) === 0) {
              try {
                const decoded = abi.decodeParameter('string', '0x' + tracer.output.slice(10));
                if (decoded) {
                  vmError.reason = decoded;
                }
              } catch {
                this.log.error(`decode Error(string) failed for tx: ${tx.id} at clause ${clauseIndex}`);
              }
            } else if (tracer.output.indexOf(panicErrorSelector) === 0) {
              try {
                const decoded = abi.decodeParameter('uint256', '0x' + tracer.output.slice(10));
                if (decoded) {
                  vmError.reason = decoded;
                }
              } catch {
                this.log.error(`decode Panic(uint256) failed for tx: ${tx.id} at clause ${clauseIndex}`);
              }
            } else {
              this.log.error(`unknown revert data format for tx: ${tx.id} at clause ${clauseIndex}`);
            }
          }
          break;
        }
      } catch (e) {
        vmError = {
          error: 'could not get tracing error',
          clauseIndex,
          reason: null,
        };
      }
    }
    return { vmError, traces };
  }

  async getTxOutputs(
    tx: Omit<Flex.Meter.Transaction, 'meta'> & Omit<Flex.Meter.Receipt, 'meta'>,
    blockConcise: BlockConcise,
    txIndex: number
  ) {
    let outputs: TxOutput[] = [];
    let traces: TraceOutput[] = [];
    for (const [clauseIndex, o] of tx.outputs.entries()) {
      const output: TxOutput = {
        contractAddress: o.contractAddress,
        events: [],
        transfers: [],
      };
      var tracer: Pos.CallTracerOutput;
      if (isTraceable(tx.clauses[clauseIndex].data)) {
        try {
          tracer = await this.pos.newTraceClause(tx.id, clauseIndex);
          traces.push({ json: JSON.stringify(tracer), clauseIndex });
        } catch (e) {
          this.log.error({ err: e }, 'failed to get tracing');
        }
      }

      if (o.events.length && o.transfers.length) {
        try {
          let logIndex = 0;
          for (const item of newIterator(tracer, o.events, o.transfers)) {
            if (item.type === 'event') {
              output.events.push({
                ...(item as LogItem<'event'>).data,
                overallIndex: logIndex++,
              });
            } else {
              output.transfers.push({
                ...(item as LogItem<'transfer'>).data,
                overallIndex: logIndex++,
              });
            }
          }
        } catch (e) {
          this.log.error({ err: e }, `failed to re-organize logs(${tx.id})`);
          let logIndex = 0;
          output.transfers = [];
          output.events = [];
          for (const t of o.transfers) {
            output.transfers.push({
              ...t,
              overallIndex: logIndex++,
            });
          }
          for (const e of o.events) {
            output.events.push({
              ...e,
              overallIndex: logIndex++,
            });
          }
        }
      } else if (o.events.length) {
        for (let i = 0; i < o.events.length; i++) {
          output.events.push({
            ...o.events[i],
            overallIndex: i,
          });
        }
      } else {
        for (let i = 0; i < o.transfers.length; i++) {
          output.transfers.push({
            ...o.transfers[i],
            overallIndex: i,
          });
        }
      }
      outputs.push(output);
    }
    return { outputs, traces };
  }

  async processTx(
    blk: Pos.ExpandedBlock,
    tx: Omit<Flex.Meter.Transaction, 'meta'> & Omit<Flex.Meter.Receipt, 'meta'>,
    txIndex: number
  ): Promise<void> {
    this.log.info(`start to process tx ${tx.id}`);
    const blockConcise = { number: blk.number, hash: blk.id, timestamp: blk.timestamp };

    // update movement && accounts
    await this.updateMovements(tx, blockConcise);

    // update accounts with WMTR wrap
    // skip WMTR handling because this duplicates with native transfer
    await this.updateWMTR(tx, blockConcise);

    await this.updateLogs(tx, blockConcise);

    this.updateTxDigests(tx, blockConcise, txIndex);

    let traces: TraceOutput[] = [];
    let outputs: TxOutput[] = [];
    let vmError: VMError | null = null;

    if (tx.reverted) {
      const e = await this.getVMError(tx, blockConcise, txIndex);
      vmError = e.vmError;
      traces = e.traces;
    } else {
      const o = await this.getTxOutputs(tx, blockConcise, txIndex);
      outputs = o.outputs;
      traces = o.traces;
    }

    // prepare events and outputs
    for (const [clauseIndex, o] of tx.outputs.entries()) {
      // ----------------------------------
      // Handle events
      // ----------------------------------

      // get clause trace
      let clauseTrace: Pos.CallTracerOutput | undefined = undefined;
      for (const trace of traces) {
        if (trace.clauseIndex === clauseIndex) {
          clauseTrace = JSON.parse(trace.json) as Pos.CallTracerOutput;
          break;
        }
      }

      for (const [logIndex, evt] of o.events.entries()) {
        // rebasing events (by AMPL)
        // event LogRebase(uint256 indexed epoch, uint256 globalAMPLSupply)
        // sample: https://scan.meter.io/tx/0xdd34ce672832253b819be51e85b196e4eca7f49d50f272b0ad2d2a866006d4b1?tab=2&p=1
        if (evt.topics[0] === '0x72725a3b1e5bd622d6bcd1339bb31279c351abe8f541ac7fd320f24e1b1641f2') {
          this.rebasingsCache.push(evt.address);
        }
        // rebasing (by stMTRG)
        // event LogRebase( bytes32 indexed bucketID, address indexed candidate, uint256 indexed epoch, uint256 totalSupply);
        // sample ?
        if (evt.topics[0] === '0x718b31b13d461b57805228117e5ad834c401532de2bea40d37cf85cbea57e1ff') {
          this.rebasingsCache.push(evt.address);
        }

        // ### Handle contract creation
        await this.handleContractCreation(evt, tx.id, blockConcise, clauseTrace);

        // ### Handle proxy events for ERC-1967
        await this.handleERC1967Events(evt);

        // ### Handle staking bound event
        await this.handleBound(evt, tx.id, clauseIndex, logIndex, blockConcise);

        // ### Handle staking unbound event
        await this.handleUnbound(evt, tx.id, clauseIndex, logIndex, blockConcise);

        // ### Handle staking withdraw from liquid staking
        await this.handleNativeBucketEvent(evt, tx.id, clauseIndex, logIndex, blockConcise);
      } // End of handling events

      await this.handleSelfdestruct(clauseTrace, tx.id, blockConcise);
    }

    // extract internal txs from traces
    if (traces) {
      for (const t of traces) {
        const trace = JSON.parse(t.json);
        let q = [[trace, '0']];
        while (q) {
          const item = q.shift();
          if (!item) {
            break;
          }

          const node = item[0];
          const suffix = item[1];
          const name = node.type.toLowerCase() + '_' + suffix;
          let signature = '';
          if (node.input) {
            signature = node.input.substring(0, 10);
          }
          if (['CALL', 'CREATE', 'CREATE2'].includes(node.type)) {
            this.internalTxCache.push({
              txHash: tx.id,
              block: blockConcise,
              txIndex: txIndex,
              name,
              from: node.from,
              to: node.to || ZeroAddress,
              value: node.value ? new BigNumber(node.value) : new BigNumber(0),
              fee: new BigNumber(tx.paid),
              gasUsed: node.gasUsed ? new BigNumber(node.gasUsed).toNumber() : 0,
              clauseIndex: t.clauseIndex,
              reverted: tx.reverted,
              signature: signature,
            });
          }

          if (node.calls) {
            for (const [index, c] of node.calls.entries()) {
              let childSuffix = suffix + '_' + index;
              q.push([c, childSuffix]);
            }
          }
        }
      }
    }

    const txModel: Tx = {
      hash: tx.id,
      block: blockConcise,
      txIndex,
      chainTag: tx.chainTag,
      blockRef: tx.blockRef,
      expiration: tx.expiration,
      gasPriceCoef: tx.gasPriceCoef,
      gas: tx.gas,
      nonce: tx.nonce,
      dependsOn: tx.dependsOn,
      origin: tx.origin.toLowerCase(),
      clauses: tx.clauses.map((c) => ({
        to: c.to ? c.to.toLowerCase() : ZeroAddress,
        value: new BigNumber(c.value),
        token: c.token == 0 ? Token.MTR : Token.MTRG,
        data: c.data,
      })),
      traces,
      clauseCount: tx.clauses.length,
      size: tx.size,
      gasUsed: tx.gasUsed,
      gasPayer: tx.gasPayer,
      paid: new BigNumber(tx.paid),
      reward: new BigNumber(tx.reward),
      reverted: tx.reverted,
      outputs,
      vmError,
    };

    this.txsCache.push(txModel);
    this.log.info({ hash: txModel.hash }, 'processed tx');
  }

  async processBlock(blk: Pos.ExpandedBlock): Promise<void> {
    // this.log.info({ number: blk.number }, 'start to process block');
    const blockConcise: BlockConcise = { ...blk, hash: blk.id, timestamp: blk.timestamp };

    let score = 0;
    let gasChanged = 0;
    let reward = new BigNumber(0);
    let actualReward = new BigNumber(0);
    const txCount = blk.transactions.length;
    if (blk.number > 0) {
      const prevBlk = await this.pos.getBlock(blk.parentID, 'regular');
      score = blk.totalScore - prevBlk.totalScore;
      gasChanged = blk.gasLimit - prevBlk.gasLimit;
    }

    let txHashs: string[] = [];
    let members: CommitteeMember[] = [];
    for (const [txIndex, tx] of blk.transactions.entries()) {
      await this.processTx(blk, tx, txIndex);
      txHashs.push(tx.id);
      reward = reward.plus(tx.reward);
      if (tx.origin !== ZeroAddress) {
        actualReward = actualReward.plus(tx.reward);
      }

      // substract fee from gas payer
      await this.accountCache.minus(tx.gasPayer, Token.MTR, tx.paid, blockConcise);
    }

    // add block reward beneficiary account
    if (actualReward.isGreaterThan(0)) {
      if (this.beneficiaryCache === ZeroAddress || this.beneficiaryCache === '0x') {
        this.log.info(`Add block reward ${actualReward.toFixed()} to ${blk.beneficiary}`);
        await this.accountCache.plus(blk.beneficiary, Token.MTR, actualReward, blockConcise);
      } else {
        this.log.info(`Add block reward ${actualReward.toFixed()} to ${this.beneficiaryCache}`);
        await this.accountCache.plus(this.beneficiaryCache, Token.MTR, actualReward, blockConcise);
      }
    }

    const config = GetNetworkConfig(this.network);
    let powBlocks: Flex.Meter.PowBlock[] = [];
    if (blk.powBlocks) {
      for (const pb of blk.powBlocks) {
        powBlocks.push({ ...pb });
      }
    } else {
      if (blk.isKBlock) {
        if (config.powEnabled) {
          const epochInfo = await this.pos.getEpochInfo(blk.qc.epochID);
          for (const pb of epochInfo.powBlocks) {
            powBlocks.push({ ...pb, beneficiary: pb.Beneficiary || pb.beneficiary });
          }
        }
      }
    }

    // update committee repo
    for (const m of blk.committee) {
      if (isHex(m.pubKey)) {
        const buf = Buffer.from(m.pubKey, 'hex');
        const base64PK = buf.toString('base64');
        members.push({ ...m, pubKey: base64PK });
      } else {
        members.push({ ...m });
      }
    }
    if (members.length > 0) {
      let committee: Committee = {
        epoch: blk.qc.epochID + 1,
        kblockHeight: blk.lastKBlockHeight,
        startBlock: blockConcise,
        members,
      };
      await this.committeesCache.push(committee);
      this.log.info(`update committee for epoch ${blk.qc.epochID}`);

      if (blk.qc.epochID > 0) {
        const prevEndBlock = await this.getBlockFromREST(blk.lastKBlockHeight);
        const endBlock: BlockConcise = {
          hash: prevEndBlock.id,
          timestamp: prevEndBlock.timestamp,
          number: prevEndBlock.number,
        };
        await this.updateCommitteeEndBlock(blk.qc.epochID, endBlock);
      }
    }

    let epoch = 0;
    if (blk.number === blk.lastKBlockHeight + 1) {
      epoch = blk.epoch;
    } else {
      epoch = blk.qc.epochID;
    }
    const block = {
      ...blk,
      hash: blk.id,
      txHashs,
      reward,
      actualReward,
      gasChanged,
      score,
      txCount,
      blockType: blk.isKBlock ? BlockType.KBlock : BlockType.MBlock,

      epoch,
      committee: members,
      nonce: String(blk.nonce),
      qc: { ...blk.qc },
      powBlocks,
    };
    this.log.info({ txCount: blk.transactions.length }, `processed PoS block ${blk.number}`);
    this.blocksCache.push(block);
  }

  private async updateCommitteeEndBlock(epoch: number, endBlock: BlockConcise) {
    for (const c of this.committeesCache) {
      if (c.epoch === epoch) {
        c.endBlock = endBlock;
        return;
      }
    }

    await this.committeeRepo.updateEndBlock(epoch, endBlock);
  }

  private async handleRebasing() {
    for (const tokenAddr of this.rebasingsCache) {
      this.log.info(`Handling rebasing events on ${tokenAddr}`);
      const bals = await this.tokenBalanceRepo.findByTokenAddress(tokenAddr);
      const c = await this.contractRepo.findByAddress(tokenAddr);
      if (c) {
        const res = await this.pos.explain(
          { clauses: [{ to: tokenAddr, value: '0x0', token: Token.MTR, data: ERC20.totalSupply.encode() }] },
          'best'
        );
        const decoded = ERC20.totalSupply.decode(res[0].data);
        c.totalSupply = new BigNumber(decoded['0'].toString());
        await c.save();
      }

      for (const bal of bals) {
        const res = await this.pos.explain(
          {
            clauses: [{ to: tokenAddr, value: '0x0', token: Token.MTR, data: ERC20.balanceOf.encode(bal.address) }],
          },
          'best'
        );
        const decoded = ERC20.balanceOf.decode(res[0].data);
        const chainBal = decoded['0'].toString();
        if (!bal.balance.isEqualTo(chainBal)) {
          this.log.info(
            `Update  ${bal.tokenAddress} with balance ${chainBal}, originally was ${bal.balance.toFixed(0)}`
          );
          bal.balance = new BigNumber(chainBal);
          await bal.save();
        }
      }
    }
  }

  protected async processGenesis() {
    const genesis = await this.pos.getBlock(0, 'regular');
    this.log.info({ number: genesis.number, hash: genesis.id }, 'process genesis');

    for (const addr of getPreAllocAccount(this.network)) {
      const chainAcc = await this.pos.getAccount(addr, genesis.id);

      const blockConcise = { number: genesis.number, hash: genesis.id, timestamp: genesis.timestamp };
      const name = getAccountName(this.network, addr.toLowerCase());
      let acct = await this.accountRepo.create(name, addr.toLowerCase(), blockConcise);
      acct.mtrgBalance = new BigNumber(chainAcc.balance);
      acct.mtrBalance = new BigNumber(chainAcc.energy);

      if (chainAcc.hasCode) {
        const chainCode = await this.pos.getCode(addr, genesis.id);
        await this.contractRepo.create(
          ContractType.Unknown,
          addr,
          '',
          '',
          '',
          new BigNumber(0),
          '0x',
          chainCode.code,
          '0x',
          blockConcise,
          0
        );
      }
      this.log.info(
        { accountName: acct.name, address: addr, MTR: acct.mtrBalance.toFixed(), MTRG: acct.mtrgBalance.toFixed() },
        `saving genesis account`
      );
      await acct.save();
    }
  }

  printCache() {
    this.log.info('----------------------------------------');
    this.log.info(` ${this.blocksCache.length} BLOCK(s)`);
    this.log.info('----------------------------------------');
    for (const item of this.blocksCache) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }
    this.log.info('----------------------------------------');
    this.log.info(` ${this.txsCache.length} TX(s)`);
    this.log.info('----------------------------------------');
    for (const item of this.txsCache) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }

    this.log.info('----------------------------------------');
    this.log.info(` ${this.movementsCache.length} MOVEMENT(s)`);
    this.log.info('----------------------------------------');
    for (const item of this.movementsCache) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }

    this.log.info('----------------------------------------');
    this.log.info(` ${this.txDigestsCache.length} TX DIGEST(s)`);
    this.log.info('----------------------------------------');
    for (const item of this.txDigestsCache) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }

    this.log.info('----------------------------------------');
    this.log.info(` ${this.boundsCache.length} BOUND(s)`);
    this.log.info('----------------------------------------');
    for (const item of this.boundsCache) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }

    this.log.info('----------------------------------------');
    this.log.info(` ${this.unboundsCache.length} UNBOUND(s)`);
    this.log.info('----------------------------------------');
    for (const item of this.unboundsCache) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }

    this.log.info('----------------------------------------');
    this.log.info(` ${this.withdrawCache.length} WITHDRAWS(s)`);
    this.log.info('----------------------------------------');
    for (const item of this.withdrawCache) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }

    this.log.info('----------------------------------------');
    this.log.info(` ${this.rebasingsCache.length} REBASING(s)`);
    this.log.info('----------------------------------------');
    for (const item of this.rebasingsCache) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }

    this.log.info('----------------------------------------');
    this.log.info(` ${this.contractsCache.length} CONTRACT(s) created`);
    this.log.info('----------------------------------------');
    for (const item of this.contractsCache) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }

    this.log.info('----------------------------------------');
    this.log.info(` ${this.accountCache.list().length} ACCOUT(s) updated`);
    this.log.info('----------------------------------------');
    for (const item of this.accountCache.list()) {
      this.log.info(item.toJSON());
      this.log.info('----------------------------------------\n');
    }

    this.log.info('----------------------------------------');
    this.log.info(`${this.tokenBalanceCache.list.length} TOKEN BALNCE(s) updated`);
    this.log.info('----------------------------------------');
    for (const item of this.tokenBalanceCache.list()) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }

    this.log.info('----------------------------------------');
    this.log.info(`${this.internalTxCache.length} Internal Tx(s)`);
    this.log.info('----------------------------------------');
    for (const item of this.internalTxCache) {
      this.log.info(item);
      this.log.info('----------------------------------------\n');
    }
  }
}

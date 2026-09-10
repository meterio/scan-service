/**
 * Isolated regression fixture for the PoS sync recovery path.
 *
 * Drives the real `PosCMD.loop()` against in-memory repositories that enforce the
 * same unique indexes production Mongo does (block.hash_1 and
 * movement.txHash_1_clauseIndex_1_logIndex_1_token_1), injects a one-time
 * partially-persisted flush failure, and asserts that recovery discards the
 * in-memory caches so the replayed range does not duplicate rows or double-count
 * account/token balances.
 *
 * Run with: npm test
 */
import assert from 'assert';
import { BigNumber } from 'bignumber.js';

// `sleep` is looked up on the live module object at call time, so patching it here
// neutralises RECOVERY_INTERVAL (2 min) regardless of import order.
import * as rawUtils from '../src/utils/utils';
let sleepCalls: number[] = [];
(rawUtils as any).sleep = async (ms: number) => {
  sleepCalls.push(ms);
};
/** RECOVERY_INTERVAL is 2 min; every other sleep in the loop is <= 2s. */
const RECOVERY_SLEEP_FLOOR = 60 * 1000;

import { InterruptedError } from '../src/utils';
import { PosCMD } from '../src/cmd/pos.cmd';
import { Network, Token, ZeroAddress } from '../src/const';

const BENEFICIARY = '0x1111111111111111111111111111111111111111';
const CHAIN_BENEFICIARY = '0x2222222222222222222222222222222222222222';
const RECIPIENT = '0x3333333333333333333333333333333333333333';
const TOKEN_ADDR = '0x4444444444444444444444444444444444444444';
const REWARD = '1000';
const TOKEN_DELTA = '7';

const GENESIS = 0;
const MAX_ROUNDS = 12;

type Fault = { target: 'movement' | 'block'; afterN: number };

interface Snapshot {
  at: string;
  blocks: number;
  txs: number;
  movements: number;
  accounts: number;
  tokenBalances: number;
  beneficiary: string;
  headNum: number;
}

class DuplicateKeyError extends Error {
  constructor(collection: string, index: string, key: string) {
    super(`E11000 duplicate key error collection: testdb.${collection} index: ${index} dup key: ${key}`);
  }
}

/** In-memory stand-in for the subset of Mongo the loop touches. */
class FakeDB {
  public blocksByHash = new Map<string, any>();
  public movementsByKey = new Map<string, any>();
  public txsByHash = new Map<string, any>();
  public head: { key: string; num: number; hash: string } | null = null;

  public movementKey(m: any) {
    return `${m.txHash}|${m.clauseIndex}|${m.logIndex}|${m.token}`;
  }

  public insertBlock(b: any) {
    if (this.blocksByHash.has(b.hash)) {
      throw new DuplicateKeyError('block', 'hash_1', b.hash);
    }
    this.blocksByHash.set(b.hash, b);
  }

  public insertMovement(m: any) {
    const key = this.movementKey(m);
    if (this.movementsByKey.has(key)) {
      throw new DuplicateKeyError('movement', 'txHash_1_clauseIndex_1_logIndex_1_token_1', key);
    }
    this.movementsByKey.set(key, m);
  }

  public deleteBlocksAfter(num: number) {
    let deleted = 0;
    for (const [hash, b] of [...this.blocksByHash]) {
      if (b.number > num) {
        this.blocksByHash.delete(hash);
        deleted++;
      }
    }
    return { deletedCount: deleted };
  }

  public deleteMovementsAfter(num: number) {
    let deleted = 0;
    for (const [key, m] of [...this.movementsByKey]) {
      if (m.block.number > num) {
        this.movementsByKey.delete(key);
        deleted++;
      }
    }
    return { deletedCount: deleted };
  }

  public deleteTxsAfter(num: number) {
    let deleted = 0;
    for (const [hash, t] of [...this.txsByHash]) {
      if (t.block.number > num) {
        this.txsByHash.delete(hash);
        deleted++;
      }
    }
    return { deletedCount: deleted };
  }

  public blockNumbers() {
    return [...this.blocksByHash.values()].map((b) => b.number).sort((a, b) => a - b);
  }

  public movementKeys() {
    return [...this.movementsByKey.keys()].sort();
  }
}

interface RunOptions {
  targetHead: number;
  /** what web3.eth.getBlockNumber() reports; > head + LOOP_WINDOW selects fast-forward mode */
  best: number;
  fault?: Fault;
  /** makes cleanUpIncompleteData throw on the given recovery attempt (1-based) */
  failCleanupOnAttempt?: number;
  /** request shutdown once this many blocks have been processed */
  stopAfterBlocks?: number;
  /** start with no persisted head (exercises the `head == null` recovery branch) */
  absentHead?: boolean;
}

interface RunResult {
  db: FakeDB;
  snapshots: Snapshot[];
  accountBalances: Record<string, string>;
  tokenBalances: Record<string, string>;
  processedBlocks: number[];
  faultFired: boolean;
  headNumAtFault: number | null;
  recoveries: number;
  cleanupCalls: number;
  storageRevisions: string[];
  quitLoop: boolean;
  /** every error the loop reported through log.error */
  loopErrors: string[];
  /** true when the loop failed to converge within MAX_ROUNDS */
  overran: boolean;
  loopError: Error | null;
  cacheSizesAtFault: Snapshot | null;
}

const makeLogger = (errors: string[]): any => ({
  info: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  error: (...args: any[]) => {
    for (const a of args) {
      if (a instanceof Error) {
        errors.push(a.message);
      } else if (a && typeof a === 'object' && a.err instanceof Error) {
        errors.push(a.err.message);
      }
    }
  },
});

const emptyDelete = async () => ({ deletedCount: 0 });
const emptyInsert = async () => [];

async function run(opts: RunOptions): Promise<RunResult> {
  const db = new FakeDB();
  const snapshots: Snapshot[] = [];
  const processedBlocks: number[] = [];
  const storageRevisions: string[] = [];
  const accountRows = new Map<string, any>();
  const tokenBalanceRows = new Map<string, any>();

  let fault: Fault | null = opts.fault ? { ...opts.fault } : null;
  let faultFired = false;
  let headNumAtFault: number | null = null;
  let cacheSizesAtFault: Snapshot | null = null;
  let recoveries = 0;
  let cleanupCalls = 0;
  let quitLoop = false;
  let overran = false;
  let rounds = 0;

  const loopErrors: string[] = [];
  const cmd: any = new PosCMD(Network.MainNet);
  cmd.log = makeLogger(loopErrors);

  const snapshot = (at: string): Snapshot => ({
    at,
    blocks: cmd.blocksCache.length,
    txs: cmd.txsCache.length,
    movements: cmd.movementsCache.length,
    accounts: cmd.accountCache.list().length,
    tokenBalances: cmd.tokenBalanceCache.list().length,
    beneficiary: cmd.beneficiaryCache,
    headNum: db.head ? db.head.num : -1,
  });

  // ---- fake chain access -------------------------------------------------
  const bestNum = opts.best;
  cmd.web3 = {
    eth: {
      getBlockNumber: async () => {
        rounds++;
        snapshots.push(snapshot('round-start'));
        if (rounds > MAX_ROUNDS) {
          // InterruptedError breaks the loop instead of being swallowed by the
          // recovery branch, which would otherwise spin forever.
          overran = true;
          cmd.stop();
          throw new InterruptedError();
        }
        if (db.head && db.head.num >= opts.targetHead) {
          cmd.stop();
        }
        return bestNum;
      },
    },
  };

  cmd.pos = {
    getBlock: async (numOrId: any) => {
      const num = typeof numOrId === 'number' ? numOrId : GENESIS;
      if (num > bestNum) {
        return null;
      }
      return {
        number: num,
        id: `0xblock${num}`,
        parentID: `0xblock${num - 1}`,
        timestamp: 1600000000 + num,
        beneficiary: CHAIN_BENEFICIARY,
        transactions: [],
        totalScore: num,
        gasLimit: 1,
      };
    },
    getAccount: async (addr: string, revision: string) => {
      const n = Number(revision);
      const energy = addr.toLowerCase() === BENEFICIARY.toLowerCase() ? new BigNumber(REWARD).times(n) : new BigNumber(0);
      return { balance: '0', energy: energy.toFixed(), boundbalance: '0', boundenergy: '0' };
    },
    getERC20BalanceOf: async (addr: string, tokenAddr: string, revision: string) => {
      const n = Number(revision);
      if (addr.toLowerCase() !== RECIPIENT.toLowerCase() || tokenAddr.toLowerCase() !== TOKEN_ADDR.toLowerCase()) {
        return '0';
      }
      return new BigNumber(TOKEN_DELTA).times(n).toFixed();
    },
    getStorage: async (_addr: string, _key: string, revision: string) => {
      storageRevisions.push(revision);
      // snapshot taken *before* updateTxFeeBeneficiary overwrites the cache
      snapshots.push(snapshot('before-beneficiary-load'));
      return { value: '0x'.padEnd(26, '0') + BENEFICIARY.slice(2) };
    },
  };

  // ---- fake repositories -------------------------------------------------
  const passthroughRepo = { deleteAfter: emptyDelete, bulkInsert: emptyInsert };
  for (const name of ['logEventRepo', 'logTransferRepo', 'committeeRepo', 'boundRepo', 'unboundRepo', 'txDigestRepo', 'internalTxRepo']) {
    cmd[name] = { ...passthroughRepo };
  }
  cmd.withdrawRepo = { ...passthroughRepo };
  cmd.contractRepo = {
    deleteAfter: emptyDelete,
    bulkInsert: emptyInsert,
    findByAddress: async () => null,
  };
  cmd.contractFileRepo = { deleteByContract: async () => ({ deletedCount: 0 }) };

  cmd.blockRepo = {
    findByNumber: async (num: number) =>
      [...db.blocksByHash.values()].find((b) => b.number === num) || null,
    deleteAfter: async (num: number) => db.deleteBlocksAfter(num),
    bulkInsert: async (...blocks: any[]) => {
      let n = 0;
      for (const b of blocks) {
        if (fault && fault.target === 'block' && n === fault.afterN) {
          fault = null;
          faultFired = true;
          headNumAtFault = db.head ? db.head.num : -1;
          cacheSizesAtFault = snapshot('at-fault');
          snapshots.push(cacheSizesAtFault);
          throw new Error('fixture: injected block flush failure');
        }
        db.insertBlock(b);
        n++;
      }
      return blocks;
    },
  };

  cmd.txRepo = {
    deleteAfter: async (num: number) => db.deleteTxsAfter(num),
    bulkInsert: async (...txs: any[]) => {
      for (const t of txs) {
        db.txsByHash.set(t.hash, t);
      }
      return txs;
    },
  };

  cmd.movementRepo = {
    deleteAfter: async (num: number) => db.deleteMovementsAfter(num),
    bulkInsert: async (...movements: any[]) => {
      let n = 0;
      for (const m of movements) {
        if (fault && fault.target === 'movement' && n === fault.afterN) {
          fault = null;
          faultFired = true;
          headNumAtFault = db.head ? db.head.num : -1;
          cacheSizesAtFault = snapshot('at-fault');
          snapshots.push(cacheSizesAtFault);
          throw new Error('fixture: injected movement flush failure');
        }
        db.insertMovement(m);
        n++;
      }
      return movements;
    },
  };

  cmd.accountRepo = {
    findLastUpdateAfter: async (num: number) =>
      [...accountRows.values()].filter((a) => a.lastUpdate.number > num),
    // findIncorrect()'s real predicate is not modelled here; the fixture only
    // exercises the lastUpdate-based repair path.
    findIncorrect: async () => [],
    findByAddress: async (addr: string) => accountRows.get(addr.toLowerCase()) || null,
    create: async (name: string, addr: string, blockConcise: any) => {
      const row: any = {
        name,
        address: addr.toLowerCase(),
        mtrBalance: new BigNumber(0),
        mtrgBalance: new BigNumber(0),
        mtrBounded: new BigNumber(0),
        mtrgBounded: new BigNumber(0),
        firstSeen: blockConcise,
        lastUpdate: blockConcise,
        save: async () => {
          accountRows.set(row.address, row);
          return row;
        },
        toJSON: () => ({ ...row }),
      };
      return row;
    },
  };

  cmd.tokenBalanceRepo = {
    findLastUpdateAfter: async (num: number) =>
      [...tokenBalanceRows.values()].filter((b) => b.lastUpdate.number > num),
    findIncorrect: async () => [],
    findByAddress: async (addr: string, tokenAddr: string) =>
      tokenBalanceRows.get(`${addr}_${tokenAddr}`.toLowerCase()) || null,
    create: async (addr: string, tokenAddr: string, blockConcise: any) => {
      const key = `${addr}_${tokenAddr}`.toLowerCase();
      const row: any = {
        address: addr.toLowerCase(),
        tokenAddress: tokenAddr.toLowerCase(),
        balance: new BigNumber(0),
        nftBalances: [],
        firstSeen: blockConcise,
        lastUpdate: blockConcise,
        save: async () => {
          tokenBalanceRows.set(key, row);
          return row;
        },
        toJSON: () => ({ ...row }),
      };
      return row;
    },
    deleteByID: async () => ({ deletedCount: 0 }),
  };

  cmd.headRepo = {
    findByKey: async () => db.head,
    exists: async () => db.head !== null,
    create: async (key: string, num: number, hash: string) => {
      db.head = { key, num, hash };
      return { ...db.head, save: async () => db.head };
    },
  };

  cmd.metricRepo = {
    findByKey: async () => null,
    update: async () => true,
  };

  // token balance count maintenance needs contract rows we do not fixture
  cmd.tokenBalanceCache.updateCounts = async () => {};
  // AccountCache / TokenBalanceCache keep their own private repo instances
  cmd.accountCache.repo = cmd.accountRepo;
  cmd.tokenBalanceCache.tokenBalanceRepo = cmd.tokenBalanceRepo;

  // updateHead() mutates the object returned by findByKey and calls save()
  const origUpdateHead = cmd.updateHead.bind(cmd);
  cmd.updateHead = async (num: number, hash: string) => {
    if (!db.head) {
      return cmd.headRepo.create('pos', num, hash);
    }
    db.head = { key: 'pos', num, hash };
    return db.head;
  };
  void origUpdateHead;

  cmd.processGenesis = async () => {
    // genesis accounts are irrelevant here; the loop only needs it not to throw
  };

  // ---- deterministic stand-in for processBlock ---------------------------
  cmd.processBlock = async (blk: any) => {
    processedBlocks.push(blk.number);
    const blockConcise = { number: blk.number, hash: blk.id, timestamp: blk.timestamp };
    cmd.blocksCache.push({ number: blk.number, hash: blk.id });
    cmd.txsCache.push({ hash: `0xtx${blk.number}`, block: blockConcise, movementCount: 1, clauseCount: 1 });
    cmd.movementsCache.push({
      txHash: `0xtx${blk.number}`,
      clauseIndex: 0,
      logIndex: 0,
      token: Token.MTR,
      from: ZeroAddress,
      to: RECIPIENT,
      amount: new BigNumber(1),
      block: blockConcise,
    });
    if (blk.number !== GENESIS) {
      // genesis pays no reward, which keeps the canonical balance at number * REWARD
      await cmd.accountCache.plus(BENEFICIARY, Token.MTR, REWARD, blockConcise);
      await cmd.tokenBalanceCache.plus(RECIPIENT, TOKEN_ADDR, TOKEN_DELTA, blockConcise);
    }

    if (opts.stopAfterBlocks && processedBlocks.length >= opts.stopAfterBlocks) {
      cmd.stop();
    }
  };

  // ---- observe recovery --------------------------------------------------
  const realCleanUp = cmd.cleanUpIncompleteData.bind(cmd);
  cmd.cleanUpIncompleteData = async (head: any) => {
    cleanupCalls++;
    if (opts.failCleanupOnAttempt && cleanupCalls === opts.failCleanupOnAttempt) {
      throw new Error('fixture: injected cleanup failure');
    }
    return realCleanUp(head);
  };

  // Count the cache clears that happen inside the recovery branch: the branch is
  // entered exactly once per recovery and is the only place that sleeps for
  // RECOVERY_INTERVAL, so pair each recovery sleep with a preceding cleanCache().
  const realCleanCache = cmd.cleanCache.bind(cmd);
  let cleanCacheCalls = 0;
  cmd.cleanCache = () => {
    cleanCacheCalls++;
    return realCleanCache();
  };

  if (!opts.absentHead) {
    db.head = { key: 'pos', num: GENESIS, hash: `0xblock${GENESIS}` };
    db.insertBlock({ number: GENESIS, hash: `0xblock${GENESIS}` });
  }

  let loopError: Error | null = null;
  sleepCalls = [];
  const origLog = console.log;
  console.log = () => {};
  try {
    await cmd.loop();
    quitLoop = true;
  } catch (e) {
    loopError = e as Error;
  } finally {
    console.log = origLog;
  }
  recoveries = sleepCalls.filter((ms) => ms >= RECOVERY_SLEEP_FLOOR).length;
  void cleanCacheCalls;

  const accountBalances: Record<string, string> = {};
  for (const [addr, row] of accountRows) {
    accountBalances[addr] = row.mtrBalance.toFixed();
  }
  const tokenBalances: Record<string, string> = {};
  for (const [key, row] of tokenBalanceRows) {
    tokenBalances[key] = row.balance.toFixed();
  }

  return {
    db,
    snapshots,
    accountBalances,
    tokenBalances,
    processedBlocks,
    faultFired,
    headNumAtFault,
    recoveries,
    cleanupCalls,
    storageRevisions,
    quitLoop,
    loopErrors,
    overran,
    loopError,
    cacheSizesAtFault,
  };
}

// ---------------------------------------------------------------------------
// test harness
// ---------------------------------------------------------------------------
const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

/** the snapshot taken at the start of the first round after a recovery */
const roundStartAfterFault = (r: RunResult): Snapshot => {
  const idx = r.snapshots.findIndex((s) => s.at === 'at-fault');
  assert.ok(idx >= 0, 'expected an injected fault snapshot');
  const next = r.snapshots.slice(idx + 1).find((s) => s.at === 'round-start');
  assert.ok(next, 'expected a round to start after recovery');
  return next!;
};

test('normal mode: partially persisted movement flush recovers without duplicates', async () => {
  const clean = await run({ targetHead: 6, best: 6 });
  const faulted = await run({ targetHead: 6, best: 6, fault: { target: 'movement', afterN: 0 } });

  assert.ok(faulted.faultFired, 'fault should have fired');
  const dups = faulted.loopErrors.filter((m) => m.includes('E11000'));
  assert.deepStrictEqual(dups.slice(0, 1), [], 'replay must not raise duplicate key errors');
  assert.strictEqual(faulted.overran, false, 'loop must converge after a single recovery');
  assert.strictEqual(faulted.recoveries, 1, 'exactly one recovery expected');
  assert.strictEqual(faulted.loopError, null, `loop threw: ${faulted.loopError?.message}`);

  const after = roundStartAfterFault(faulted);
  assert.strictEqual(after.blocks, 0, 'blocksCache must be empty when the next round starts');
  assert.strictEqual(after.txs, 0, 'txsCache must be empty when the next round starts');
  assert.strictEqual(after.movements, 0, 'movementsCache must be empty when the next round starts');
  assert.strictEqual(after.accounts, 0, 'accountCache must be empty when the next round starts');
  assert.strictEqual(after.tokenBalances, 0, 'tokenBalanceCache must be empty when the next round starts');

  assert.deepStrictEqual(faulted.db.blockNumbers(), clean.db.blockNumbers(), 'blocks must match a clean run');
  assert.deepStrictEqual(faulted.db.movementKeys(), clean.db.movementKeys(), 'movements must match a clean run');
  assert.deepStrictEqual(faulted.accountBalances, clean.accountBalances, 'no double-counted account rewards');
  assert.deepStrictEqual(faulted.tokenBalances, clean.tokenBalances, 'no double-counted token balances');
  assert.strictEqual(faulted.db.head!.num, 6, 'head must reach the target');
});

test('fast-forward mode: partially persisted block flush recovers without duplicates', async () => {
  const clean = await run({ targetHead: 250, best: 1000 });
  const faulted = await run({ targetHead: 250, best: 1000, fault: { target: 'block', afterN: 5 } });

  assert.ok(faulted.faultFired, 'fault should have fired');
  const dups = faulted.loopErrors.filter((m) => m.includes('E11000'));
  assert.deepStrictEqual(dups.slice(0, 1), [], 'replay must not raise duplicate key errors');
  assert.strictEqual(faulted.overran, false, 'loop must converge after a single recovery');
  assert.strictEqual(faulted.recoveries, 1, 'exactly one recovery expected');
  assert.strictEqual(faulted.loopError, null, `loop threw: ${faulted.loopError?.message}`);

  const after = roundStartAfterFault(faulted);
  assert.strictEqual(after.blocks, 0, 'blocksCache must be empty when the next round starts');
  assert.strictEqual(after.movements, 0, 'movementsCache must be empty when the next round starts');
  assert.strictEqual(after.accounts, 0, 'accountCache must be empty when the next round starts');

  assert.deepStrictEqual(faulted.db.blockNumbers(), clean.db.blockNumbers(), 'blocks must match a clean run');
  assert.deepStrictEqual(faulted.db.movementKeys(), clean.db.movementKeys(), 'movements must match a clean run');
  assert.deepStrictEqual(faulted.accountBalances, clean.accountBalances, 'no double-counted account rewards');
  assert.ok(faulted.db.head!.num >= 250, 'head must reach the target');
  assert.strictEqual(faulted.db.head!.num, clean.db.head!.num, 'head must land where a clean run lands');
});

test('head advances only after a successful flush', async () => {
  const faulted = await run({ targetHead: 6, best: 6, fault: { target: 'movement', afterN: 0 } });
  assert.strictEqual(faulted.headNumAtFault, GENESIS, 'head must still be at the pre-round value when the flush fails');
});

test('beneficiary is reset during recovery and reloaded at the persisted head', async () => {
  const faulted = await run({ targetHead: 6, best: 6, fault: { target: 'movement', afterN: 0 } });
  const idx = faulted.snapshots.findIndex((s) => s.at === 'at-fault');
  const beforeLoad = faulted.snapshots.slice(idx + 1).find((s) => s.at === 'before-beneficiary-load');
  assert.ok(beforeLoad, 'expected the beneficiary to be reloaded after recovery');
  assert.strictEqual(
    beforeLoad!.beneficiary,
    ZeroAddress,
    'beneficiaryCache must be reset to ZeroAddress before it is reloaded'
  );
  const revision = faulted.storageRevisions[faulted.storageRevisions.length - 1];
  assert.strictEqual(revision, faulted.db.head!.hash, 'beneficiary must be reloaded at the persisted head hash');
});

test('recovery clears caches even when no head is persisted', async () => {
  const faulted = await run({
    targetHead: 6,
    best: 6,
    absentHead: true,
    fault: { target: 'movement', afterN: 0 },
  });
  assert.ok(faulted.faultFired, 'fault should have fired');
  assert.strictEqual(faulted.overran, false, 'loop must converge after a single recovery');
  assert.strictEqual(faulted.cleanupCalls, 0, 'cleanUpIncompleteData must be skipped when there is no head');
  assert.strictEqual(faulted.recoveries, 1, 'caches must still be cleared without a persisted head');

  const after = roundStartAfterFault(faulted);
  assert.strictEqual(after.headNum, -1, 'the fault must land before any head is persisted');
  assert.strictEqual(after.blocks, 0, 'blocksCache must be empty when the next round starts');
  assert.strictEqual(after.txs, 0, 'txsCache must be empty when the next round starts');
  assert.strictEqual(after.movements, 0, 'movementsCache must be empty when the next round starts');
  assert.strictEqual(faulted.db.head!.num, 6, 'head must reach the target after replay');
});

test('a failing cleanup stops the loop instead of replaying against partial state', async () => {
  const faulted = await run({
    targetHead: 6,
    best: 6,
    fault: { target: 'movement', afterN: 0 },
    // attempt 1 is the startup cleanup, attempt 2 is the recovery cleanup
    failCleanupOnAttempt: 2,
  });
  assert.ok(faulted.loopError, 'loop must propagate the cleanup failure');
  assert.match(faulted.loopError!.message, /injected cleanup failure/);
  const idx = faulted.snapshots.findIndex((s) => s.at === 'at-fault');
  const resumed = faulted.snapshots.slice(idx + 1).some((s) => s.at === 'round-start');
  assert.strictEqual(resumed, false, 'no import round may start after a failed cleanup');
});

test('interruption still quits the loop without running recovery', async () => {
  const r = await run({ targetHead: 6, best: 6, stopAfterBlocks: 3 });
  assert.strictEqual(r.loopError, null, 'shutdown must not surface as an error');
  assert.strictEqual(r.quitLoop, true, 'loop() must return on shutdown');
  assert.strictEqual(r.recoveries, 0, 'shutdown must not trigger the recovery branch');
  assert.strictEqual(r.cleanupCalls, 1, 'only the startup cleanup should run');
  // must stop at the next block boundary, not run out the rest of the round
  assert.strictEqual(
    r.processedBlocks.length,
    3,
    'shutdown must be noticed between blocks, not after the whole round'
  );
});

test('preload failures are handled, not fatal', async () => {
  // Regression: `(async()=>{...})().catch()` with no handler leaves the rejection
  // unhandled, which Node's default --unhandled-rejections=throw turns into a
  // process-killing fatal error. One ECONNRESET from the RPC took the scanner down.
  const cmd: any = new PosCMD(Network.MainNet);
  cmd.log = makeLogger([]);
  cmd.pos = {
    getBlock: async (numOrId: any) => {
      if (numOrId === 4242) {
        return { number: 4242, id: '0xblock4242' };
      }
      const e: any = new Error('socket hang up');
      e.code = 'ECONNRESET';
      throw e;
    },
  };

  const unhandled: any[] = [];
  const onUnhandled = (reason: any) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  const origLog = console.log;
  console.log = () => {};
  try {
    const b = await cmd.getBlockFromREST(4242);
    assert.ok(b, 'the requested block must still be returned');
    // give the preload chain time to reject and Node time to report it
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setImmediate(r));
    }
  } finally {
    console.log = origLog;
    process.off('unhandledRejection', onUnhandled);
  }

  assert.deepStrictEqual(
    unhandled.map((e) => (e && e.message) || String(e)),
    [],
    'a failed preload must not surface as an unhandled rejection'
  );
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ok   ${t.name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL ${t.name}`);
      console.log(`       ${(e as Error).message}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
})();

import { EventEmitter } from 'events';
import { Network } from '../const';
import { HeadRepo, PowBlockRepo, PowTxRepo } from '../repo';
import { PowBlock } from '../model';
import pino from 'pino';

import { Pow } from '../utils/pow-rpc';
import { InterruptedError, sleep } from '../utils';
import { CMD } from './cmd';

const FASTFORWARD_INTERVAL = 500;
const NORMAL_INTERVAL = 15000;
const PRELOAD_WINDOW = 5;
const LOOP_WINDOW = 100;

export class PowCMD extends CMD {
  private shutdown = false;
  private ev = new EventEmitter();
  private name = 'pow';
  private powBlockRepo = new PowBlockRepo();
  private powTxRepo = new PowTxRepo();
  private headRepo = new HeadRepo();
  private pow: Pow;

  constructor(net: Network) {
    super();
    this.log = pino({
      transport: {
        target: 'pino-pretty',
      },
    });
    this.pow = new Pow(net);
  }

  public async start() {
    this.log.info('start');
    await this.loop();
    return;
  }

  public stop() {
    this.shutdown = true;

    return new Promise((resolve) => {
      this.log.info('shutting down......');
      this.ev.on('closed', resolve);
    });
  }

  public async processBlock(blk: PowBlock) {
    if (blk.height > 0) {
      const prevBlock = await this.getBlockFromRPC(blk.height - 1);
      blk.previousBlockHash = prevBlock.hash;
      await this.powBlockRepo.create(blk);
    }
    if (blk.height > 0 && blk.tx && blk.tx.length > 0) {
      for (const txhash of blk.tx) {
        const powTx = await this.pow.getTx(txhash);
        await this.powTxRepo.create(powTx);
      }
    }
  }

  private async getBlockFromRPC(num: number) {
    const b = await this.pow.getBlock(num);

    // preload blocks
    (async () => {
      for (let i = 1; i <= PRELOAD_WINDOW; i++) {
        await this.pow.getBlock(num + i);
      }
    })().catch();
    return b;
  }

  public async loop() {
    let fastforward = true;
    for (;;) {
      try {
        if (this.shutdown) {
          throw new InterruptedError();
        }
        if (fastforward) {
          await sleep(FASTFORWARD_INTERVAL);
        } else {
          await sleep(NORMAL_INTERVAL);
        }

        let head = await this.headRepo.findByKey(this.name);
        let headNum = !!head ? head.num : -1;

        // delete invalid/incomplete blocks
        const futureBlocks = await this.powBlockRepo.findFutureBlocks(headNum);
        for (const blk of futureBlocks) {
          for (const txHash of blk.tx) {
            await this.powTxRepo.delete(txHash);
            this.log.info({ txHash }, 'deleted tx in blocks higher than head');
          }
          await this.powBlockRepo.delete(blk.hash);
          this.log.info({ height: blk.height, hash: blk.hash }, 'deleted block higher than head ');
        }
        const info = await this.pow.getBlockchainInfo();
        const bestNum = info.blocks;
        let tgtNum = headNum + LOOP_WINDOW;
        if (tgtNum > bestNum) {
          fastforward = false;
          tgtNum = bestNum;
        } else {
          fastforward = true;
        }

        if (headNum + 1 > tgtNum) {
          this.log.info({ best: bestNum, head: headNum }, `skip this round`);
          continue;
        }
        this.log.info(
          { best: bestNum, head: headNum },
          `start import PoW block from height ${headNum + 1} to ${tgtNum}`
        );

        for (let num = headNum + 1; num <= tgtNum; num++) {
          if (this.shutdown) {
            throw new InterruptedError();
          }
          const blk = await this.getBlockFromRPC(num);
          console.log(blk);
          if (!blk) {
            continue;
          }
          await this.processBlock(blk);
          this.log.info({ height: blk.height, hash: blk.hash }, 'imported PoW block');

          if (!head) {
            head = await this.headRepo.create(this.name, blk.height, blk.hash);
          } else {
            // head = await this.headRepo.update(this.name, blk.height, blk.hash);
            head.num = blk.height;
            head.hash = blk.hash;
            await head.save();
          }
        }
      } catch (e) {
        if (!(e instanceof InterruptedError)) {
          this.log.error({ err: e }, 'error in loop');
        } else {
          if (this.shutdown) {
            this.ev.emit('closed');
            break;
          }
        }
      }
    }
  }
}

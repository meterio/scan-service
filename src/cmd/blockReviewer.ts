import { EventEmitter } from 'events';

import { Network } from '../const';
import { AccountRepo, BlockRepo, CommitteeRepo, HeadRepo, MovementRepo, TxRepo } from '../repo';
import { IBlock } from '../model';
import pino, { Logger } from 'pino';

import { InterruptedError, Pos, sleep } from '../utils';
import { CMD } from './cmd';

const FASTFORWARD_INTERVAL = 500;
const NORMAL_INTERVAL = 2000;
const LOOP_WINDOW = 1000;
const RECOVERY_INTERVAL = 2 * 60 * 1000; // 2 min for recovery

export abstract class TxBlockReviewer extends CMD {
  protected shutdown = false;
  protected ev = new EventEmitter();
  protected name = '-';
  protected logger: Logger;
  protected network: Network;
  protected pos: Pos;

  protected headRepo = new HeadRepo();
  protected txRepo = new TxRepo();
  protected blockRepo = new BlockRepo();
  protected accountRepo = new AccountRepo();
  protected movementRepo = new MovementRepo();
  protected committeeRepo = new CommitteeRepo();
  protected normalInterval = NORMAL_INTERVAL;

  constructor(net: Network, normalInterval: number) {
    super();
    this.log = pino({
      transport: {
        target: 'pino-pretty',
      },
    });
    this.network = net;
    this.pos = new Pos(net);
    this.normalInterval = normalInterval;
  }

  protected async processGenesis(): Promise<void> {
    return;
  }

  public async beforeStart() {
    let head = await this.headRepo.findByKey(this.name);
    if (!head || head.num === 0) {
      await this.processGenesis();
      const genesis = await this.blockRepo.findByNumber(0);
      if (!genesis) {
        console.log('GENESIS NOT FOUND');
        console.log('will take a nap and quit');
        await sleep(5000);
        console.log('quit now');
        process.exit(-1);
      }
      if (!head) {
        await this.headRepo.create(this.name, 0, genesis.hash);
      } else {
        await this.headRepo.update(this.name, 0, genesis.hash);
      }
    }

    head = await this.headRepo.findByKey(this.name);
    if (head) {
      await this.cleanUpIncompleteData(head);
    }
  }

  public async cleanUpIncompleteData(head) {}

  public async start() {
    await this.beforeStart();
    this.log.info(`${this.name}: start`);
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
          await sleep(this.normalInterval);
        }
        let head = await this.headRepo.findByKey(this.name);
        if (!head) {
          head = await this.headRepo.create(this.name, -1, '0x');
        }
        let headNum = !!head ? head.num : -1;

        const posHead = await this.headRepo.findByKey('pos');
        const localBestNum = !!posHead ? posHead.num - 1 : 0;
        let endNum = headNum + LOOP_WINDOW;
        if (endNum > localBestNum) {
          endNum = localBestNum;
          fastforward = false;
        } else {
          fastforward = true;
        }

        if (headNum > endNum) {
          continue;
        }
        this.log.info(`start review PoS block from number ${headNum} to ${endNum} (best:${localBestNum})`);

        let num = headNum;
        for (;;) {
          if (this.shutdown) {
            throw new InterruptedError();
          }
          let start = new Date().getTime();
          const blk = await this.blockRepo.findBlockWithTxFrom(num);
          let end = new Date().getTime();
          console.log(`findBlockWithTxFrom elapsed=${end - start}`);
          start = end;

          if (!blk || blk.number > localBestNum || blk.number > endNum) {
            // update head before exit current loop
            let endBlock = await this.blockRepo.findByNumber(endNum);
            end = new Date().getTime();
            console.log(`findByNumber elapsed=${end - start}`);
            start = end;

            // head = await this.headRepo.update(this.name, endBlock.number, endBlock.hash);
            head.num = endBlock.number;
            head.hash = endBlock.hash;
            await head.save();
            console.log('nothing to process, update head to ', endBlock.number);
            break;
          }
          await this.processBlock(blk);

          // update head

          console.log('after process block, update head to ', blk.number);
          // head = await this.headRepo.update(this.name, blk.number, blk.hash);
          head.num = blk.number;
          head.hash = blk.hash;
          await head.save();
          num = blk.number;
        }
      } catch (e) {
        if (!(e instanceof InterruptedError)) {
          this.log.error({ err: e }, `Error during loop`);
          await sleep(RECOVERY_INTERVAL);
          this.log.info(`sleep for ${RECOVERY_INTERVAL / 1000} seconds, hope it would resolve`);
        } else {
          if (this.shutdown) {
            this.ev.emit('closed');
          } else {
          }
        }
      }
    }
  }

  abstract processBlock(blk: IBlock);
}

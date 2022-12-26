import { Network } from '../const';
import { HeadRepo, NFTRepo, LogEventRepo, BlockRepo, ContractRepo } from '../repo';
import { Head, NFT } from '../model';
import pino from 'pino';
import { GetNetworkConfig, ZeroAddress } from '../const';
import { InterruptedError, sleep } from '../utils';
import { CMD } from './cmd';
import { ERC1155ABI, ERC721ABI, ERC1155, ERC721, EIP173, EIP173ABI, abi, ERC1155Metadata } from '@meterio/devkit';
import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { NFTCache } from '../types/nftCache';

const FASTFORWARD_INTERVAL = 300; // 0.3 second gap between each loop
const NORMAL_INTERVAL = 2000; // 2 seconds gap between each loop
const LOOP_WINDOW = 10000;
const RECOVERY_INTERVAL = 5 * 60 * 1000; // 5 min for recovery
// Set the AWS Region
const BASE64_ENCODED_JSON = 'base64 encoded json';

export class NFTCMD extends CMD {
  private shutdown = false;
  private name = 'nft';
  private network: Network;

  private headRepo = new HeadRepo();
  private nftRepo = new NFTRepo();
  private evtRepo = new LogEventRepo();
  private blockRepo = new BlockRepo();
  private contractRepo = new ContractRepo();

  private nftCache: NFTCache;

  constructor(net: Network) {
    super();
    const dest = pino.destination({ sync: true });
    this.log = pino({
      transport: {
        target: 'pino-pretty',
      },
    });

    this.network = net;
    this.nftCache = new NFTCache(this.network);
  }

  public async start() {
    this.log.info(`${this.name}: start`);
    await this.loop();
    return;
  }

  public stop() {
    this.shutdown = true;
  }

  public async cleanUpIncompleteData(head: Head) {
    const nft = await this.nftRepo.deleteAfter(head.num);
    this.log.info({ nft }, `deleted dirty data higher than head ${head.num}`);
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

        const posHead = await this.headRepo.findByKey('pos');
        const bestNum = posHead.num;
        let endNum = headNum + LOOP_WINDOW > bestNum ? bestNum : headNum + LOOP_WINDOW;
        fastforward = endNum < bestNum;

        if (endNum <= headNum) {
          continue;
        }
        const endBlock = await this.blockRepo.findByNumber(endNum);

        this.log.info(
          { best: bestNum, head: headNum, mode: fastforward ? 'fast-forward' : 'normal' },
          `start import NFTs from number ${headNum} to ${endNum}`
        );
        // begin import round from headNum+1 to tgtNum

        await this.scanEIP173InRange(this.network, headNum, endNum);
        await this.scanERC721InRange(this.network, headNum, endNum);
        await this.scanERC1155SinglesInRange(this.network, headNum, endNum);
        await this.scanERC1155BatchsInRange(this.network, headNum, endNum);

        await this.nftCache.saveToDB();
        await this.updateHead(endBlock.number, endBlock.hash);
        await this.nftCache.clean();

        if (fastforward) {
          // fastforward mode, save blocks/txs with bulk insert
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
          this.log.error(`sleep for ${RECOVERY_INTERVAL / 1000 / 60} minutes, hope it will resolve`);
          await sleep(RECOVERY_INTERVAL);
        }
      }
    }
  }

  async updateHead(num, hash): Promise<Head> {
    const exist = await this.headRepo.exists(this.name);
    if (!exist) {
      return await this.headRepo.create(this.name, num, hash);
    } else {
      let head = await this.headRepo.findByKey(this.name);
      this.log.info(`update head to ${num}`);
      // head = await this.headRepo.update(this.name, res.block.number, res.block.hash);
      head.num = num;
      head.hash = hash;
      return await head.save();
    }
  }

  async scanERC1155BatchsInRange(network: Network, start, end: number): Promise<void> {
    const config = GetNetworkConfig(network);
    const batchs = await this.evtRepo.findByTopic0InBlockRangeSortAsc(ERC1155.TransferBatch.signature, start, end);
    this.log.info({ count: batchs.length }, `searching ERC1155 batchs in blocks [${start}, ${end})`);
    for (const evt of batchs) {
      let decoded: abi.Decoded;
      try {
        decoded = ERC1155.TransferBatch.decode(evt.data, evt.topics);
      } catch (e) {
        this.log.warn('error decoding TransferBatch event');
        continue;
      }
      const from = decoded.from.toLowerCase();
      const to = decoded.to.toLowerCase();
      const tokenAddress = evt.address.toLowerCase();
      for (const [i, id] of decoded.ids.entries()) {
        const value = Number(decoded.values[i]);
        const tokenStr = `${tokenAddress}[${id}:${value}]`;
        if (from !== ZeroAddress) {
          this.log.info({ txHash: evt.txHash }, `handle transfer ERC1155 ${tokenStr}`);
          await this.nftCache.transfer1155(tokenAddress, id, from, to, value);
          continue;
        }
        this.log.info({ txHash: evt.txHash }, `handle mint ERC1155 ${tokenStr}`);

        const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        const contract = new ethers.Contract(tokenAddress, [ERC1155ABI.uri], provider);
        let tokenURI = '';
        try {
          tokenURI = await contract.uri(id);
        } catch (e) {
          this.log.error({ err: e }, `error getting tokenURI for ERC1155 ${tokenStr}`);
        }
        let tokenJSON = {};
        if (tokenURI.startsWith('data:application/json;base64,')) {
          const content = Buffer.from(tokenURI.substring(29), 'base64').toString();
          tokenJSON = JSON.parse(content);
          tokenURI = BASE64_ENCODED_JSON;
        }
        const nft: NFT = {
          address: tokenAddress,
          tokenId: id,
          tokenURI,
          value,
          tokenJSON: JSON.stringify(tokenJSON),
          type: 'ERC1155',
          minter: to,
          owner: to,
          block: evt.block,
          creationTxHash: evt.txHash,
          status: 'new',
        };
        await this.nftCache.mint1155(nft);
      }
    }
  }

  async scanERC1155SinglesInRange(network: Network, start, end: number): Promise<void> {
    const config = GetNetworkConfig(network);
    const singles = await this.evtRepo.findByTopic0InBlockRangeSortAsc(ERC1155.TransferSingle.signature, start, end);
    this.log.info({ count: singles.length }, `searching ERC1155 singles in blocks [${start}, ${end})`);
    for (const evt of singles) {
      let decoded: abi.Decoded;
      try {
        decoded = ERC1155.TransferSingle.decode(evt.data, evt.topics);
      } catch (e) {
        this.log.warn('error decoding TransferSingle event');
        continue;
      }
      const from = decoded.from.toLowerCase();
      const to = decoded.to.toLowerCase();
      const tokenId = decoded.id;
      const value = new BigNumber(decoded.value.toString()).toNumber();
      const tokenAddress = evt.address.toLowerCase();
      const tokenStr = `${tokenAddress}[${tokenId}:${value}]`;

      if (from !== ZeroAddress) {
        this.log.info({ txHash: evt.txHash }, `handle transfer ERC1155 ${tokenStr}`);
        await this.nftCache.transfer1155(tokenAddress, tokenId, from, to, value);
        continue;
      }

      this.log.info({ txHash: evt.txHash }, `handle mint ERC1155 ${tokenStr}`);
      const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(tokenAddress, [ERC1155ABI.uri], provider);
      let tokenURI = '';
      try {
        tokenURI = await contract.uri(tokenId);
        tokenURI = this.nftCache.convertUrl(tokenURI);
      } catch (e) {
        this.log.error({ err: e }, `error getting tokenURI for ERC1155 ${tokenStr}`);
      }
      let tokenJSON = {};
      if (tokenURI.startsWith('data:application/json;base64,')) {
        const content = Buffer.from(tokenURI.substring(29), 'base64').toString();
        tokenURI = BASE64_ENCODED_JSON;
        try {
          tokenJSON = JSON.parse(content);
        } catch (e) {
          tokenJSON = JSON.parse(content.replaceAll("'", '"'));
        }
      }
      const nft: NFT = {
        address: tokenAddress,
        tokenId,
        tokenURI,
        value,
        tokenJSON: JSON.stringify(tokenJSON),
        type: 'ERC1155',
        minter: to,
        owner: to,
        block: evt.block,
        creationTxHash: evt.txHash,
        status: 'new',
      };
      await this.nftCache.mint1155(nft);
    }
  }

  async scanERC721InRange(network: Network, start, end: number): Promise<void> {
    const config = GetNetworkConfig(network);

    const transferEvts = await this.evtRepo.findByTopic0InBlockRangeSortAsc(ERC721.Transfer.signature, start, end);
    this.log.info({ count: transferEvts.length }, `searching ERC721 transfers in blocks [${start}, ${end})`);
    for (const evt of transferEvts) {
      let decoded: abi.Decoded;
      try {
        decoded = ERC721.Transfer.decode(evt.data, evt.topics);
      } catch (e) {
        this.log.debug(`error decoding Transfer event`);
        continue;
      }

      const from = decoded.from.toLowerCase();
      const to = decoded.to.toLowerCase();
      const tokenAddress = evt.address.toLowerCase();
      const tokenId = new BigNumber(decoded.tokenId).toFixed();
      const tokenStr = `${tokenAddress}[${tokenId}]`;

      if (from !== ZeroAddress) {
        this.log.info({ txHash: evt.txHash }, `handle transfer ERC721 ${tokenStr}`);
        await this.nftCache.transfer721(tokenAddress, tokenId, from, to);
        continue;
      }

      this.log.info({ txHash: evt.txHash }, `handle mint ERC721 ${tokenStr}`);
      const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(tokenAddress, [ERC721ABI.tokenURI], provider);
      let tokenURI = '';
      try {
        tokenURI = await contract.tokenURI(tokenId);
      } catch (e) {
        this.log.error({ err: e }, `error getting tokenURI for ERC721 ${tokenStr}`);
      }
      let tokenJSON = {};
      if (tokenURI.startsWith('data:application/json;base64,')) {
        const content = Buffer.from(tokenURI.substring(29), 'base64').toString();
        tokenURI = BASE64_ENCODED_JSON;
        try {
          tokenJSON = JSON.parse(content);
        } catch (e) {
          tokenJSON = JSON.parse(content.replaceAll("'", '"'));
        }
      }

      const nft: NFT = {
        address: tokenAddress,
        tokenId,
        value: 1,
        tokenURI,
        tokenJSON: JSON.stringify(tokenJSON),
        type: 'ERC721',
        minter: to,
        owner: to,
        block: evt.block,
        creationTxHash: evt.txHash,
        status: 'new',
      };
      await this.nftCache.mint721(nft);
    }
  }

  async scanEIP173InRange(network: Network, start, end: number): Promise<void> {
    const transferEvts = await this.evtRepo.findByTopic0InBlockRangeSortAsc(
      EIP173.OwnershipTransferred.signature,
      start,
      end
    );
    this.log.info({ count: transferEvts.length }, `searching ERC173 ownership transfer in blocks [${start}, ${end})`);
    for (const evt of transferEvts) {
      let decoded: abi.Decoded;
      try {
        decoded = EIP173.OwnershipTransferred.decode(evt.data, evt.topics);
      } catch (e) {
        this.log.warn(`error decoding OwnershipTransferred event`);
        continue;
      }

      const contractAddress = evt.address.toLowerCase();
      const previousOwner = decoded.previousOwner.toLowerCase();
      const newOwner = decoded.newOwner.toLowerCase();

      const contract = await this.contractRepo.findByAddress(contractAddress);
      if (contract && (!contract.owner || contract.owner === previousOwner)) {
        this.log.info(`Transfer ownership of contract ${contractAddress} from ${previousOwner} to ${newOwner}`);
        contract.owner = newOwner;
        await contract.save();
      }
    }
  }
}

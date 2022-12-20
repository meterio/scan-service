import { Network } from '../const';
import { NFT } from '../model';
import { ContractRepo, MovementRepo, NFTRepo } from '../repo';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  CopyObjectCommandInput,
} from '@aws-sdk/client-s3';
import PromisePool from '@supercharge/promise-pool/dist';
import { Document } from 'mongoose';
import { ZeroAddress } from '../const';
import { URL } from 'url';

// Set the AWS Region
const REGION = 'ap-southeast-1';
const ALBUM_BUCKET_NAME = 'nft-image.meter';
const S3_WEBSITE_BASE = 'nft-image.meter.io';
// const INFURA_IPFS_PREFIX = 'https://metersync.infura-ipfs.io/ipfs/';
const INFURA_IPFS_PREFIX = 'https://metersync.mypinata.cloud/ipfs/';
const CONVERTIBLES = ['ipfs://', 'https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/'];

const BASE64_ENCODED_JSON = 'base64 encoded json';

const s3 = new S3Client({
  region: REGION,
});

class NotEnoughBalance extends Error {}
export class NFTCache {
  private minted: { [key: string]: NFT } = {};
  private updated: { [key: string]: NFT & Document<any, any, any> } = {};
  private repo = new NFTRepo();
  private contractRepo = new ContractRepo();
  private movementRepo = new MovementRepo();
  private network: Network;

  constructor(network: Network) {
    this.network = network;
  }

  private key721(tokenAddress, tokenId: string): string {
    return `${tokenAddress}[${tokenId}]`;
  }

  private key1155(tokenAddress, tokenId, owner: string): string {
    return `${tokenAddress}[${tokenId}]_${owner}`;
  }

  public async mint721(nft: NFT) {
    if (nft.type !== 'ERC721') {
      return;
    }

    console.log(`Mint ERC721 ${nft.address}[${nft.tokenId}] to ${nft.owner}`);
    const key = this.key721(nft.address, nft.tokenId);
    if (key in this.minted) {
      console.log(`[SKIP] mint cache-existed ERC721 ${key}`);
      return;
    } else {
      const existed = await this.repo.findByTokenId(nft.address, nft.tokenId);
      if (existed && existed.length > 0) {
        console.log(`[SKIP] mint db-existed ERC721 ${key} at ${nft.creationTxHash}`);
        return;
      }
    }

    console.log(`MINTED: ${key} in mint721`);
    this.minted[key] = nft;
    console.log(JSON.stringify(this.minted[key]));
  }

  public async mint1155(nft: NFT) {
    if (nft.type !== 'ERC1155') {
      return;
    }

    console.log(`Mint ERC1155 ${nft.address}[${nft.tokenId}:${nft.value}] to ${nft.owner}`);
    const key = this.key1155(nft.address, nft.tokenId, nft.owner);
    if (key in this.minted) {
      const existed = this.minted[key];
      existed.value += nft.value;
      return;
    } else {
      const existed = await this.repo.findByIDWithOwner(nft.address, nft.tokenId, nft.owner);
      if (existed) {
        existed.value += nft.value;
        this.updated[key] = existed;
        return;
      }
    }

    console.log(`MINTED ${key} in mint1155`);
    this.minted[key] = nft;
    console.log(JSON.stringify(this.minted[key]));
  }

  public async transfer721(tokenAddress: string, tokenId: string, from: string, to: string) {
    const key = this.key721(tokenAddress, tokenId);

    console.log(`Transfer ERC721 ${tokenAddress}[${tokenId}] from ${from} to ${to}`);
    if (key in this.updated) {
      const nft = this.updated[key];
      if (nft.type !== 'ERC721') {
        console.log(`[SKIP] transfer 721 with non-721 token ${key}`);
        return;
      }
      if (nft.value < 1) {
        throw new NotEnoughBalance(`${key} in updated, actual:${nft.value}`);
      }
      nft.owner = to;
      return;
    }

    if (key in this.minted) {
      const nft = this.minted[key];
      if (nft.type !== 'ERC721') {
        console.log(`[SKIP] transfer 721 with non-721 token ${key}`);
        return;
      }
      if (nft.value < 1) {
        throw new NotEnoughBalance(`${key} in updated, actual:${nft.value}`);
      }
      nft.owner = to;
      return;
    }

    const nft = await this.repo.findByIDWithOwner(tokenAddress, tokenId, from);
    if (nft) {
      if (nft.type !== 'ERC721') {
        console.log(`[SKIP] transfer 721 with non-721 token ${key}`);
        return;
      }
      if (nft.value < 1) {
        throw new NotEnoughBalance(`${key} in updated, actual:${nft.value}`);
      }
      nft.owner = to;
      this.updated[key] = nft;
    }
  }

  public async transfer1155(tokenAddress: string, tokenId: string, from: string, to: string, value: number) {
    const key = this.key1155(tokenAddress, tokenId, from);

    console.log(`Transfer ERC1155 ${tokenAddress}[${tokenId}:${value}] from ${from} to ${to}`);
    if (key in this.updated) {
      const nft = this.updated[key];
      if (nft.type !== 'ERC1155') {
        console.log(`[SKIP] transfer 1155 with non-1155 token ${key}`);
        return;
      }
      if (nft.value < value) {
        throw new NotEnoughBalance(`${key} in updated, expected:${value}, actual:${nft.value}`);
      } else if (nft.value === value) {
        nft.owner = to;
      } else {
        const mintedKey = this.key1155(tokenAddress, tokenId, to);
        console.log(`MINTED ${key} in transfer1155 with key in upadted`);
        this.minted[mintedKey] = { ...nft.toJSON(), owner: to, value };
        console.log(JSON.stringify(this.minted[mintedKey]));
        nft.value -= value;
      }
      return;
    }

    if (key in this.minted) {
      const nft = this.minted[key];
      if (nft.type !== 'ERC1155') {
        console.log(`[SKIP] transfer 1155 with non-1155 token ${key}`);
        return;
      }
      if (nft.value < value) {
        throw new NotEnoughBalance(`${key} in minted, expected:${value}, actual:${nft.value}`);
      } else if (nft.value === value) {
        nft.owner = to;
      } else {
        const mintedKey = this.key1155(tokenAddress, tokenId, to);
        console.log(`MINTED ${key} in transfer1155 with key in minted`);
        this.minted[mintedKey] = { ...nft, owner: to, value };
        console.log(JSON.stringify(this.minted[mintedKey]));
        nft.value -= value;
      }
      return;
    }

    const nft = await this.repo.findByIDWithOwner(tokenAddress, tokenId, from);
    if (nft) {
      if (nft.type !== 'ERC1155') {
        console.log(`[SKIP] transfer 1155 with non-1155 token ${key}`);
        return;
      }
      if (nft.value < value) {
        throw new NotEnoughBalance(`${key} in db, expected:${value}, actual:${nft.value}`);
      } else if (nft.value === value) {
        nft.owner = to;
        this.updated[key] = nft;
      } else {
        const mintedKey = this.key1155(tokenAddress, tokenId, to);
        console.log(`MINTED ${key} in transfer1155`);
        this.minted[mintedKey] = { ...nft.toJSON(), owner: to, value };
        console.log(JSON.stringify(this.minted[mintedKey]));
        nft.value -= value;
        this.updated[key] = nft;
      }
      return;
    }
  }

  public async saveToDB() {
    // save minted nft
    const mintedCount = Object.keys(this.minted).length;
    if (mintedCount > 0) {
      console.log(`Start to update info for ${mintedCount} nfts`);
      await PromisePool.withConcurrency(4)
        .for(Object.keys(this.minted))
        .process(async (key, index, pool) => {
          const nft = this.minted[key];
          for (let i = 0; i < 3; i++) {
            try {
              if (i > 0) {
                console.log(`retry ${i + 1} time to update NFT Info for [${nft.tokenId}] of ${nft.address}`);
              }
              await this.updateNFTInfo(nft);
              return;
            } catch (e) {
              console.log(`${index + 1}/${mintedCount}| Error: ${e.message} for [${nft.tokenId}] of ${nft.address} `);
              continue;
            }
          }
        });
      let visited = {};
      for (const m of Object.values(this.minted)) {
        const vkey = `${m.address}_${m.tokenId}_${m.creationTxHash}`;
        if (!m.address) {
          console.log('vkey: ', vkey);
          console.log(JSON.stringify(m));
        }

        if (vkey in visited) {
          console.log(`ERROR: duplicate key: ${vkey}`);
        } else {
          console.log(`visit: ${vkey}`);
          visited[vkey] = true;
        }
        const found = await this.repo.findByIDWithOwner(m.address, m.tokenId, m.owner);
        if (found) {
          console.log(`DUPLICATE KEY IN DB: addr:${m.address}, id:${m.tokenId}, owner:${m.owner}`);
        }
      }
      await this.repo.bulkInsert(...Object.values(this.minted));
      console.log(`saved ${mintedCount} minted NFTs to DB`);
    }

    // save updated nfts
    const updatedCount = Object.keys(this.updated).length;
    if (updatedCount > 0) {
      await PromisePool.withConcurrency(4)
        .for(Object.keys(this.updated))
        .process(async (key, index) => {
          const u = this.updated[key];
          if (u.owner === ZeroAddress) {
            // Burnt
            console.log(`burned token: ${u.type} ${u.address}[${u.tokenId}:${u.value}] id:${u._id}`);
            await u.delete();
          } else {
            // Update
            await u.save();
          }
        });
      console.log(`saved ${updatedCount} updated NFTs to DB`);
    }

    const addrMap = {};
    Object.values(this.minted).map((nft) => {
      addrMap[nft.address] = true;
    });
    Object.values(this.updated).map((nft) => {
      addrMap[nft.address] = true;
    });

    await PromisePool.withConcurrency(4)
      .for(Object.keys(addrMap))
      .process(async (address, index) => {
        await this.updateCounts(address);
      });
  }

  convertUrl(uri: string): string {
    let url = uri;
    for (const conv of CONVERTIBLES) {
      if (url.startsWith(conv)) {
        return url.replace(conv, INFURA_IPFS_PREFIX);
      }
    }
    return url;
  }

  public async isCached(tokenAddress: string, tokenId: string): Promise<Boolean> {
    try {
      const res = await s3.send(
        new HeadObjectCommand({ Bucket: ALBUM_BUCKET_NAME, Key: `${tokenAddress}/${tokenId}` })
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  // upload token image to album
  public async uploadToAlbum(albumName, photoName, imageArraybuffer, mediaType) {
    const key = albumName + '/' + photoName;
    const uploadParams = {
      Bucket: ALBUM_BUCKET_NAME,
      Key: key,
      Body: imageArraybuffer,
      ACL: 'public-read',
      ContentType: mediaType,
    };
    try {
      const data = await s3.send(new PutObjectCommand(uploadParams));
      console.log(`uploaded file to ${key}`);
    } catch (err) {
      throw new Error('error uploading your photo: ' + err.message);
    }
  }

  /**
   * @param key https://nft-image.meter.io/0xfb5222679a578498e2f515ba339422443b329a73/8140
   */
  public async updateContentType(mediaURI, mediaType: string) {
    const key = new URL(mediaURI).pathname.slice(1);
    const copyInput = {
      CopySource: `${ALBUM_BUCKET_NAME}/${key}`,
      Bucket: ALBUM_BUCKET_NAME,
      Key: key,
      ACL: 'public-read',
      ContentType: mediaType,
      MetadataDirective: 'REPLACE',
    } as CopyObjectCommandInput;
    try {
      const data = await s3.send(new CopyObjectCommand(copyInput));
      console.log(`update ${key} with content-type ${mediaType}`);
    } catch (err) {
      throw new Error('error uploading your photo: ' + err.message);
    }
  }

  async updateNFTInfo(nft: NFT) {
    console.log(`update info for ${nft.type}:${nft.address}[${nft.tokenId}] with tokenURI: ${nft.tokenURI}`);
    if (!nft.tokenURI || nft.tokenURI == '') {
      console.log('SKIPPED due to empty tokenURI');
      nft.status = 'invalid';
      return;
    }
    let { tokenURI, tokenJSON } = nft;

    if (tokenURI !== BASE64_ENCODED_JSON) {
      const url = this.convertUrl(nft.tokenURI);
      console.log(`download token json from ${url}`);
      const tokenJSONRes = await axios.get(url);
      if (tokenJSONRes && tokenJSONRes.data) {
        try {
          tokenJSON = JSON.stringify(tokenJSONRes.data);
        } catch (e) {
          nft.status = 'invalid';
          return;
        }
      } else {
        nft.status = 'invalid';
        return;
      }
    }
    let mediaURI = '';
    try {
      const decoded = JSON.parse(tokenJSON);
      mediaURI = String(decoded.image);
    } catch (e) {
      console.log('could not decode tokenJSON');
      nft.status = 'invalid';
      return;
    }
    let mediaType: string;
    let reader: any;
    if (mediaURI.includes(';base64')) {
      reader = Buffer.from(mediaURI.split(';base64,').pop(), 'base64');
      mediaType = mediaURI.split(';base64').shift().replace('data:', '');
    } else {
      const downURI = this.convertUrl(mediaURI);
      console.log(`download media from ${downURI}`);
      const res = await axios.get(downURI, { responseType: 'arraybuffer' });
      if (res.status !== 200) {
        nft.status = 'uncached';
        return;
      }
      reader = res.data;
      mediaType = res.headers['content-type'];
    }

    const uploaded = await this.isCached(nft.address, nft.tokenId);
    const cachedMediaURI = `https://${S3_WEBSITE_BASE}/${nft.address}/${nft.tokenId}`;
    if (!uploaded) {
      await this.uploadToAlbum(nft.address, nft.tokenId, reader, mediaType);
      console.log(`uploaded ${mediaURI} to ${cachedMediaURI}`);
    }
    nft.tokenJSON = tokenJSON;
    nft.mediaType = mediaType;
    nft.mediaURI = cachedMediaURI;
    nft.status = 'cached';
  }

  private async updateCounts(address: string) {
    let updated = false;
    const c = await this.contractRepo.findByAddress(address);
    const ownerCount = await this.repo.distinctCountOwnerFilterByAddress(address);
    const tokenCount = await this.repo.distinctCountTokenFilterByAddress(address);
    const transferCount = await this.movementRepo.countNFTTxsByAddress(address);

    if (c.holdersCount && !c.holdersCount.isEqualTo(ownerCount)) {
      c.holdersCount = new BigNumber(ownerCount);
      updated = true;
    }
    if (!c.tokensCount) {
      c.tokensCount = new BigNumber(0);
      updated = true;
    }
    if (c.tokensCount || !c.tokensCount.isEqualTo(tokenCount)) {
      c.tokensCount = new BigNumber(tokenCount);
      updated = true;
    }
    if (c.transfersCount || !c.transfersCount.isEqualTo(transferCount)) {
      c.transfersCount = new BigNumber(transferCount);
      updated = true;
    }
    if (updated) {
      await c.save();
      console.log(
        `updated counts on nft ${c.address} tokens=${c.tokensCount.toFixed(0)} holders=${c.holdersCount.toFixed(
          0
        )} transfers=${c.transfersCount.toFixed(0)}`
      );
    }
  }

  public clean() {
    this.minted = {};
    this.updated = {};
  }
}

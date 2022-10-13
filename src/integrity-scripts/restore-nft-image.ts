#!/usr/bin/env node
require('../utils/validateEnv');

import { ERC721, ERC1155, abi } from '@meterio/devkit';
import { BigNumber } from 'bignumber.js';
import { HeadRepo, LogEventRepo } from '../repo';
import { connectDB, disconnectDB } from '../utils/db';
import axios from 'axios';
import { ethers } from 'ethers';
import { PromisePool } from '@supercharge/promise-pool';

import { S3Client, PutObjectCommand, ListObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

import { checkNetworkWithDB, runWithOptions, sleep } from '../utils';
import { ZeroAddress } from '../const';

// Set the AWS Region
const REGION = 'ap-northeast-1';
const ALBUM_BUCKET_NAME = 'meter-nft-image';
const INFURA_IPFS_PREFIX = 'https://meter.infura-ipfs.io/ipfs/';
const MAINNET_JSON_RPC = 'https://rpc.meter.io';
const TOKEN_URI_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
];
const URI_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'uri',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const SIGNER = new ethers.providers.JsonRpcProvider(MAINNET_JSON_RPC).getSigner();

const s3 = new S3Client({
  region: REGION,
});

type Target = {
  tokenAddress: string;
  tokenId: string;
  isERC721: boolean;
};
const targets: Target[] = [];

const imageInPinata = ['0x90bacf98c0d55255306a910da5959dcd72252ce0'];

const pinataTarget: Target[] = [];

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const evtRepo = new LogEventRepo();

  await checkNetworkWithDB(network);

  const pos = await headRepo.findByKey('pos');
  const best = pos.num;
  const step = 100000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const transferEvts = await evtRepo.findByTopic0InBlockRangeSortAsc(ERC721.Transfer.signature, start, end);
    console.log(`searching for ERC721 transfers in blocks [${start}, ${end}]`);
    for (const evt of transferEvts) {
      if (evt.topics && evt.topics[0] === ERC721.Transfer.signature) {
        let decoded: abi.Decoded;
        try {
          decoded = ERC721.Transfer.decode(evt.data, evt.topics);
        } catch (e) {
          continue;
        }

        const from = decoded.from.toLowerCase();
        // const to = decoded.to.toLowerCase();
        const tokenAddress = evt.address.toLowerCase();
        const tokenId = new BigNumber(decoded.tokenId).toFixed();

        if (from === ZeroAddress) {
          console.log(`mint ERC721 token [${tokenId}] on ${tokenAddress} `);
          if (imageInPinata.includes(tokenAddress)) {
            pinataTarget.push({ tokenAddress, tokenId, isERC721: true });
          } else {
            targets.push({ tokenAddress, tokenId, isERC721: true });
          }
        }
      }
    }

    const singles = await evtRepo.findByTopic0InBlockRangeSortAsc(ERC1155.TransferSingle.signature, start, end);
    console.log(`searching for ERC1155 singles in blocks [${start}, ${end}]`);
    for (const evt of singles) {
      if (evt.topics && evt.topics[0] === ERC1155.TransferSingle.signature) {
        let decoded: abi.Decoded;
        try {
          decoded = ERC1155.TransferSingle.decode(evt.data, evt.topics);
        } catch (e) {
          console.log('error decoding transfer event');
          continue;
        }
        const from = decoded.from.toLowerCase();
        // const to = decoded.to.toLowerCase();
        const tokenId = decoded.id;
        const tokenAddress = evt.address.toLowerCase();

        if (from === ZeroAddress) {
          console.log(`mint ERC1155 token [${tokenId}] on ${tokenAddress} `);
          targets.push({ tokenAddress, tokenId, isERC721: false });
        }
      }
    }

    console.log(`searching for ERC1155 batches in blocks [${start}, ${end}]`);
    const batchs = await evtRepo.findByTopic0InBlockRangeSortAsc(ERC1155.TransferBatch.signature, start, end);
    for (const evt of batchs) {
      if (evt.topics && evt.topics[0] === ERC1155.TransferBatch.signature) {
        let decoded: abi.Decoded;
        try {
          decoded = ERC1155.TransferBatch.decode(evt.data, evt.topics);
        } catch (e) {
          console.log('error decoding transfer event');
          return;
        }
        const from = decoded.from.toLowerCase();
        // const to = decoded.to.toLowerCase();
        const tokenAddress = evt.address.toLowerCase();
        for (const [i, id] of decoded.ids.entries()) {
          if (from === ZeroAddress) {
            console.log(`mint ERC1155 token [${id}] on ${tokenAddress} `);
            targets.push({ tokenAddress, tokenId: `${id}`, isERC721: false });
          }
        }
      }
    }
  }
  console.log(`------------------------------------------------------`);
  console.log(`Start to upload for ${targets.length + pinataTarget.length} nft images `);
  console.log(`------------------------------------------------------`);
  const total = targets.length + pinataTarget.length;
  let totalIndex = 1;
  await PromisePool.withConcurrency(20)
    .for(targets)
    .process(async (targetData, index, pool) => {
      try {
        await actionUpload(targetData.tokenAddress, targetData.tokenId, targetData.isERC721);
        console.log(`${index}/${total}| Successfully processed`);
        totalIndex = index;
      } catch (e) {
        console.log(
          `${index}/${total}| Error: ${e.message} for [${targetData.tokenId}] of ${targetData.tokenAddress} `
        );
      }
    });

  const pinataLength = pinataTarget.length;

  for (const t of pinataTarget) {
    try {
      await actionUpload(t.tokenAddress, t.tokenId, t.isERC721);
      console.log(`${totalIndex}/${pinataLength}| Successfully upload`);
      totalIndex++;
      console.log('sleep 4s');
      await sleep(1000 * 4);
    } catch (e) {
      console.log(`${totalIndex}/${total}| Error: ${e.message} for [${t.tokenId}] of ${t.tokenAddress} `);
      console.log('sleep 60s');
      await sleep(1000 * 60);
      continue;
    }
  }
};

// get token image arraybuffer
const getImageArraybuffer = async (tokenAddress, tokenId, isERC721) => {
  try {
    let contract;
    let metaURI;

    if (isERC721) {
      contract = new ethers.Contract(tokenAddress, TOKEN_URI_ABI, SIGNER);
      metaURI = await contract.tokenURI(tokenId);
    } else {
      contract = new ethers.Contract(tokenAddress, URI_ABI, SIGNER);
      metaURI = await contract.uri(tokenId);
    }
    if (!metaURI) {
      throw new Error(`Can not get tokenURI`);
    }
    const httpMetaURI = String(metaURI).replace('ipfs://', INFURA_IPFS_PREFIX);

    const meta = await axios.get(httpMetaURI);
    console.log(`ERC${isERC721 ? '721' : '1155'} [${tokenId}] on ${tokenAddress} Metadata:
    name: ${meta.data.name}
    image: ${meta.data.image}`);

    const image = String(meta.data.image);
    if (image.includes(';base64')) {
      return Buffer.from(image.split(';base64').pop(), 'base64');
    }
    const imgURI = image.replace('ipfs://', INFURA_IPFS_PREFIX);
    const res = await axios.get(imgURI, { responseType: 'arraybuffer' });
    return res.data;
  } catch (err) {
    throw new Error('There was an error getting image buffer: ' + err.message);
  }
};

const exist = async (tokenAddress: string, tokenId: string): Promise<Boolean> => {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: ALBUM_BUCKET_NAME, Key: `${tokenAddress}/${tokenId}` }));
    // console.log(res);
    return true;
  } catch (e) {
    // console.log('Error happened', e);
    return false;
  }
};

// check image is uploaded
const checkIsUploaded = async (tokenAddress: string, tokenId: string): Promise<Boolean> => {
  const album = await getAlbum(tokenAddress);
  if (!album) {
    // album is not exit, need create
    await createAlbum(tokenAddress);

    return false;
  } else {
    // album exit
    // check image ${tokenId} is already uploaded
    const imgPath = tokenAddress + '/' + tokenId;
    const isUploaded = album.some((a) => a.Key === imgPath);

    return isUploaded;
  }
};

// Create an album in the bucket
const createAlbum = async (albumName) => {
  try {
    const key = albumName + '/';
    const params = { Bucket: ALBUM_BUCKET_NAME, Key: key };
    const data = await s3.send(new PutObjectCommand(params));
    console.log('Successfully created album.', albumName);
    return data;
  } catch (err) {
    throw new Error('There was an error creating your album: ' + err.message);
  }
};

// Get an Album
const getAlbum = async (albumName) => {
  try {
    const data = await s3.send(
      new ListObjectsCommand({
        Prefix: albumName,
        Bucket: ALBUM_BUCKET_NAME,
      })
    );

    return data.Contents;
  } catch (err) {
    throw new Error('There was an error check album exists: ' + err.message);
  }
};

// upload token image to album
const uploadToAlbum = async (albumName, photoName, imageArraybuffer) => {
  const photoKey = albumName + '/' + photoName;
  const uploadParams = {
    Bucket: ALBUM_BUCKET_NAME,
    Key: photoKey,
    Body: imageArraybuffer,
    ACL: 'public-read',
  };
  try {
    const data = await s3.send(new PutObjectCommand(uploadParams));
  } catch (err) {
    throw new Error('error uploading your photo: ' + err.message);
  }
};

const actionUpload = async (tokenAddress, tokenId, isERC721) => {
  // const tokenAddress = '0x608203020799f9bda8bfcc3ac60fc7d9b0ba3d78';
  // const tokenId = '2204';
  const existed = await exist(tokenAddress, tokenId);
  // const uploadStatus = await checkIsUploaded(tokenAddress, tokenId);
  if (!existed) {
    const imageArraybuffer = await getImageArraybuffer(tokenAddress, tokenId, isERC721);
    await uploadToAlbum(tokenAddress, tokenId, imageArraybuffer);
    console.log(`uploaded image: ${tokenAddress}/${tokenId}`);
  } else {
    console.log(`skip existing image: ${tokenAddress}/${tokenId}`);
  }
};

(async () => {
  try {
    await runWithOptions(runAsync);
    // const tokenAddress = '0x608203020799f9bda8bfcc3ac60fc7d9b0ba3d78';
    // const tokenId = '2204';
    // const isERC721 = true;
    // actionUpload(tokenAddress, tokenId, isERC721);
    // const res = await exist('0x608203020799f9bda8bfcc3ac60fc7d9b0ba3d78', '9999');
    // console.log(res);
    await disconnectDB();
  } catch (e) {
    console.log(`error: ${e.name} ${e.message} - ${e.stack}`);
    process.exit(-1);
  }
})();

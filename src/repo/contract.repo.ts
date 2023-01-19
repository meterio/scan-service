import { BigNumber } from 'bignumber.js';
import { number } from 'bitcoinjs-lib/src/script';
import { ContractType } from '../const';

import { BlockConcise } from '../model/blockConcise.interface';
import { Contract } from '../model/contract.interface';
import contractModel from '../model/contract.model';
import { formalizePageAndLimit } from '../utils';

export default class ContractRepo {
  private model = contractModel;

  public async findAll() {
    return this.model.find();
  }

  public async count() {
    return this.model.estimatedDocumentCount();
  }

  public async findByType(type: ContractType) {
    return this.model.find({ type });
  }

  public async findByAddress(address: string) {
    return this.model.findOne({ address: address.toLowerCase() });
  }

  public async findByAddressList(addresses: string[]) {
    return this.model.find({ address: { $in: addresses } });
  }

  public async existsByAddress(address: string) {
    return this.model.exists({ address: address.toLowerCase() });
  }

  public async findAllTokens() {
    return this.model.find({ type: { $in: [ContractType.ERC20, ContractType.ERC721, ContractType.ERC1155] } });
  }

  public async findAllNFTTokens() {
    return this.model.find({ type: { $in: [ContractType.ERC721, ContractType.ERC1155] } });
  }

  public async create(
    type: ContractType,
    address: string,
    name: string,
    symbol: string,
    officialSite: string,
    totalSupply: BigNumber,
    master: string,
    code: string,
    creationTxHash: string,
    firstSeen: BlockConcise,
    decimals = 18
  ) {
    return this.model.create({
      type,
      name,
      symbol,
      address,
      officialSite,
      decimals,
      totalSupply,
      holdersCount: new BigNumber(0),
      transfersCount: new BigNumber(0),
      tokensCount: new BigNumber(0),
      master: master.toLowerCase(),
      owner: master.toLowerCase(),
      code,
      verified: false,
      creationTxHash,
      firstSeen,
    });
  }

  public async bulkInsert(...contracts: Contract[]) {
    return this.model.create(contracts);
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'firstSeen.number': { $gt: blockNum } });
  }

  public async findUnverifiedContracts(addressList: string[]) {
    return this.model.find({ verified: false, address: { $in: addressList } });
  }

  public async findVerifiedContractsWithCreationInputHash(creationInputHash: string) {
    return this.model.findOne({ verified: true, status: { $ne: 'match' }, creationInputHash });
  }

  public async findVerifiedContractsInRange(startBlock, endBlock: number) {
    return this.model.find({
      verified: true,
      status: { $ne: 'match' },
      'firstSeen.number': { $gte: startBlock, $lt: endBlock },
    });
  }

  public async findUnverifiedContractsWithCreationInputHash(creationInputHash: string) {
    return this.model.find({ verified: false, creationInputHash });
  }

  public async findCodeMatchVerifiedContract() {
    return this.model.find({ verified: true, status: 'match' });
  }

  public async findContractByRegexName(name: string) {
    return this.model.find({ name: { $regex: name, $options: 'i' } });
  }

  public async findBySymbol(symbol: string) {
    return this.model.findOne({ symbol: { $regex: `^${symbol}$`, $options: 'i' } });
  }

  public async findByFuzzyName(fuzzyName: string) {
    return this.model.find({
      name: { $regex: new RegExp(`.*${fuzzyName}.*`, 'i') },
    });
  }

  // paginates
  private async paginate(query: any, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    console.log('page=', page, 'limit=', limit);
    const count = await this.model.count(query);
    const result = await this.model
      .find(query)
      .sort({ 'block.number': -1 })
      .limit(limit)
      .skip(limit * page);

    return { count, result };
  }

  public async paginateWithAddressList(addresses: string[], pageNum?: number, limitNum?: number) {
    return this.paginate({ address: { $in: addresses } }, pageNum, limitNum);
  }

  public async paginateNFTInRange(fromNum: number, toNum: number, pageNum?: number, limitNum?: number) {
    const query = {
      type: { $in: [ContractType.ERC721, ContractType.ERC1155] },
      'firstSeen.number': { $gte: fromNum, $lte: toNum },
    };
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count(query);
    const result = await this.model
      .find(query)
      // .sort({ 'block.number': 1 })
      .limit(limit)
      .skip(limit * page);

    return { count, result };
  }

  public async findEmptyOwners() {
    return this.model.find({ owner: { $exists: false } });
  }
}

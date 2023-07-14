import { BigNumber } from 'bignumber.js';
import { ContractType } from '../const';

import { Contract, IContract, IBlockConcise } from '../model';
import { formalizePageAndLimit } from '../utils';

let stringComparison = require('string-comparison');
let cos = stringComparison.cosine;

export class ContractRepo {
  private model = Contract;

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
    firstSeen: IBlockConcise,
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

  public async bulkInsert(...contracts: IContract[]) {
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

  public async findVerifiedContractWithCodeHash(codeHash: string) {
    return this.model.findOne({ verified: true, status: { $ne: 'match' }, codeHash });
  }

  public async findEmptyCodeHash() {
    return this.model.find({ codeHash: { $exists: false } });
  }

  public async findVerifiedContractsInRange(startBlock, endBlock: number) {
    return this.model.find({
      verified: true,
      status: { $ne: 'match' },
      'firstSeen.number': { $gte: startBlock, $lt: endBlock },
    });
  }

  public async findIncorrectVerified() {
    return this.model.find({ verified: true, status: 'match', codeHash: { $exists: false } });
  }

  public async findUnverifiedContractsWithCreationInputHash(creationInputHash: string) {
    return this.model.find({ verified: false, creationInputHash });
  }

  public async findUnverifiedContractsWithCodeHash(codeHash: string) {
    return this.model.find({ verified: false, codeHash });
  }

  public async findCodeMatchVerifiedContract() {
    return this.model.find({ verified: true, status: 'match' });
  }

  public async findContractByRegexName(name: string) {
    return this.model.find({ name: { $regex: name, $options: 'i' } });
  }

  public async findBySymbol(symbol: string) {
    return this.model.findOne({ symbol: { $regex: `^${symbol}$`, $options: 'i' } }).sort({ rank: -1 });
  }

  public async findByFuzzySymbol(fuzzySymbol: string) {
    const result = await this.model.find({ symbol: { $regex: new RegExp(`.*${fuzzySymbol}.*`, 'i') } });
    return result.sort((a, b) =>
      cos.similarity(a.symbol, fuzzySymbol) >= cos.similarity(b.symbol, fuzzySymbol) ? 1 : -1
    );
  }

  public async findByFuzzyName(fuzzyName: string) {
    const result = await this.model.find({ name: { $regex: new RegExp(`.*${fuzzyName}.*`, 'i') } });
    return result.sort((a, b) => (cos.similarity(a.name, fuzzyName) >= cos.similarity(b.name, fuzzyName) ? 1 : -1));
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

  public async findFirstSeenInRange(start, end: number) {
    return this.model.find({ 'firstSeen.number': { $gte: start, $lte: end } });
  }

  public async distinctAddress() {
    return this.model.distinct('address');
  }
}

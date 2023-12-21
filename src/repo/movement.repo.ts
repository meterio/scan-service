import { Token } from '../const';
import { RECENT_WINDOW } from '../const';
import { Movement, IMovement } from '../model';

import { formalizePageAndLimit } from '../utils';

export class MovementRepo {
  private model = Movement;

  public async findAll() {
    return this.model.find();
  }

  public async count() {
    return this.model.estimatedDocumentCount();
  }

  public async findRecent() {
    return this.model.find().sort({ _id: -1 }).limit(RECENT_WINDOW);
  }

  public async findRecentWithLimit(count: number) {
    return this.model.find().sort({ _id: -1 }).limit(count);
  }

  public async findByHash(hash: string) {
    return this.model.findOne({ hash });
  }

  public async findByBlockNum(blockNum: number) {
    return this.model.find({ 'block.number': blockNum });
  }

  public async findByTokenInRange(token: Token, startNum: number, endNum: number) {
    return this.model
      .find({
        token,
        'block.number': { $gte: startNum, $lte: endNum },
      })
      .sort({ _id: 1 });
  }

  public async countByTokenAddress(tokenAddress: string) {
    return this.model.count({
      tokenAddress: tokenAddress.toLowerCase(),
    });
  }

  public async countByTxHash(txHash: string) {
    return this.model.count({
      txHash,
    });
  }

  public async exist(txHash: string, clauseIndex: number) {
    return this.model.exists({ txHash, clauseIndex });
  }

  public async create(movement: IMovement) {
    return this.model.create(movement);
  }

  public async deleteFutureMovements(num: number) {
    return this.model.find({ 'block.number': { $gt: num } });
  }

  public async bulkInsert(...movements: IMovement[]) {
    return this.model.create(movements);
  }

  public async bulkUpsert(...movements: IMovement[]) {
    for (const m of movements) {
      const r = await this.model.findOneAndUpdate(
        { txHash: m.txHash, clauseIndex: m.clauseIndex, logIndex: m.logIndex, token: m.token },
        m,
        { upsert: true, new: true, overwrite: true }
      );
    }
    return true;
  }

  public async deleteAfter(blockNum: number) {
    return this.model.deleteMany({ 'block.number': { $gt: blockNum } });
  }

  // paginates
  private async paginate(query: any, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const count = await this.model.count(query);
    const result = await this.model
      .find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .skip(limit * page);
    return { count, result };
  }

  public async paginateByTokenAddrTokenId(addr: string, id: string, pageNum?: number, limitNum?: number) {
    return this.paginate(
      {
        tokenAddress: addr.toLowerCase(),
        nftTransfers: { $elemMatch: { tokenId: id } },
      },
      pageNum,
      limitNum
    );
  }

  // public async paginateByAccount(addr: string, pageNum?: number, limitNum?: number) {
  //   return this.paginate({ $or: [{ from: addr }, { to: addr }] }, pageNum, limitNum);
  // }

  public async paginateByAccount(addr: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const query = { $or: [{ from: addr.toLowerCase() }, { to: addr.toLowerCase() }] };
    const count = await this.model.count(query);
    const result = await this.model.aggregate([
      { $match: query },
      { $sort: { _id: -1 } },
      { $skip: limit * page },
      { $limit: limit },
      { $lookup: { from: 'contract', localField: 'tokenAddress', foreignField: 'address', as: 'contract' } },
      {
        $addFields: {
          contract: {
            $cond: { if: { $eq: [{ $size: '$contract' }, 0] }, then: null, else: { $arrayElemAt: ['$contract', 0] } },
          },
        },
      },
    ]);
    return { count, result };
  }

  public async countERC20TxsByAddress(address: string) {
    return this.model.count({
      $or: [
        { from: address.toLowerCase(), token: Token.ERC20 },
        { to: address.toLowerCase(), token: Token.ERC20 },
      ],
    });
  }

  public async countERC721TxsByAddress(address: string) {
    return this.model.count({
      $or: [
        { from: address.toLowerCase(), token: Token.ERC721 },
        { to: address.toLowerCase(), token: Token.ERC721 },
      ],
    });
  }

  public async countERC1155TxsByAddress(address: string) {
    return this.model.count({
      $or: [
        { from: address.toLowerCase(), token: Token.ERC1155 },
        { to: address.toLowerCase(), token: Token.ERC1155 },
      ],
    });
  }

  public async countNFTTxsByAddress(address: string) {
    return this.model.count({
      $or: [
        { from: address.toLowerCase(), token: Token.ERC721 },
        { to: address.toLowerCase(), token: Token.ERC721 },
        { from: address.toLowerCase(), token: Token.ERC1155 },
        { to: address.toLowerCase(), token: Token.ERC1155 },
      ],
    });
  }

  public async paginateByTokenAddress(addr: string, pageNum?: number, limitNum?: number) {
    console.time('movement paginate by token');
    const r = await this.paginate({ tokenAddress: addr.toLowerCase() }, pageNum, limitNum);
    console.timeEnd('movement paginate by token');
    return r;
  }

  public async paginateByTokenAddressInRange(
    start: number,
    end: number,
    addr: string,
    pageNum?: number,
    limitNum?: number
  ) {
    return this.paginate(
      {
        $and: [{ 'block.timestamp': { $gte: start, $lte: end } }, { tokenAddress: addr.toLowerCase() }],
      },
      pageNum,
      limitNum
    );
  }

  public async paginateERC20TxsByAccount(addr: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const query = {
      $or: [
        { from: addr.toLowerCase(), token: 'ERC20' },
        { to: addr.toLowerCase(), token: 'ERC20' },
      ],
    };
    const count = await this.countERC20TxsByAddress(addr);
    const result = await this.model
      .aggregate([
        { $match: query },
        // { $sort: { 'block.number': -1 } },
        // { $skip: limit * page },
        // { $limit: limit },
        { $lookup: { from: 'contract', localField: 'tokenAddress', foreignField: 'address', as: 'contract' } },
        {
          $addFields: {
            contract: {
              $cond: { if: { $eq: [{ $size: '$contract' }, 0] }, then: null, else: { $arrayElemAt: ['$contract', 0] } },
            },
          },
        },
      ])
      .allowDiskUse(true);

    const sorted = result.sort((a, b) => (a.block.number > b.block.number ? -1 : 1));
    const actual = sorted.slice(page * limit, (page + 1) * limit);

    return { count, result: actual };
  }

  public async paginateERC20TxsByAccountInRange(
    start: number,
    end: number,
    addr: string,
    pageNum?: number,
    limitNum?: number
  ) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const query = {
      'block.timestamp': { $gte: start, $lte: end },
      $or: [
        { from: addr.toLowerCase(), token: 'ERC20' },
        { to: addr.toLowerCase(), token: 'ERC20' },
      ],
    };
    const count = await this.countERC20TxsByAddress(addr);
    const result = await this.model.aggregate([
      { $match: query },
      // { $sort: { 'block.number': -1 } },
      // { $skip: limit * page },
      // { $limit: limit },
      { $lookup: { from: 'contract', localField: 'tokenAddress', foreignField: 'address', as: 'contract' } },
      {
        $addFields: {
          contract: {
            $cond: { if: { $eq: [{ $size: '$contract' }, 0] }, then: null, else: { $arrayElemAt: ['$contract', 0] } },
          },
        },
      },
    ]);

    const sorted = result.sort((a, b) => (a.block.number > b.block.number ? -1 : 1));
    const actual = sorted.slice(page * limit, (page + 1) * limit);

    return { count, result: actual };
  }

  public async paginateNFTTxsByAccount(addr: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const query = {
      $or: [
        { from: addr.toLowerCase(), token: 'ERC721' },
        { to: addr.toLowerCase(), token: 'ERC721' },
        { from: addr.toLowerCase(), token: 'ERC1155' },
        { to: addr.toLowerCase(), token: 'ERC1155' },
      ],
    };
    const count = await this.countNFTTxsByAddress(addr);
    const result = await this.model.aggregate([
      { $match: query },
      // { $sort: { 'block.number': -1 } },
      // { $skip: limit * page },
      // { $limit: limit },
      { $lookup: { from: 'contract', localField: 'tokenAddress', foreignField: 'address', as: 'contract' } },
      { $unwind: '$contract' },
    ]);

    const sorted = result.sort((a, b) => (a.block.number > b.block.number ? -1 : 1));
    const actual = sorted.slice(page * limit, (page + 1) * limit);

    return { count, result: actual };
  }

  public async paginateNFTTxsByAccountInRange(
    start: number,
    end: number,
    addr: string,
    pageNum?: number,
    limitNum?: number
  ) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const query = {
      'block.timestamp': { $gte: start, $lte: end },
      $or: [
        { from: addr.toLowerCase(), token: 'ERC721' },
        { to: addr.toLowerCase(), token: 'ERC721' },
        { from: addr.toLowerCase(), token: 'ERC1155' },
        { to: addr.toLowerCase(), token: 'ERC1155' },
      ],
    };
    const count = await this.countNFTTxsByAddress(addr);
    const result = await this.model.aggregate([
      { $match: query },
      // { $sort: { 'block.number': -1 } },
      // { $skip: limit * page },
      // { $limit: limit },
      { $lookup: { from: 'contract', localField: 'tokenAddress', foreignField: 'address', as: 'contract' } },
      { $unwind: '$contract' },
    ]);

    const sorted = result.sort((a, b) => (a.block.number > b.block.number ? -1 : 1));
    const actual = sorted.slice(page * limit, (page + 1) * limit);

    return { count, result: actual };
  }

  public async paginateERC721TxsByAccount(addr: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const query = {
      $or: [
        { from: addr.toLowerCase(), token: 'ERC721' },
        { to: addr.toLowerCase(), token: 'ERC721' },
      ],
    };
    const count = await this.countERC721TxsByAddress(addr);
    const result = await this.model.aggregate([
      { $match: query },
      // { $sort: { 'block.number': -1 } },
      // { $skip: limit * page },
      // { $limit: limit },
      { $lookup: { from: 'contract', localField: 'tokenAddress', foreignField: 'address', as: 'contract' } },
      {
        $addFields: {
          contract: {
            $cond: { if: { $eq: [{ $size: '$contract' }, 0] }, then: null, else: { $arrayElemAt: ['$contract', 0] } },
          },
        },
      },
    ]);
    const sorted = result.sort((a, b) => (a.block.number > b.block.number ? -1 : 1));
    const actual = sorted.slice(page * limit, (page + 1) * limit);
    return { count, result: actual };
  }

  public async paginateERC1155TxsByAccount(addr: string, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    const query = {
      $or: [
        { from: addr.toLowerCase(), token: 'ERC1155' },
        { to: addr.toLowerCase(), token: 'ERC1155' },
      ],
    };
    const count = await this.countERC1155TxsByAddress(addr);
    const result = await this.model.aggregate([
      { $match: query },
      // { $sort: { 'block.number': -1 } },
      // { $skip: limit * page },
      // { $limit: limit },
      { $lookup: { from: 'contract', localField: 'tokenAddress', foreignField: 'address', as: 'contract' } },
      {
        $addFields: {
          contract: {
            $cond: { if: { $eq: [{ $size: '$contract' }, 0] }, then: null, else: { $arrayElemAt: ['$contract', 0] } },
          },
        },
      },
    ]);
    const sorted = result.sort((a, b) => (a.block.number > b.block.number ? -1 : 1));
    const actual = sorted.slice(page * limit, (page + 1) * limit);
    return { count, result: actual };
  }

  // this is dangerous
  public async deleteByToken(token: Token) {
    return this.model.deleteMany({ token });
  }

  public async paginateNFTMovementsInRange(fromNum: number, toNum: number, pageNum?: number, limitNum?: number) {
    const { page, limit } = formalizePageAndLimit(pageNum, limitNum);
    let query = {
      token: { $in: ['ERC1155', 'ERC721'] },
      'block.number': { $gte: fromNum, $lte: toNum },
    };

    const count = await this.model.count({
      token: { $in: [Token.ERC1155, Token.ERC721] },
      'block.number': { $gte: fromNum, $lte: toNum },
    });
    const result = await this.model.aggregate([
      { $match: query },
      // { $sort: { 'block.number': 1 } },
      { $skip: limit * page },
      { $limit: limit },
    ]);
    return { count, result };
  }

  public async findInvalidNFTMovements() {
    let query = {
      token: { $in: [Token.ERC1155, Token.ERC721] },
      $or: [{ 'nftTransfers.0.tokenId': { $exists: false } }, { from: { $exists: false } }],
    };

    return this.model.find(query);
  }

  public async findNaNMovments(fromNum: number, toNum: number) {
    return this.model.find({ amount: 'NaN', 'block.number': { $gte: fromNum, $lte: toNum } });
  }
}

import { BigNumber } from 'bignumber.js';
import {
  AccountRepo,
  BidRepo,
  BlockRepo,
  BucketRepo,
  ContractRepo,
  MovementRepo,
  TokenBalanceRepo,
  TxDigestRepo,
  TxRepo,
  ABIFragmentRepo,
  NFTRepo,
  InternalTxRepo,
  LogEventRepo,
} from '../../repo';
import { ContractType } from '../const';
import { Request, Response } from 'express';
import { try$ } from 'express-toolbox';
import { FormatTypes, Interface } from 'ethers/lib/utils';
import { BigNumber as EBN } from 'ethers';

import { extractPageAndLimitQueryParam } from '../utils/utils';
import { BaseController } from './baseController';
import { Network } from '../../const';

class AccountController extends BaseController {
  public path = '/api/accounts';
  private accountRepo = new AccountRepo();
  private txRepo = new TxRepo();
  private movementRepo = new MovementRepo();
  private bucketRepo = new BucketRepo();
  private blockRepo = new BlockRepo();
  private contractRepo = new ContractRepo();
  private tokenBalanceRepo = new TokenBalanceRepo();
  private nftRepo = new NFTRepo();
  private bidRepo = new BidRepo();
  private txDigestRepo = new TxDigestRepo();
  private abiFragmentRepo = new ABIFragmentRepo();
  private internalTxRepo = new InternalTxRepo();
  private logEventRepo = new LogEventRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/top/mtr`, try$(this.getTopMTRAccounts));
    this.router.get(`${this.path}/top/mtrg`, try$(this.getTopMTRGAccounts));

    this.router.get(`${this.path}/:address`, try$(this.getAccount));

    // token address
    this.router.get(`${this.path}/:tokenAddress/holders`, try$(this.getTokenHoldersByAccount));
    this.router.get(`${this.path}/:address/transfers`, try$(this.getTransfersByAccount));

    // user address
    this.router.get(`${this.path}/:address/txs`, try$(this.getTxsByAccount));
    this.router.get(`${this.path}/:address/txlist`, try$(this.getTxlistByAccount));
    this.router.get(`${this.path}/:address/tokens`, try$(this.getTokensByAccount));
    this.router.get(`${this.path}/:address/erc20tokens`, try$(this.getERC20TokensByAccount));
    this.router.get(`${this.path}/:address/nfttokens`, try$(this.getNFTTokensByAccount));
    this.router.get(`${this.path}/:address/nfts`, try$(this.getNFTsByAccount));
    this.router.get(`${this.path}/:address/erc20txs`, try$(this.getERC20TxsByAccount));

    // deprecated
    this.router.get(`${this.path}/:address/erc721txs`, try$(this.getERC721TxsByAccount));
    // deprecated
    this.router.get(`${this.path}/:address/erc1155txs`, try$(this.getERC1155TxsByAccount));
    this.router.get(`${this.path}/:address/nfttxs`, try$(this.getNFTTxsByAccount));
    this.router.get(`${this.path}/:address/buckets`, try$(this.getBucketsByAccount));
    this.router.get(`${this.path}/:address/bids`, try$(this.getBidsByAccount));
    this.router.get(`${this.path}/:address/proposed`, try$(this.getProposedByAccount));
    this.router.get(`${this.path}/:address/delegators`, try$(this.getDelegatorsByAccount));
    this.router.get(`${this.path}/:address/:id/nfttxs`, try$(this.getNFTTxsByTokenAddrTokenId));
    this.router.get(`${this.path}/get/domainnames`, try$(this.getDomainnames));
    this.router.get(`${this.path}/:address/internaltxs`, try$(this.getInternalTxs));
    this.router.get(`${this.path}/:address/events`, try$(this.getEvents));
  }

  private getDomainnames = async (req: Request, res: Response) => {
    const name = req.query.domainname || '';
    const accts = await this.accountRepo.findByFuzzyName(String(name));

    return res.json({
      accounts: accts
        .map((a) => a.toJSON())
        .map((a) => {
          return {
            address: a.address,
            names: a.alias ? [a.name, ...a.alias] : [a.name],
          };
        }),
    });
  };

  private getTopMTRAccounts = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.accountRepo.paginateTopMTRAccounts(page, limit);
    return res.json({
      totalRows: paginate.count,
      accounts: paginate.result.map(this.convertAccount),
    });
  };

  private getTopMTRGAccounts = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.accountRepo.paginateTopMTRGAccounts(page, limit);
    return res.json({
      totalRows: paginate.count,
      accounts: paginate.result.map(this.convertAccount),
    });
  };

  private convertAccount = (account: any) => {
    if (!account) {
      return {
        mtrBalance: 0,
        mtrBounded: 0,
        mtrgBalance: 0,
        mtrgBounded: 0,
        firstSeen: { number: -1, timestamp: 0 },
        lastUpdate: { number: -1, timestamp: 0 },
      };
    }
    return {
      ...account.toJSON(),
    };
  };

  private getAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const account = await this.accountRepo.findByAddress(address);
    const actJson = this.convertAccount(account);
    const contract = await this.contractRepo.findByAddress(address);
    if (contract) {
      actJson.type = ContractType[contract.type];
      actJson.tokenName = contract.name;
      actJson.tokenSymbol = contract.symbol;
      actJson.tokenDecimals = contract.decimals;
      actJson.totalSupply = contract.totalSupply.toFixed();
      actJson.holdersCount = contract.holdersCount.toNumber();
      actJson.transfersCount = contract.transfersCount.toNumber();
      actJson.tokensCount = contract.tokensCount?.toNumber();
      actJson.master = contract.master;
      actJson.creationTxHash = contract.creationTxHash;
      actJson.firstSeen = contract.firstSeen;
      actJson.verified = contract.verified;
      actJson.verifiedFrom = contract.verifiedFrom;
      actJson.status = contract.status;
    }

    const txCount = await this.txDigestRepo.countByAddress(address);
    const erc20TokenCount = await this.tokenBalanceRepo.countERC20ByAddress(address);
    const nftTokenCount = await this.nftRepo.countByOwner(address);
    const erc20TxCount = await this.movementRepo.countERC20TxsByAddress(address);
    const nftTxCount = await this.movementRepo.countNFTTxsByAddress(address);
    const bidCount = await this.bidRepo.countByAddress(address);
    const proposedCount = await this.blockRepo.countByBeneficiary(address);
    const bucketCount = await this.bucketRepo.countByAddress(address);
    const internalTxCount = await this.internalTxRepo.countByAddress(address);
    const eventsCount = await this.logEventRepo.countByAddress(address);

    return res.json({
      account: {
        address,
        ...actJson,
        txCount,
        erc20TokenCount,
        nftTokenCount,
        erc20TxCount,
        nftTxCount,
        bidCount,
        proposedCount,
        bucketCount,
        internalTxCount,
        eventsCount,
      },
    });
  };

  private getTxsByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    let start = process.hrtime();
    const { page, limit } = extractPageAndLimitQueryParam(req);

    start = process.hrtime();

    start = process.hrtime();
    const paginate = await this.txDigestRepo.paginateByAccount(address, page, limit);

    if (!paginate.result) {
      return res.json({ totalRows: 0, txSummaries: [] });
    }
    const methods = await this.abiFragmentRepo.findAllFunctions();
    let methodMap = {};
    methods.forEach((m) => {
      methodMap[m.signature] = m.name;
    });
    return res.json({
      totalRows: paginate.count,
      txs: paginate.result.map((tx) => tx.toJSON()).map((tx) => ({ ...tx, method: methodMap[tx.method] || tx.method })),
    });
  };

  private getTxlistByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    let { startblock, endblock, sort } = req.query;

    let start = Number(startblock);
    let end = 0;
    if (endblock === 'latest') {
      end = Infinity;
    } else {
      end = Number(endblock);
    }

    if (isNaN(start)) {
      start = 0;
    }

    if (isNaN(end)) {
      end = Infinity;
    }

    const txs = await this.txRepo.findByAccountInRange(address, start, end, sort.toString());

    if (!txs) {
      return res.json({ totalRows: 0, txSummaries: [] });
    }
    return res.json({
      txSummaries: txs.map((tx) => tx.toSummary()),
    });
  };

  private getBidsByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.bidRepo.paginateByAddress(address, page, limit);
    const bids = paginate.result;

    if (!bids) {
      return res.json({ totalRows: 0, bids: [] });
    }
    return res.json({
      totalRows: paginate.count,
      bids: bids.map((b) => b.toSummary()),
    });
  };

  // FIXME: could be wrong for ERC721/1155 for percentage
  private getTokenHoldersByAccount = async (req: Request, res: Response) => {
    const { tokenAddress } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const contract = await this.contractRepo.findByAddress(tokenAddress);
    if (!contract) {
      return res.json({ holders: [], token: {}, isToken: false });
    }

    let paginate: { count: number; result: any[] } = { count: 0, result: [] };
    if (contract.type === ContractType.ERC20) {
      paginate = await this.tokenBalanceRepo.paginateByTokenAddress(tokenAddress, page, limit);
    } else if (contract.type === ContractType.ERC1155 || contract.type === ContractType.ERC721) {
      paginate = await this.nftRepo.paginateByAddressGroupByHolder(tokenAddress, page, limit);
    }
    if (paginate.count <= 0) {
      return res.json({ holders: [], totalRows: 0 });
    }

    let contractJson = contract.toJSON();
    delete contractJson.code;
    return res.json({
      token: contractJson,
      holders: paginate.result.map((t) => {
        delete t.__v;
        delete t._id;
        delete t.nftBalances;
        delete t.firstSeen;
        delete t.lastUpdate;
        if (t.tokens) {
          t.tokens = t.tokens.map((nft) => {
            delete nft.type;
            delete nft.json;
            delete nft.createTxHash;
            delete nft.createBlockNum;
            delete nft.createTime;
            return nft;
          });
        }

        return t;
      }),
      totalRows: paginate.count,
    });
  };

  private getTokensByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.tokenBalanceRepo.paginateByAddress(address, page, limit);

    if (paginate.count <= 0) {
      return res.json({ totalRows: 0, tokens: [] });
    }

    return res.json({
      totalRows: paginate.count,
      tokens: paginate.result.map((t) => {
        delete t.__v;
        delete t._id;
        t.tokenType = t.token.type;
        t.tokenName = t.token.name;
        t.tokenSymbol = t.token.symbol;
        t.tokenDecimals = t.token.decimals;
        delete t.token;
        return t;
      }),
    });
  };

  private getERC20TokensByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.tokenBalanceRepo.paginateERC20ByAddress(address, page, limit);

    if (paginate.count <= 0) {
      return res.json({ totalRows: 0, tokens: [] });
    }

    return res.json({
      totalRows: paginate.count,
      tokens: paginate.result.map((t) => {
        delete t.__v;
        delete t._id;
        t.tokenType = t.token.type;
        t.tokenName = t.token.name;
        t.tokenSymbol = t.token.symbol;
        t.tokenDecimals = t.token.decimals;
        delete t.token;
        return t;
      }),
    });
  };

  private getNFTsByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.nftRepo.paginateByOwnerGroupByToken(address, page, limit);

    if (paginate.count <= 0) {
      return res.json({ totalRows: 0, tokens: [] });
    }

    return res.json({
      totalRows: paginate.count,
      nfts: paginate.result.map((r) => {
        r.tokenName = r.contract.name;
        r.tokenSymbol = r.contract.symbol;
        delete r._id;
        delete r.contract;
        return r;
      }),
    });
  };

  private getNFTTokensByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.tokenBalanceRepo.paginateNFTByAddress(address, page, limit);

    if (paginate.count <= 0) {
      return res.json({ totalRows: 0, tokens: [] });
    }

    return res.json({
      totalRows: paginate.count,
      tokens: paginate.result.map((t) => {
        delete t.__v;
        delete t._id;
        t.tokenType = t.token.type;
        t.tokenName = t.token.name;
        t.tokenSymbol = t.token.symbol;
        t.tokenDecimals = t.token.decimals;
        delete t.token;
        return t;
      }),
    });
  };

  private getTransfersByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const contract = await this.contractRepo.findByAddress(address);

    if (contract) {
      const paginate = await this.movementRepo.paginateByTokenAddress(address, page, limit);
      return res.json({
        totalRows: paginate.count,
        contract: contract.toJSON(),
        transfers: paginate.result.map((t) => t.toJSON()),
      });
    }
    return res.json({
      totalRows: 0,
      contract: {},
      transfers: [],
    });
  };

  // TODO: API changed, will affect UI
  private getERC20TxsByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.movementRepo.paginateERC20TxsByAccount(address, page, limit);

    let txMap = {};
    paginate.result.map((m) => {
      txMap[m.txHash] = true;
    });

    let feeMap = {};
    const txs = await this.txRepo.findByHashs(Object.keys(txMap));
    txs.map((tx) => {
      feeMap[tx.hash] = tx.paid.toFixed(0);
    });

    return res.json({
      totalRows: paginate.count,
      txs: paginate.result.map((m) => {
        delete m.__v;
        delete m._id;
        m.name = m.contract.name;
        m.symbol = m.contract.symbol;
        m.decimals = m.contract.decimals;
        m.contractType = m.contract.type;
        m.fee = feeMap[m.txHash];
        delete m.contract;
        return m;
      }),
    });
  };

  private getERC721TxsByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.movementRepo.paginateERC721TxsByAccount(address, page, limit);

    return res.json({
      totalRows: paginate.count,
      txs: paginate.result.map((m) => {
        delete m.__v;
        delete m._id;
        m.name = m.contract.name;
        m.symbol = m.contract.symbol;
        m.decimals = m.contract.decimals;
        m.contractType = m.contract.type;
        delete m.contract;
        return m;
      }),
    });
  };

  private getERC1155TxsByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.movementRepo.paginateERC1155TxsByAccount(address, page, limit);

    return res.json({
      totalRows: paginate.count,
      txs: paginate.result.map((m) => {
        delete m.__v;
        delete m._id;
        m.name = m.contract.name;
        m.symbol = m.contract.symbol;
        m.decimals = m.contract.decimals;
        m.contractType = m.contract.type;
        delete m.contract;
        return m;
      }),
    });
  };

  private getNFTTxsByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.movementRepo.paginateNFTTxsByAccount(address, page, limit);
    let txMap = {};
    paginate.result.map((m) => {
      txMap[m.txHash] = true;
    });

    let feeMap = {};
    const txs = await this.txRepo.findByHashs(Object.keys(txMap));
    txs.map((tx) => {
      feeMap[tx.hash] = tx.paid.toFixed(0);
    });

    return res.json({
      totalRows: paginate.count,
      txs: paginate.result.map((m) => {
        delete m.__v;
        delete m._id;
        m.name = m.contract.name;
        m.symbol = m.contract.symbol;
        m.decimals = m.contract.decimals;
        m.contractType = m.contract.type;
        m.fee = feeMap[m.txHash];
        delete m.contract;
        return m;
      }),
    });
  };

  private getNFTTxsByTokenAddrTokenId = async (req: Request, res: Response) => {
    const { address, id } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);

    const paginate = await this.movementRepo.paginateByTokenAddrTokenId(address, id, page, limit);

    return res.json({
      totalRows: paginate.count,
      txs: paginate.result.map((item) => item.toJSON()),
    });
  };

  private getBucketsByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const bkts = await this.bucketRepo.findByAccount(address, page, limit);
    const count = await this.bucketRepo.countByAccount(address);
    if (!bkts) {
      return res.json({ buckets: [] });
    }
    return res.json({
      totalRows: count,
      buckets: bkts.map((b) => {
        return b.toJSON();
      }),
    });
  };

  private getProposedByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.blockRepo.paginateByBeneficiary(address, page, limit);

    return res.json({
      totalRows: paginate.count,
      proposed: paginate.result.map((b) => b.toSummary()),
    });
  };

  private getDelegatorsByAccount = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const bkts = await this.bucketRepo.findByAccount(address, page, limit);
    if (!bkts) {
      return res.json({ delegators: [] });
    }
    let dMap: { [key: string]: BigNumber } = {};
    for (const b of bkts) {
      const owner = b.owner.toLowerCase();
      if (owner in dMap) {
        dMap[owner] = b.totalVotes.plus(dMap[owner]);
      } else {
        dMap[owner] = b.totalVotes;
      }
    }
    const delegators = Object.entries(dMap)
      .sort((a, b) => {
        return a[1].isGreaterThan(b[1]) ? 1 : -1;
      })
      .map((item) => {
        return { address: item[0], amount: item[1].toFixed() };
      });

    if (delegators.length >= (page - 1) * limit) {
      return res.json({
        totalRows: delegators.length,
        delegators: delegators.slice((page - 1) * limit, page * limit),
      });
    } else {
      return res.json({ delegators: [] });
    }
  };

  private getInternalTxs = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.internalTxRepo.paginateByAddress(address, page, limit);
    if (!paginate) {
      return res.json({ totalRows: 0, rows: [] });
    }

    const methods = await this.abiFragmentRepo.findAllFunctions();
    let methodMap = {};
    methods.forEach((m) => {
      methodMap[m.signature] = m.name;
    });

    return res.json({
      totalRows: paginate.count,
      rows: paginate.result.map((r) => {
        const method = methodMap[r.signature];
        return { ...r.toJSON(), method: method || r.signature || '' };
      }),
    });
  };

  private getEvents = async (req: Request, res: Response) => {
    const { address } = req.params;
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.logEventRepo.paginateByAddress(address, page, limit);
    if (!paginate) {
      return res.json({ totalRows: 0, rows: [] });
    }

    let topic0s = {};
    paginate.result.map((r) => {
      if (r.topics && r.topics.length > 0) {
        topic0s[r.topics[0]] = true;
      }
    });

    // build known map
    let fragments = [];
    if (Object.keys(topic0s).length > 0) {
      fragments = await this.abiFragmentRepo.findBySignatureList(...Object.keys(topic0s));
    }

    let evtMap = {};
    for (const frag of fragments) {
      try {
        const sig = frag.signature;
        if (sig in evtMap) {
          evtMap[sig].push(frag.abi);
        } else {
          evtMap[sig] = [frag.abi];
        }
      } catch (e) {
        console.log('ignore error:', e);
        continue;
      }
    }

    // list all known abis
    const methods = await this.abiFragmentRepo.findAllFunctions();
    let methodMap = {};
    methods.forEach((m) => {
      methodMap[m.signature] = m.name;
    });

    // list realted txhash
    let txHashs = paginate.result.map((r) => r.txHash);
    txHashs = txHashs.filter((elem, pos) => {
      return txHashs.indexOf(elem) == pos;
    });

    // query related clauses
    const txs = await this.txRepo.findByHashs(txHashs);
    let sigMap = {};
    txs.map((tx) => {
      tx.clauses.map((c, index) => {
        const key = `${tx.hash}_${index}`;
        sigMap[key] = c.data.slice(0, 10);
      });
    });

    return res.json({
      totalRows: paginate.count,
      rows: paginate.result.map((e) => {
        delete e.__v;
        delete e._id;
        const key = `${e.txHash}_${e.clauseIndex}`;
        const sig = sigMap[key];
        const method = methodMap[sig];

        let datas = [];
        if (e.data && e.data != '0x') {
          let temp = e.data.substring(2);
          while (temp.length >= 64) {
            datas.push('0x' + temp.substring(0, 64));
            temp = temp.substring(64);
          }
          if (temp.length > 0) {
            datas.push('0x' + temp);
          }
        }
        let selectedAbi = [];
        if (e.topics && e.topics.length > 0 && e.topics[0] in evtMap) {
          selectedAbi = evtMap[e.topics[0]];
        }
        let result = {
          ...e,
          datas,
          method: method || sig || '',
          name: undefined,
          abi: undefined,
          decoded: undefined,
        };
        if (selectedAbi.length > 0) {
          for (const abi of selectedAbi) {
            try {
              const iface = new Interface([abi]);
              const decodeRes = iface.parseLog(e);

              result.name = decodeRes.name;
              result.abi = decodeRes.eventFragment.format(FormatTypes.full);
              const abiJson = JSON.parse(decodeRes.eventFragment.format(FormatTypes.json));
              let decoded = {};
              for (const input of abiJson.inputs) {
                const val = decodeRes.args[input.name];
                if (EBN.isBigNumber(val)) {
                  decoded[input.name] = val.toString();
                } else {
                  decoded[input.name] = val;
                }
              }
              if (result.abi) {
                result.decoded = decoded;
              }
              break;
            } catch (e) {
              console.log('Error happened during event decoding: ', e);
            }
          }
        }
        return result;
      }),
    });
  };
}
export default AccountController;

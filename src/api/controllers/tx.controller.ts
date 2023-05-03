import { BigNumber } from 'bignumber.js';
import { Token } from '../const';
import { PosEvent, TxDigest } from '../../model';
import { TxDigestRepo, ContractRepo, TxRepo, ABIFragmentRepo, NFTRepo } from '../../repo';
import { Request, Response, Router } from 'express';
import { try$ } from 'express-toolbox';
import { Network } from '../../const';
import { extractPageAndLimitQueryParam } from '../utils/utils';
import { ERC1155, ERC20, ERC721, ScriptEngine } from '@meterio/devkit';
import { FormatTypes, Interface } from 'ethers/lib/utils';
import { BigNumber as EBN } from 'ethers';

// contract created signature
const CONTRACT_CREATED_SIGNATURE = '0xb35bf4274d4295009f1ec66ed3f579db287889444366c03d3a695539372e8951';
import { BaseController } from './baseController';
class TxController extends BaseController {
  public path = '/api/txs';
  public router = Router();
  private txRepo = new TxRepo();
  private txDigestRepo = new TxDigestRepo();
  private contractRepo = new ContractRepo();
  private abiFragmentRepo = new ABIFragmentRepo();
  private nftRepo = new NFTRepo();

  constructor(network: Network, standby: boolean) {
    super(network, standby);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/recent`, this.getRecent);
    this.router.get(`${this.path}/:hash`, try$(this.getTxByHash));
    this.router.get(`${this.path}/:hash/clauses`, try$(this.getClauses));
    this.router.get(`${this.path}/:hash/transfers`, try$(this.getTransfers));
    this.router.get(`${this.path}/:hash/events`, try$(this.getEvents));
    this.router.get(`${this.path}/:hash/internaltxs`, try$(this.getInternalTxs));
  }

  private getRecent = async (req: Request, res: Response) => {
    const { page, limit } = extractPageAndLimitQueryParam(req);
    const paginate = await this.txRepo.paginateAll(page, limit);
    const txHashs = paginate.result.map((tx) => tx.hash);
    const txDigests = await this.txDigestRepo.findByTxHashList(...txHashs);
    let digestMap: { [key: string]: TxDigest } = {};
    txDigests.forEach((d) => {
      if (d.txHash in digestMap) {
        const digest = digestMap[d.txHash];
        const total = new BigNumber(d.mtr).plus(d.mtrg);
        const curTotal = new BigNumber(digest.mtr).plus(digest.mtrg);
        if (curTotal.isGreaterThan(total)) {
          digestMap[d.txHash] = d.toJSON() as TxDigest;
        }
      } else {
        digestMap[d.txHash] = d.toJSON() as TxDigest;
      }
    });
    const methods = await this.abiFragmentRepo.findAllFunctions();
    let methodMap = {};
    methods.forEach((m) => (methodMap[m.signature] = m.name));

    const addresses = [];
    for (const tx of Object.values(digestMap)) {
      addresses.push(tx.from, tx.to);
    }

    const contracts = await this.contractRepo.findByAddressList(addresses);
    const existAddrs = contracts.map((c) => c.address);

    return res.json({
      totalRows: paginate.count,
      txs: Object.values(digestMap)
        .map((tx) => ({
          ...tx,
          method: methodMap[tx.method] || tx.method,
          fromIsContract: existAddrs.includes(tx.from),
          toIsContract: existAddrs.includes(tx.to),
        }))
        .sort((a, b) => (a.block.number > b.block.number ? -1 : 1)),
    });
  };

  private getTxByHash = async (req: Request, res: Response) => {
    const { hash } = req.params;
    let tx = await this.txRepo.findByHash(hash);
    if (!tx) {
      return res.json({ tx: {} });
    }
    let txObj = tx.toJSON();

    let transfers = [];
    let events = [];

    for (const [clauseIndex, o] of txObj.outputs.entries()) {
      for (const [logIndex, e] of o.events.entries()) {
        events = events.concat({ ...e, clauseIndex, logIndex });
      }
      for (const [logIndex, t] of o.transfers.entries()) {
        transfers = transfers.concat({ ...t, clauseIndex, logIndex });
      }
    }

    let tokenTransfers = [];
    let contractAddress = [];
    for (const e of events) {
      if (
        !e.topics ||
        ![
          ERC20.Transfer.signature,
          ERC721.Transfer.signature,
          ERC1155.TransferSingle.signature,
          ERC1155.TransferBatch.signature,
          CONTRACT_CREATED_SIGNATURE,
        ].includes(e.topics[0])
      ) {
        continue;
      }

      if (e.topics && e.topics[0] === CONTRACT_CREATED_SIGNATURE) {
        contractAddress.push(e.address);
      }

      let contract = await this.contractRepo.findByAddress(e.address);
      if (e.topics && e.topics[0] === ERC20.Transfer.signature) {
        // Get ERC20 Transfer
        try {
          const decoded = ERC20.Transfer.decode(e.data, e.topics);
          tokenTransfers.push({
            tokenAddress: e.address,
            from: decoded.from.toLowerCase(),
            to: decoded.to.toLowerCase(),
            amount: decoded.value.toString(),
            type: 'ERC20',
            symbol: contract ? contract.symbol : 'ERC20',
            decimals: contract ? contract.decimals : 18,
          });
        } catch (e) {
          console.log(`ignore error: `, e);
        }
      }

      // Get ERC721 Transfer
      if (e.topics && e.topics[0] === ERC721.Transfer.signature) {
        try {
          const decoded = ERC721.Transfer.decode(e.data, e.topics);
          const nft = await this.nftRepo.findByTokenId(e.address, decoded.tokenId.toString());
          tokenTransfers.push({
            tokenAddress: e.address,
            from: decoded.from.toLowerCase(),
            to: decoded.to.toLowerCase(),
            ids: [decoded.tokenId.toString()],
            values: [1], // there's no `value` in ERC721 transfer event
            mediaUrls: [!!nft && nft.length > 0 ? nft[0].mediaURI : ''],
            type: 'ERC721',
            symbol: contract ? contract.symbol : 'ERC721',
          });
        } catch (e) {
          console.log(`ignore error: `, e);
        }
      }

      // Get ERC1155 TransferSingle
      if (e.topics && e.topics[0] === ERC1155.TransferSingle.signature) {
        try {
          const decoded = ERC1155.TransferSingle.decode(e.data, e.topics);
          const nft = await this.nftRepo.findByTokenId(e.address, decoded.tokenId.toString());
          tokenTransfers.push({
            tokenAddress: e.address,
            from: decoded.from.toLowerCase(),
            to: decoded.to.toLowerCase(),
            ids: [decoded.id.toString()],
            values: [decoded.value.toString()],
            mediaUrls: [!!nft && nft.length > 0 ? nft[0].mediaURI : ''],
            type: 'ERC1155',
            symbol: contract ? contract.symbol : 'ERC1155',
          });
        } catch (e) {
          console.log(`ignore error: `, e);
        }
      }

      // Get ERC1155 TransferBatch
      if (e.topics && e.topics[0] === ERC1155.TransferBatch.signature) {
        try {
          const decoded = ERC1155.TransferBatch.decode(e.data, e.topics);
          const nfts = await this.nftRepo.findByTokenId(e.address, decoded.ids);
          let nftMap = {};
          nfts.map((n) => {
            nftMap[n.tokenId] = n.mediaURI;
          });
          tokenTransfers.push({
            tokenAddress: e.address,
            from: decoded.from.toLowerCase(),
            to: decoded.to.toLowerCase(),
            ids: decoded.ids.map((id) => id.toString()),
            values: decoded.values.map((v) => v.toString()),
            mediaUrls: decoded.ids.map((id) => {
              nftMap[id] || '';
            }),
            type: 'ERC1155',
            symbol: contract ? contract.symbol : 'ERC1155',
          });
        } catch (e) {
          console.log(`ignore error: `, e);
        }
      }
    }

    let internaltxsCount = 0;
    let selfDestructed = {};
    if (tx.traces) {
      for (const t of tx.traces) {
        const trace = JSON.parse(t.json);
        let q = [trace];
        while (q.length > 0) {
          const node = q.shift();
          internaltxsCount++;
          if (node.type === 'SELFDESTRUCT') {
            selfDestructed[node.from] = true;
          }
          if (node.calls) {
            for (const c of node.calls) {
              q.push(c);
            }
          }
        }
      }
    }
    const fromToAddrs = Array.from(new Set(tokenTransfers.map((t) => t.from).concat(tokenTransfers.map((t) => t.to))));
    if (fromToAddrs.length > 0) {
      const knownContracts = await this.contractRepo.findByAddressList(fromToAddrs);
      const knwonContractMap = {};
      knownContracts.forEach((c) => {
        knwonContractMap[c.address] = c;
      });
      for (let t of tokenTransfers) {
        if (t.from in knwonContractMap) {
          t.fromName = knwonContractMap[t.from].name;
        } else {
          t.fromName = '';
        }
        if (t.to in knwonContractMap) {
          t.toName = knwonContractMap[t.to].name;
        } else {
          t.toName = '';
        }
      }
    }

    const summary = {
      ...txObj,
      // events,
      // transfers,
      selfDestructed: Object.keys(selfDestructed),
      clauseCount: tx.clauses.length,
      transferCount: transfers.length,
      eventCount: events.length,
      internaltxsCount: internaltxsCount,
      tokenTransfers,
      contractAddress,
    };

    delete summary.traces;
    delete summary.outputs;

    return res.json({
      tx: summary,
    });
  };

  private getEvents = async (req: Request, res: Response) => {
    try {
      const { hash } = req.params;
      let tx = await this.txRepo.findByHash(hash);
      if (!tx) {
        return res.json({ hash, events: [] });
      }

      let events: PosEvent[] = [];
      let topic0s = [];
      for (const o of tx.outputs) {
        for (const e of o.events) {
          events.push(e);
          if (e.topics && e.topics.length > 0) {
            topic0s.push(e.topics[0]);
          }
        }
      }

      // query known abis map
      let fragments = [];
      if (topic0s.length > 0) {
        fragments = await this.abiFragmentRepo.findBySignatureList(...topic0s);
      }

      // group abi by signature
      let abiMap = {};
      for (const frag of fragments) {
        try {
          const sig = frag.signature;
          if (sig in abiMap) {
            abiMap[sig].push(frag.abi);
          } else {
            abiMap[sig] = [frag.abi];
          }
        } catch (e) {
          console.log('ignore error:', e);
          continue;
        }
      }

      return res.json({
        hash,
        events: events.map((e) => {
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
          let result = {
            block: tx.block,
            txHash: tx.hash,
            topics: e.topics,
            data: e.data,
            datas,
            address: e.address,
            overallIndex: e.overallIndex,
            name: undefined,
            abi: undefined,
            decoded: undefined,
          };
          let selectedAbi = [];
          if (e.topics && e.topics.length > 0 && e.topics[0] in abiMap) {
            selectedAbi = abiMap[e.topics[0]];
          }

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
    } catch (e) {
      console.log(e);
    }
  };

  private getTransfers = async (req: Request, res: Response) => {
    const { hash } = req.params;
    let tx = await this.txRepo.findByHash(hash);
    if (!tx) {
      return res.json({ hash, clauses: [] });
    }

    let transfers = [];
    for (const o of tx.outputs) {
      transfers = transfers.concat(
        o.transfers.map((t) => {
          return {
            sender: t.sender,
            recipient: t.recipient,
            amount: t.amount,
            token: Token[t.token],
            overallIndex: t.overallIndex,
          };
        })
      );
    }
    return res.json({ hash, transfers });
  };

  private getInternalTxs = async (req: Request, res: Response) => {
    const { hash } = req.params;
    let tx = await this.txRepo.findByHash(hash);
    if (!tx) {
      return res.json({ hash, internalTxs: [] });
    }

    const internalTxs = [];
    if (tx.traces) {
      for (const t of tx.traces) {
        const trace = JSON.parse(t.json);
        let q = [[trace, '0']];
        while (q) {
          const item = q.shift();
          if (!item) {
            break;
          }

          const node = item[0];
          const suffix = item[1];

          const name = node.type.toLowerCase() + '_' + suffix;
          internalTxs.push({
            name,
            from: node.from,
            to: node.to,
            value: node.value ? new BigNumber(node.value).toString() : 0,
            gasUsed: node.gasUsed ? new BigNumber(node.gasUsed).toNumber() : 0,
            gasLimit: node.gas ? new BigNumber(node.gas).toNumber() : 0,
            clauseIndex: t.clauseIndex,
          });
          if (node.calls) {
            for (const [index, c] of node.calls.entries()) {
              let childSuffix = suffix + '_' + index;
              q.push([c, childSuffix]);
            }
          }
        }
      }
    }

    return res.json({ hash, internalTxs });
  };

  private getClauses = async (req: Request, res: Response) => {
    const { hash } = req.params;
    let tx = await this.txRepo.findByHash(hash);
    if (!tx) {
      return res.json({ hash, clauses: [] });
    }

    let selectors = [];
    let clauses = tx.clauses.map((c) => {
      let selector = '';
      let methodId = '';
      let decoded = undefined;
      let datas = [];
      let tail = '';
      if (c.data && c.data.length >= 10) {
        methodId = c.data.substring(0, 10);
        const isSE = ScriptEngine.IsScriptEngineData(c.data);
        if (isSE) {
          decoded = ScriptEngine.decodeScriptData(c.data);
          methodId = c.data.substring(0, 18) + ` MeterEngine:${decoded.action}`;
          selector = `MeterEngine:${decoded.action}`;
          tail = c.data.substring(18);
        } else {
          selector = c.data.substring(0, 10);
          tail = c.data.substring(10);
        }
      } else {
        selector = 'Transfer';
      }
      if (selector && selector != '0x00000000') {
        selectors.push(selector);
      }
      while (tail.length >= 64) {
        datas.push(tail.substring(0, 64));
        tail = tail.substring(64);
      }
      if (tail.length > 0) {
        datas.push(tail);
      }
      return {
        to: c.to,
        value: c.value,
        data: c.data,
        token: Token[c.token],
        selector,
        decoded,
        datas,
        methodId,
      };
    });

    const fragments = await this.abiFragmentRepo.findBySignatureList(...selectors);
    const abis = fragments.map((f) => f.abi);
    const iface = new Interface(abis);

    return res.json({
      hash,
      clauses: clauses.map((c) => {
        let result = {
          block: tx.block,
          txHash: tx.hash,
          ...c,
          abi: '',
        };
        if (!c.decoded) {
          try {
            const decodeRes = iface.parseTransaction({
              data: c.data,
              value: c.value.toFixed(),
            });
            result.selector = decodeRes.name;
            result.abi = decodeRes.functionFragment.format(FormatTypes.full);
            const abiJson = JSON.parse(decodeRes.functionFragment.format(FormatTypes.json));
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
          } catch (e) {
            console.log('Error happened during decoding: ', e);
          }
        }
        return result;
      }),
    });
  };
}

export default TxController;

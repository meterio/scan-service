import '@meterio/flex';
import { Network, Token } from '../const';
import LRU from 'lru-cache';
import { ERC165, ERC721, ERC1155, ERC721Metadata, ERC20 } from '@meterio/devkit';

import { GetNetworkConfig } from '../const';
import { Net } from './net';
import { blockIDtoNum, isBytes32 } from './utils';
export const PROBE_TIMEOUT = 5000;

export namespace Pos {
  export type ExpandedBlock = Omit<Required<Flex.Meter.Block>, 'transactions'> & {
    transactions: Array<Omit<Flex.Meter.Transaction, 'meta'> & Omit<Flex.Meter.Receipt, 'meta'>>;
  };
  export type Block<T extends 'expanded' | 'regular'> = T extends 'expanded'
    ? ExpandedBlock
    : Required<Flex.Meter.Block>;
  export interface CallTracerOutput {
    type: string;
    from: string;
    to: string;
    value: string;
    gas?: string;
    gasUsed?: string;
    output?: string;
    input?: string;
    error?: string;
    calls?: CallTracerOutput[];
  }
  export type Transaction = Flex.Meter.Transaction;
  export type Receipt = Flex.Meter.Receipt;
  export type Account = Flex.Meter.Account;
  export type Code = Flex.Meter.Code;
  export type Storage = Flex.Meter.Storage;
  export type Event = Flex.Meter.Event & { overallIndex?: number };
  export type Transfer = Flex.Meter.Transfer & { overallIndex?: number };
  export type VMOutput = Flex.Meter.VMOutput;

  export type Candidate = {
    name: string;
    description: string;
    address: string;
    pubKey: string;
    ipAddr: string;
    port: number;
    totalVotes: string;
    commission: number;
    buckets: string[];
  };

  export type Stakeholder = {
    holder: string;
    totalStake: string;
    buckets: string[];
  };

  export type Distributor = {
    address: string;
    autobid: number;
    shares: number;
  };

  export type Delegate = {
    name: string;
    address: string;
    pubKey: string;
    votingPower: string;
    ipAddr: string;
    port: number;
    commission: number;
    distributors: Distributor[];
  };

  export type Bucket = {
    id: string;
    owner: string;
    value: string;
    token: number;
    nonce: number;
    autobid: number;
    createTime: number;
    unbounded: boolean;
    candidate: string;
    rate: number;
    option: number;
    bonusVotes: number;
    totalVotes: string;
    matureTime: number;
    calcLastTime: number;
  };

  export type Jailed = {
    address: string;
    name: string;
    pubKey: string;
    totalPoints: number;
    bailAmount: string;
    jailedTime: number;
  };

  // missing leader infraction
  export type MissingLeaderInfo = {
    epoch: number;
    round: number;
  };
  export type MissingLeader = {
    counter: string;
    info: MissingLeaderInfo[];
  };

  // missing proposer infraction
  export type MissingProposerInfo = {
    epoch: number;
    height: number;
  };
  export type MissingProposer = {
    counter: string;
    info: MissingProposerInfo[];
  };

  // missing voter infraction
  export type MissingVoterInfo = {
    epoch: number;
    height: number;
  };
  export type MissingVoter = {
    counter: string;
    info: MissingVoterInfo[];
  };

  // double signer infraction
  export type DoubleSignerInfo = {
    epoch: number;
    round: number;
    height: number;
  };
  export type DoubleSigner = {
    counter: string;
    info: DoubleSignerInfo[];
  };

  export type Infraction = {
    missingLeader?: MissingLeader;
    missingProposer?: MissingProposer;
    missingVoter?: MissingVoter;
    doubleSigner?: DoubleSigner;
  };

  export type ValidatorStat = {
    address: string;
    name: string;
    pubKey: string;
    totalPoints: number;
    infractions: Infraction[];
  };

  export type DistMtrg = {
    addr: string;
    amount: string;
  };

  export type RewardInfo = {
    address: string;
    amount: string;
  };

  export type ValidatorReward = {
    epoch: number;
    baseReward: string;
    totalReward: string;
    rewards: RewardInfo[];
  };

  export type AuctionSummary = {
    auctionID: string;
    startHeight: number;
    startEpoch: number;
    endHeight: number;
    endEpoch: number;
    sequence: number;
    releasedMTRG: string;
    reservedMTRG: string;
    reservedPrice: string;
    createTime: number;
    receivedMTR: string;
    actualPrice: string;
    leftoverMTRG: string;
    auctionTxs: AuctionTx[];
    distMTRG: DistMtrg[];
  };

  export type AuctionTx = {
    txid: string;
    address: string;
    amount: string;
    type: string;
    timestamp: number;
    nonce: number;
  };

  export type Auction = {
    auctionID: string;
    startHeight: number;
    startEpoch: number;
    endHeight: number;
    endEpoch: number;
    sequence: number;
    releasedMTRG: string;
    reservedMTRG: string;
    reservedPrice: string;
    createTime: number;
    timestamp: string;
    receivedMTR: string;
    auctionTxs: AuctionTx[];
  };

  export type AccountBalance = {
    balance: string;
    energy: string;
    boundbalance: string;
    boundenergy: string;
  };

  export type EpochInfo = {
    epochID: number;
    powBlocks: Flex.Meter.PowBlock[];
    nonce: number;
  };

  export type ProbeQC = {
    qcHeight: number;
    qcRound: number;
    epochID: number;
  };
  export type ProbeBlock = {
    number: number;
    id: string;
    parentID: string;
    blockType: string;
    qc: ProbeQC;
    timestamp: number;
    txCount: number;
    lastKBlockHeight: number;
    hasCommitteeInfo: Boolean;
    nonce: number;
  };
  export type ChainProbe = {
    bestBlock: ProbeBlock;
    bestQC: ProbeQC;
    bestQCCandidate: ProbeQC;
  };
  export type QCProbe = {
    Height: number;
    Round: number;
    EpochID: number;
  };
  export type BlockProbe = {
    Height: number;
    Round: number;
    Type: string;
  };
  export type PacemakerProbe = {
    Mode: string;
    StartHeight: number;
    StartRound: number;
    CurRound: number;
    MyCommitteeIndex: number;

    LastVotingHeight: number;
    ProposalCount: number;
    PendingCount: number;
    PendingLowest: number;

    QCHigh: ProbeQC;
    BlockExecuted: BlockProbe;
    BlockLocked: BlockProbe;
    BlockLeaf: BlockProbe;
  };

  export type PowProbe = {
    Status: string;
    LatestHeight: number;
    KFrameHeight: number;
    PoolSize: number;
  };

  export type ProbeInfo = {
    name: string;
    pubkey: string;
    pubkeyValid: Boolean;
    version: string;
    chain: ChainProbe;
    pacemaker: PacemakerProbe;
    pow: PowProbe;
    bestQC: ProbeQC;
    qcHigh: ProbeQC;
    bestQCCandidate: ProbeQC;
    isCommitteeMember: Boolean;
    isPacemakerRunning: Boolean;
  };
}

export class Pos {
  private cache: LRU<string, any>;
  private net: Net;
  private get headerValidator() {
    return (headers: Record<string, string>) => {
      // const xGeneID = headers['x-genesis-id'];
      // if (xGeneID && xGeneID !== this.genesisID) {
      //   throw new Error(`responded 'x-genesis-id' not match`);
      // }
    };
  }

  // default genesis ID to mainnet
  constructor(readonly network = Network.MainNet) {
    const posConfig = GetNetworkConfig(network);
    console.log(posConfig.posUrl);
    this.net = new Net(posConfig.posUrl);
    this.cache = new LRU<string, any>({ max: 1024 * 4 });
  }

  public async getBalanceOnRevision(revision: string | number, address: string) {
    return this.httpGet<Pos.AccountBalance>(`accounts/${address}?revision=${revision}`);
  }

  public async getBlock<T extends 'expanded' | 'regular'>(
    revision: string | number,
    type: T
  ): Promise<Pos.Block<T> | null> {
    const expanded = type === 'expanded';
    const cacheOrLoad = async (func: () => Promise<Pos.Block<T> | null>) => {
      if (revision === 'best') {
        return func();
      }

      const { key, IDKey } = ((): { key: string; IDKey: string } => {
        if (typeof revision === 'string' && isBytes32(revision)) {
          return {
            key: (expanded ? 'b-e' : 'b-r') + blockIDtoNum(revision).toString(),
            IDKey: (expanded ? 'b-e' : 'b-r') + revision,
          };
        } else if (typeof revision === 'number') {
          return {
            key: (expanded ? 'b-e' : 'b-r') + revision.toString(),
            IDKey: '',
          };
        } else {
          throw new Error('invalid block revision');
        }
      })();

      if (this.cache.has(key!)) {
        return this.cache.get(key!) as Pos.Block<T>;
      } else if (!!IDKey && this.cache.has(IDKey)) {
        return this.cache.get(IDKey!) as Pos.Block<T>;
      }

      const b = await func();
      // cache blocks 10 minutes earlier than now
      if (b) {
        if (expanded) {
          const regular = {
            ...b,
            transactions: (b as Pos.ExpandedBlock).transactions.map((x) => x.id),
          };
          this.cache.set('b-r' + b.number, regular);
          this.cache.set('b-r' + b.id, regular);

          this.cache.set('b-e' + b.number, b);
          this.cache.set('b-e' + b.id, b);
        } else {
          this.cache.set('b-r' + b.number, b);
          this.cache.set('b-r' + b.id, b);
        }
      }
      return b;
    };

    return cacheOrLoad(() => {
      return this.httpGet<Pos.Block<T> | null>(`blocks/${revision}`, {
        expanded,
      });
    });
  }

  public async getTransaction(id: string, head?: string) {
    return this.httpGet<Pos.Transaction>(`transactions/${id}`, head ? { head } : {});
  }
  // Staking related
  public async getReceipt(id: string, head?: string) {
    return this.httpGet<Pos.Receipt>(`transactions/${id}/receipt`, head ? { head } : {});
  }
  public async getCandidates() {
    return this.httpGet<Pos.Candidate[]>(`staking/candidates`);
  }

  public async getCandidatesOnRevision(revsion: string | number) {
    return this.httpGet<Pos.Candidate[]>(`staking/candidates?revision=${revsion}`);
  }

  public async getStakeholders() {
    return this.httpGet<Pos.Stakeholder[]>(`staking/stakeholders`);
  }
  public async getDelegates() {
    return this.httpGet<Pos.Delegate[]>(`staking/delegates`);
  }
  public async getBuckets() {
    return this.httpGet<Pos.Bucket[]>(`staking/buckets`);
  }
  public async getValidatorRewards() {
    return this.httpGet<Pos.ValidatorReward[]>(`staking/validator-rewards`);
  }
  public async getLastValidatorReward(revision: string | number) {
    return this.httpGet<Pos.ValidatorReward>(`staking/last/rewards?revision=${revision}`);
  }
  // Slashing related
  public async getValidatorStats() {
    return this.httpGet<Pos.ValidatorStat[]>(`slashing/statistics`);
  }
  public async getJailed() {
    return this.httpGet<Pos.Jailed[]>(`slashing/injail`);
  }

  // Epoch related
  public async getEpochInfo(epoch: number) {
    return this.httpGet<any>(`blocks/epoch/${epoch}`);
  }

  // Auction related
  public async getAuctionSummaries() {
    return this.httpGet<Pos.AuctionSummary[]>(`auction/summaries`);
  }
  public async getLastAuctionSummary(revision: number | string) {
    return this.httpGet<Pos.AuctionSummary>(`auction/last/summary?revision=${revision}`);
  }
  public async getPresentAuction(revision?: number) {
    if (revision) {
      return this.httpGet<Pos.Auction>(`auction/present?revision=${revision}`);
    }
    return this.httpGet<Pos.Auction>(`auction/present`);
  }

  public async getPresentAuctionByRevision(revision: number) {
    return this.httpGet<Pos.Auction>(`auction/present?revision=${revision}`);
  }

  public async getAccount(addr: string, revision?: string) {
    const get = () => {
      return this.httpGet<Pos.Account>(`accounts/${addr}`, revision ? { revision } : {});
    };
    if (revision && isBytes32(revision)) {
      const key = 'a' + revision + addr;
      if (this.cache.has(key)) {
        return this.cache.get(key) as Pos.Account;
      }

      const acc = await get();
      this.cache.set(key, acc);
      return acc;
    }

    return get();
  }
  public async getCode(addr: string, revision?: string) {
    return this.httpGet<Pos.Code>(`accounts/${addr}/code`, revision ? { revision } : {});
  }

  public async getStorage(addr: string, key: string, revision?: string) {
    return this.httpGet<Pos.Storage>(`accounts/${addr}/storage/${key}`, revision ? { revision } : {});
  }
  public async getCurCoef() {
    return this.httpGet<String>(`node/coef`);
  }

  public async filterEventLogs(arg: Flex.Driver.FilterEventLogsArg) {
    return this.httpPost<Pos.Event[]>('logs/event', arg);
  }

  public async explain(arg: Flex.Driver.ExplainArg, revision: string) {
    return this.httpPost<Pos.VMOutput[]>('accounts/*', arg, { revision });
  }

  public async httpPost<T>(path: string, body: object, query?: Record<string, string>): Promise<T> {
    return this.net.http('POST', path, {
      query,
      body,
      validateResponseHeader: this.headerValidator,
    });
  }

  protected async httpGet<T>(path: string, query?: Record<string, any>): Promise<T> {
    return this.net.http('GET', path, {
      query,
      validateResponseHeader: this.headerValidator,
    });
  }

  // public async traceClause(blockID: string, txHash: string, clauseIndex = 0) {
  //   const blockIDHex = blockID.replace('0x', '');
  //   const txHashHex = txHash.replace('0x', '');
  //   const data = {
  //     name: 'call',
  //     target: `${blockIDHex}/${txHashHex}/${clauseIndex}`,
  //   };
  //   const result = await this.httpPost<Pos.CallTracerOutput>('debug/tracers', data);
  //   return result;
  // }

  public async newTraceClause(txHash: string, clauseIndex = 0) {
    const result = await this.httpGet<Pos.CallTracerOutput>(`debug/trace/${txHash}/${clauseIndex}`);
    return result;
  }

  public async fetchERC721AndERC1155Data(address, blockHash) {
    try {
      const outputs = await this.explain(
        {
          clauses: [
            {
              to: address,
              value: '0x0',
              data: ERC165.supportsInterface.encode(ERC721.interfaceID),
              token: Token.MTR,
            },
            {
              to: address,
              value: '0x0',
              data: ERC165.supportsInterface.encode(ERC721Metadata.interfaceID),
              token: Token.MTR,
            },
            {
              to: address,
              value: '0x0',
              data: ERC165.supportsInterface.encode(ERC1155.interfaceID),
              token: Token.MTR,
            },
            { to: address, value: '0x0', data: ERC20.name.encode(), token: Token.MTR },
            { to: address, value: '0x0', data: ERC20.symbol.encode(), token: Token.MTR },
          ],
        },
        blockHash
      );

      const valid = (i) => !!outputs[i] && !outputs[i].reverted && outputs[i].data !== '0x';

      const supports721 = valid(0) ? ERC165.supportsInterface.decode(outputs[0].data)['0'] : false;
      const supports721meta = valid(1) ? ERC165.supportsInterface.decode(outputs[1].data)['0'] : false;
      const supports1155 = valid(2) ? ERC165.supportsInterface.decode(outputs[2].data)['0'] : false;

      const name = valid(3) ? ERC20.name.decode(outputs[3].data)['0'] : '';
      const symbol = valid(4) ? ERC20.symbol.decode(outputs[4].data)['0'] : '';
      return {
        supports1155,
        supports721meta,
        supports721,
        name,
        symbol,
      };
    } catch (e) {
      console.log('ERROR happened during fetching ERC721/1155 data:', e);
    }
  }

  public async fetchERC20Data(address: string, blockHash: string) {
    try {
      const outputs = await this.explain(
        {
          clauses: [
            { to: address, value: '0x0', data: ERC20.name.encode(), token: Token.MTR },
            { to: address, value: '0x0', data: ERC20.symbol.encode(), token: Token.MTR },
            { to: address, value: '0x0', data: ERC20.decimals.encode(), token: Token.MTR },
            { to: address, value: '0x0', data: ERC20.totalSupply.encode(), token: Token.MTR },
          ],
        },
        blockHash
      );
      // console.log(outputs);

      const valid = (i) => !!outputs[i] && !outputs[i].reverted && outputs[i].data !== '0x';
      const name = valid(0) ? ERC20.name.decode(outputs[0].data)['0'] : '';
      const symbol = valid(1) ? ERC20.symbol.decode(outputs[1].data)['0'] : '';
      const decimals = valid(2) ? ERC20.decimals.decode(outputs[2].data)['0'] : 0;
      const totalSupply = valid(3) ? ERC20.totalSupply.decode(outputs[3].data)['0'] : 0;
      return { totalSupply, name, symbol, decimals };
    } catch (e) {
      console.log('ERROR happened during fetching ERC20 data:', e);
    }
  }

  public async getERC20BalanceOf(address: string, tokenAddress: string, blockHash: string) {
    try {
      const outputs = await this.explain(
        {
          clauses: [{ to: tokenAddress, value: '0x0', data: ERC20.balanceOf.encode(address), token: Token.MTR }],
        },
        blockHash
      );
      const valid = (i) => !!outputs[i] && !outputs[i].reverted && outputs[i].data !== '0x';
      const bal = valid(0) ? ERC20.balanceOf.decode(outputs[0].data)['0'] : 0;
      return bal.toString();
    } catch (e) {
      console.log('Error happened during fetch ERC20 balanceOf');
    }
  }

  public async getERC1155BalanceOf(address: string, tokenAddress: string, tokenId: string, blockHash: string) {
    try {
      const outputs = await this.explain(
        {
          clauses: [
            { to: tokenAddress, value: '0x0', data: ERC1155.balanceOf.encode(address, tokenId), token: Token.MTR },
          ],
        },
        blockHash
      );
      const valid = (i) => !!outputs[i] && !outputs[i].reverted && outputs[i].data !== '0x';
      const bal = valid(0) ? ERC20.balanceOf.decode(outputs[0].data)['0'] : 0;
      return bal;
    } catch (e) {
      console.log('Error happened during fetch ERC1155 balanceOf', e);
    }
  }

  public async probe(ipAddress: string): Promise<Pos.ProbeInfo> {
    const net = new Net(`http://${ipAddress}:8670`, PROBE_TIMEOUT); // probe with a timeout of 3s
    return net.http('GET', 'probe', {});
  }
}

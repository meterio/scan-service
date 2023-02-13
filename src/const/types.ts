export enum Network {
  MainNet = 0,
  TestNet,
  VerseMain,
  VerseTest,
}

export enum Token {
  MTR = 0,
  MTRG,
  ERC20,
  ERC721,
  ERC1155,
  MTRGV2 = 1000,
}

export enum ContractType {
  Unknown,
  ERC20,
  ERC721,
  ERC1155,
}

export enum DeployStatus {
  New,
  SelfDestructed,
  ReDeployed,
}

export enum BlockType {
  MBlock,
  KBlock,
}

export enum MetricType {
  NUM = 0,
  BIGNUM,
  STRING,
}

export enum ValidatorStatus {
  CANDIDATE = 0,
  DELEGATE,
  JAILED,
}

export const enumKeys = (es: any) => Object.values(es).filter((x) => typeof x === 'string');

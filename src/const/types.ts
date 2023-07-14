export enum Network {
  MainNet = 0,
  TestNet,
  VerseMain,
  VerseTest,
}

export enum Token {
  MTR = 'MTR',
  MTRG = 'MTRG',
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  MTRGV2 = 'MTRGV2',
}

export enum ContractType {
  Unknown = 'Unknown',
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
}

export enum DeployStatus {
  New = 'New',
  SelfDestructed = 'SelfDestructed',
  ReDeployed = 'ReDeployed',
}

export enum BlockType {
  MBlock = 'MBlock',
  KBlock = 'KBlock',
}

export enum MetricType {
  NUM = 'NUM',
  BIGNUM = 'BIGNUM',
  STRING = 'STRING',
}

export enum ValidatorStatus {
  CANDIDATE = 'CANDIDATE',
  DELEGATE = 'DELEGATE',
  JAILED = 'JAILED',
}

export const enumKeys = (es: any) => Object.values(es).filter((x) => typeof x === 'string');

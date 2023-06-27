// tslint:disable:max-line-length
import { abi } from '@meterio/devkit';

const $MasterABI: abi.Event.Definition = {
  anonymous: false,
  inputs: [{ indexed: false, name: 'newMaster', type: 'address' }],
  name: '$Master',
  type: 'event',
};

const methodMasterABI: abi.Function.Definition = {
  constant: true,
  inputs: [{ name: 'self', type: 'address' }],
  name: 'master',
  outputs: [{ name: '', type: 'address' }],
  payable: false,
  stateMutability: 'view',
  type: 'function',
};

const firstABI: abi.Function.Definition = {
  constant: true,
  inputs: [],
  name: 'first',
  outputs: [{ name: '', type: 'address' }],
  payable: false,
  stateMutability: 'view',
  type: 'function',
};
const getABI: abi.Function.Definition = {
  constant: true,
  inputs: [{ name: '_nodeMaster', type: 'address' }],
  name: 'get',
  outputs: [
    { name: 'listed', type: 'bool' },
    { name: 'endorsor', type: 'address' },
    { name: 'identity', type: 'bytes32' },
    { name: 'active', type: 'bool' },
  ],
  payable: false,
  stateMutability: 'view',
  type: 'function',
};
const nextABI: abi.Function.Definition = {
  constant: true,
  inputs: [{ name: '_nodeMaster', type: 'address' }],
  name: 'next',
  outputs: [{ name: '', type: 'address' }],
  payable: false,
  stateMutability: 'view',
  type: 'function',
};
const candidateABI: abi.Event.Definition = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'nodeMaster', type: 'address' },
    { indexed: false, name: 'action', type: 'bytes32' },
  ],
  name: 'Candidate',
  type: 'event',
};
const $SponsorABI: abi.Event.Definition = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'sponsor', type: 'address' },
    { indexed: false, name: 'action', type: 'bytes32' },
  ],
  name: '$Sponsor',
  type: 'event',
};
const currentSponsorABI: abi.Function.Definition = {
  constant: true,
  inputs: [{ name: '_self', type: 'address' }],
  name: 'currentSponsor',
  outputs: [{ name: '', type: 'address' }],
  payable: false,
  stateMutability: 'view',
  type: 'function',
};
const isSponsorABI: abi.Function.Definition = {
  constant: true,
  inputs: [
    { name: '_self', type: 'address' },
    { name: '_sponsor', type: 'address' },
  ],
  name: 'isSponsor',
  outputs: [{ name: '', type: 'bool' }],
  payable: false,
  stateMutability: 'view',
  type: 'function',
};
const paramsGetABI: abi.Function.Definition = {
  constant: true,
  inputs: [{ name: '_key', type: 'bytes32' }],
  name: 'get',
  outputs: [{ name: '', type: 'uint256' }],
  payable: false,
  stateMutability: 'view',
  type: 'function',
};
const BoundABI: abi.Event.Definition = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'owner', type: 'address' },
    { indexed: false, name: 'amount', type: 'uint256' },
    { indexed: false, name: 'token', type: 'uint256' },
  ],
  name: 'Bound',
  type: 'event',
};
const UnboundABI: abi.Event.Definition = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'owner', type: 'address' },
    { indexed: false, name: 'amount', type: 'uint256' },
    { indexed: false, name: 'token', type: 'uint256' },
  ],
  name: 'Unbound',
  type: 'event',
};

export const BoundEvent = new abi.Event(BoundABI);
export const UnboundEvent = new abi.Event(UnboundABI);

// WMTR
export const WMTRDeposit = new abi.Event({
  anonymous: false,
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: false, name: 'amount', type: 'uint256' },
  ],
  name: 'Deposit',
  type: 'event',
});

export const WMTRWithdrawal = new abi.Event({
  anonymous: false,
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: false, name: 'amount', type: 'uint256' },
  ],
  name: 'Withdrawal',
  type: 'event',
});

// ERC 1967 Events
const UpgradedABI: abi.Event.Definition = {
  anonymous: false,
  inputs: [{ indexed: true, name: 'implementation', type: 'address' }],
  name: 'Upgraded',
  type: 'event',
};

const BeaconUpgradedABI: abi.Event.Definition = {
  anonymous: false,
  inputs: [{ indexed: true, name: 'beacon', type: 'address' }],
  name: 'BeaconUpgraded',
  type: 'event',
};

const AdminChangedABI: abi.Event.Definition = {
  anonymous: false,
  inputs: [
    { indexed: false, name: 'previousAdmin', type: 'address' },
    { indexed: false, name: 'newAdmin', type: 'address' },
  ],
  name: 'AdminChanged',
  type: 'event',
};

export const UpgradedEvent = new abi.Event(UpgradedABI);
export const BeaconUpgradedEvent = new abi.Event(BeaconUpgradedABI);
export const AdminChangedEvent = new abi.Event(AdminChangedABI);

export const authority = {
  first: new abi.Function(firstABI),
  get: new abi.Function(getABI),
  next: new abi.Function(nextABI),
  Candidate: new abi.Event(candidateABI),
  revoked: '0x' + Buffer.from('revoked').toString('hex').padEnd(64, '0'),
  added: '0x' + Buffer.from('added').toString('hex').padEnd(64, '0'),
};
export const prototype = {
  $Sponsor: new abi.Event($SponsorABI),
  $Master: new abi.Event($MasterABI),
  master: new abi.Function(methodMasterABI),

  currentSponsor: new abi.Function(currentSponsorABI),
  isSponsor: new abi.Function(isSponsorABI),
  unsponsored: '0x' + Buffer.from('unsponsored').toString('hex').padEnd(64, '0'),
  selected: '0x' + Buffer.from('selected').toString('hex').padEnd(64, '0'),
};
export const params = {
  get: new abi.Function(paramsGetABI),
  keys: {
    proposerEndorsement: '0x' + Buffer.from('proposer-endorsement').toString('hex').padStart(64, '0'),
  },
};

export const MeterMainnetDomains =
  '[{"inputs":[{"internalType":"string","name":"_tld","type":"string"}],"stateMutability":"payable","type":"constructor"},{"inputs":[],"name":"AlreadyRegistered","type":"error"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"InvalidName","type":"error"},{"inputs":[],"name":"Unauthorized","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"register","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"record","type":"string"},{"internalType":"enumRecordType","name":"recordType","type":"uint8"}],"name":"setRecord","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"_avatar","type":"string"},{"internalType":"string","name":"_twitterTag","type":"string"},{"internalType":"string","name":"_website","type":"string"},{"internalType":"string","name":"_email","type":"string"},{"internalType":"string","name":"_description","type":"string"}],"name":"setRecords","outputs":[],"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"basePrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAllNames","outputs":[{"internalType":"string[]","name":"","type":"string[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"getId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"enumRecordType","name":"recordType","type":"uint8"}],"name":"getRecord","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"getRecords","outputs":[{"internalType":"string[]","name":"","type":"string[]"},{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"ids","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isOwner","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"isSet","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"names","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"addresspayable","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"price","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"records","outputs":[{"internalType":"string","name":"avatar","type":"string"},{"internalType":"string","name":"twitterTag","type":"string"},{"internalType":"string","name":"website","type":"string"},{"internalType":"string","name":"email","type":"string"},{"internalType":"string","name":"description","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tld","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"valid","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"pure","type":"function"}]';

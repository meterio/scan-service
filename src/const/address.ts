export const ParamsAddress = '0x' + Buffer.from('Params').toString('hex').padStart(40, '0');
export const ExecutorAddress = '0x' + Buffer.from('Executor').toString('hex').padStart(40, '0');
export const PrototypeAddress = '0x' + Buffer.from('Prototype').toString('hex').padStart(40, '0');
export const ExtensionAddress = '0x' + Buffer.from('Extension').toString('hex').padStart(40, '0');
export const MeasureAddress = '0x' + Buffer.from('Measure').toString('hex').padStart(40, '0');

export const StakingModuleAddress =
  '0x' + Buffer.from('staking-module-address').toString('hex').padStart(40, '0').slice(-40);
export const AuctionModuleAddress =
  '0x' + Buffer.from('auction-account-address').toString('hex').padStart(40, '0').slice(-40);
export const AccountLockModuleAddress =
  '0x' + Buffer.from('account-lock-address').toString('hex').padStart(40, '0').slice(-40);
export const ValidatorBenefitAddress =
  '0x' + Buffer.from('validator-benefit-address').toString('hex').padStart(40, '0').slice(-40);
export const AuctionAccountAddress =
  '0x' + Buffer.from('auction-account-address').toString('hex').padStart(40, '0').slice(-40);
export const AuctionLeftOverAddress = '0xe852f654dfaee0e2b60842657379a56e1cafa292';

export const ZeroAddress = '0x0000000000000000000000000000000000000000';
export const EmptyBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const KnowExchange = new Map<string, string>();
export const BridgePoolAddress = '0x5c5713656c6819ebe3921936fd28bed2a387cda5';

export const LockedMeterGovAddrs: { [key: string]: true } = {
  ZeroAddress: true,
  BridgePoolAddress: true,
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef': true,
  '0x46b77531b74ff31882c4636a35547535818e0baa': true, // Permanant Locked
  // '0x2fa2d56e312c47709537acb198446205736022aa': true, // Team 1
  // '0x08ebea6584b3d9bf6fbcacf1a1507d00a61d95b7': true, // Team 2
  // '0x045df1ef32d6db371f1857bb60551ef2e43abb1e': true, // Team 3
  '0xbb8fca96089572f08736062b9c7da651d00011d0': true, // Team 4
  // '0xab22ab75f8c42b6969c5d226f39aeb7be35bf24b': true, // Team 5
  // '0x63723217e860bc409e29b46eec70101cd03d8242': true, // Team 6
  // '0x0374f5867ab2effd2277c895e7d1088b10ec9452': true, // Team 7
  '0x5308b6f26f21238963d0ea0b391eafa9be53c78e': true, // Team 8
  '0xe9061c2517bba8a7e2d2c20053cd8323b577efe7': true,
  '0xbb28e3212cf0df458cb3ba2cf2fd14888b2d7da7': true,
  '0x78e6f3af2bf71afa209c6e81b161c6a41d2da79d': true,
  '0x62e3e1df0430e6da83060b3cffc1adeb3792daf1': true,
};

export const SubFromTotalSupply: { [key: string]: true } = {
  '0x46b77531b74ff31882c4636a35547535818e0baa': true, // Permanant Locked
};

export const LockedMeterAddrs: { [key: string]: true } = {
  ZeroAddress: true,
  // BridgePoolAddress: true,
  // '0x0434a7f71945451f446297688e468efa716443bf': true, // Locked meter
};

// Thanks to Fabian(creator of vechainstats.com) for the information
KnowExchange.set('0x0f53ec6bbd2b6712c07d8880e5c8f08753d0d5d5', 'BigONE');

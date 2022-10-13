export * from './address';
export * from './genesis';
export * from './token';
export * from './abi';
export * from './model';
export * from './address';
export * from './types';

import { BigNumber } from 'bignumber.js';
import { Network } from './types';
export const LIMIT_WINDOW = 10;

export const fromWei = (val: string | number | BigNumber, precision: number | undefined = undefined) => {
  return new BigNumber(val).dividedBy(1e18).toFixed(precision);
};

// "address", "name", "release epoch"
const mainnetKnown = {
  '0x46b77531b74ff31882c4636a35547535818e0baa': 'Foundation Growth Reserve Indefinitely Locked',
  '0x2fa2d56e312c47709537acb198446205736022aa': 'Locked Batch 1',
  '0x08ebea6584b3d9bf6fbcacf1a1507d00a61d95b7': 'Locked Batch 2',
  '0x045df1ef32d6db371f1857bb60551ef2e43abb1e': 'Locked Batch 3',
  '0xbb8fca96089572f08736062b9c7da651d00011d0': 'Locked Batch 4',
  '0xab22ab75f8c42b6969c5d226f39aeb7be35bf24b': 'Locked Batch 5',
  '0x63723217e860bc409e29b46eec70101cd03d8242': 'Locked Batch 6',
  '0x0374f5867ab2effd2277c895e7d1088b10ec9452': 'Locked Batch 7',
  '0x5308b6f26f21238963d0ea0b391eafa9be53c78e': 'Locked Batch 8',
  '0xe9061c2517bba8a7e2d2c20053cd8323b577efe7': 'Foundation Ops',
  '0xbb28e3212cf0df458cb3ba2cf2fd14888b2d7da7': 'Marketing',
  '0x62e3e1df0430e6da83060b3cffc1adeb3792daf1': 'Bridge Locked',
  '0x5c5713656c6819ebe3921936fd28bed2a387cda5': 'Bridge Active',
  '0x1c4b70a3968436b9a0a9cf5205c787eb81bb558c': 'Gate.io',
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe': 'Gate.io',
  '0x78e6f3af2bf71afa209c6e81b161c6a41d2da79d': 'Foundation Ops',
  '0xc1a76f84d977e8d424a8eb09ce6adf029d38b91d': 'Bilaxy',
  '0x6f04787447975b40d29611833711117ed9de155f': 'mxc',

  // system contract
  '0x687a6294d0d6d63e751a059bf1ca68e4ae7b13e2': 'MTR system contract',
  '0x228ebbee999c6a7ad74a6130e81b12f9fe237ba3': 'MTRG system contract',

  // script engine
  '0x6163636f756e742d6c6f636b2d61646472657373': 'Account Lock Script',
  '0x616b696e672d6d6f64756c652d61646472657373': 'Staking Script',
  '0x74696f6e2d6163636f756e742d61646472657373': 'Auction Script',
  '0x61746f722d62656e656669742d61646472657373': 'Validator Benefit',
  '0xe852f654dfaee0e2b60842657379a56e1cafa292': 'Auction Leftover',
};

const testnetKnown = {
  '0x1a07d16b152e9a3f5c353bf05944ade8de1a37e9': 'Executor',
  '0x1de8ca2f973d026300af89041b0ecb1c0803a7e6': 'Master',

  // script engine
  '0x6163636f756e742d6c6f636b2d61646472657373': 'Account Lock Script',
  '0x616b696e672d6d6f64756c652d61646472657373': 'Staking Script',
  '0x74696f6e2d6163636f756e742d61646472657373': 'Auction Script',
};

export const getAccountName = (net, addr) => {
  if (net === Network.MainNet) {
    if (addr.toLowerCase() in mainnetKnown) {
      return mainnetKnown[addr];
    }
  } else if (net === Network.TestNet) {
    if (addr.toLowerCase() in testnetKnown) {
      return testnetKnown[addr];
    }
  }
};

export const RECENT_WINDOW = 5;
export const UNIT_SHANNON = 1e9;
export const UNIT_WEI = 1e18;

export class NetworkConfig {
  powUser?: string;
  powPass?: string;
  powHost?: string;
  powPort?: number;

  posUrl: string;
  rpcUrl: string;

  wmtrEnabled: boolean;
  wmtrAddress: string;
  powEnabled: boolean;
  auctionEnabled: boolean;
  sourcifyEnabled: boolean;

  coingeckoEnergy: string;
  coingeckoBalance: string;

  energySym: string;
  balanceSym: string;

  chainId: number;
}

export const GetNetworkConfig = (net: Network): NetworkConfig | undefined => {
  switch (net) {
    case Network.MainNet:
      return {
        // pow
        powUser: 'testuser',
        powPass: 'testpass',
        powHost: 'c03.meter.io',
        powPort: 8332,

        // pos
        posUrl: 'http://trace.meter.io:8669',
        rpcUrl: 'http://rpc-trace.meter.io',

        wmtrEnabled: true,
        wmtrAddress: '0x160361ce13ec33c993b5cca8f62b6864943eb083',

        powEnabled: true,
        auctionEnabled: true,
        sourcifyEnabled: true,

        coingeckoEnergy: 'meter-stable',
        coingeckoBalance: 'meter',

        energySym: 'MTR',
        balanceSym: 'MTRG',
        chainId: 82,
      };
    case Network.TestNet:
      return {
        // pow
        powUser: 'testuser',
        powPass: 'testpass',
        powHost: 't03.meter.io',
        powPort: 8332,

        // pos
        posUrl: 'http://warringstakes.meter.io:8669',
        rpcUrl: 'http://rpctest.meter.io',

        wmtrEnabled: false,
        wmtrAddress: '',

        powEnabled: true,
        auctionEnabled: true,
        sourcifyEnabled: true,

        coingeckoEnergy: 'meter-stable',
        coingeckoBalance: 'meter',

        energySym: 'MTR',
        balanceSym: 'MTRG',
        chainId: 83,
      };
    case Network.VerseMain: {
      return {
        posUrl: '',
        rpcUrl: 'https://test-rpc0.stp.network',

        wmtrEnabled: false,
        wmtrAddress: '',

        powEnabled: false,
        auctionEnabled: false,
        sourcifyEnabled: false,

        coingeckoEnergy: 'stp-network',
        coingeckoBalance: '',
        energySym: 'STPT',
        balanceSym: 'STPD',
        chainId: 36,
      };
    }
    case Network.VerseTest: {
      return {
        posUrl: '',
        rpcUrl: 'https://test-rpc0.stp.network',

        wmtrEnabled: false,
        wmtrAddress: '',

        powEnabled: false,
        auctionEnabled: false,
        sourcifyEnabled: false,

        coingeckoEnergy: 'stp-network',
        coingeckoBalance: '',
        energySym: 'STPT',
        balanceSym: 'STPD',
        chainId: 72,
      };
    }
  }
};

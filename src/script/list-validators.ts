#!/usr/bin/env node
require('../utils/validateEnv');

import * as fs from 'fs';
import axios from 'axios';

(async () => {
  try {
    const res = await axios.get(`http://mainnet.meter.io/staking/candidates`);
    let addrMap = {};
    for (const c of res.data) {
      addrMap[c.address] = true;
    }
    fs.writeFileSync('validators.txt', Object.keys(addrMap).join('\n'));
  } catch (e) {
    console.log(`error: ${e.name} ${e.message} - ${e.stack}`);
    process.exit(-1);
  }
})();

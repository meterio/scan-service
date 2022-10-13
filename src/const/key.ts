const string2key = (s) => '0x' + Buffer.from(s).toString('hex').padStart(64, '0').slice(-64);

export const KeyTransactionFeeAddress = string2key('transaction-fee-beneficiary-address');

export const KeyPowPoolCoef = string2key('powpool-coef');

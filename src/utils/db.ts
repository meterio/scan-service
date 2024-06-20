import { Network } from '../const';
import mongoose from 'mongoose';

export const connectDB = async (network: Network, standby: boolean) => {
  const { MONGO_PATH, MONGO_USER, MONGO_PWD, MONGO_SSL_CA } = process.env;
  let dbName = 'scandb';
  switch (network) {
    case Network.MainNet:
      if (standby) {
        dbName = 'scandb-main-standby';
      } else {
        dbName = 'scandb-main';
      }
      break;
    case Network.TestNet:
      if (standby) {
        dbName = 'scandb-test-standby';
      } else {
        dbName = 'scandb-test';
      }
      break;

    case Network.VerseMain:
      if (standby) {
        dbName = 'versedb-main-standby';
      } else {
        dbName = 'versedb-main';
      }
      break;
    case Network.VerseTest:
      if (standby) {
        dbName = 'versedb-test-standby';
      } else {
        dbName = 'versedb-test';
      }
      break;
  }
  console.log(`connect to DB path: ${MONGO_PATH}/${dbName}`);
  let url = `mongodb://${MONGO_USER}:${MONGO_PWD}@${MONGO_PATH}/${dbName}`;
  let options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    tlsAllowInvalidCertificates: false,
    sslCA: undefined,
  };
  let query: { [key: string]: string } = {};
  query['retryWrites'] = 'false';
  if (MONGO_SSL_CA != '') {
    query['ssl'] = 'true';
    query['replicaSet'] = 'rs0';
    query['readPreference'] = 'secondaryPreferred';
    // url += '?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred';
    options = {
      ...options,
      tlsAllowInvalidCertificates: true,
      sslCA: MONGO_SSL_CA,
    };
  }
  let queries = [];
  for (const key in query) {
    queries.push(`${key}=${query[key]}`);
  }
  let queryStr = queries.join('&');
  await mongoose.connect(queryStr ? url + '?' + queryStr : url, options);
  // mongoose.set('debug', true);
};

export const disconnectDB = async () => {
  return mongoose.disconnect();
};

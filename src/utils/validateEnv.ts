import { cleanEnv, num, port, str, json } from 'envalid';

function validateEnv() {
  cleanEnv(process.env, {
    // mongo
    MONGO_PATH: str(),
    MONGO_USER: str(),
    MONGO_PWD: str(),
    MONGO_SSL_CA: str(),

    SWAPPER_PRIVATE_KEY: str(),
    SWAPPER_RPC_URL: str(),
    CALLBACK_URL: str(),
    CONSUMER_KEY: str(),
    CONSUMER_SECRET: str(),
  });
}

require('dotenv').config();
validateEnv();

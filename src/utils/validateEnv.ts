import { cleanEnv, num, port, str, json } from 'envalid';

function validateEnv() {
  cleanEnv(process.env, {
    // mongo
    MONGO_PATH: str(),
    MONGO_USER: str(),
    MONGO_PWD: str(),
    MONGO_SSL_CA: str(),

    SWAPPER_PRIVATE_KEY: str(),
    SWAPPER_ROUTER_ADDR: str(),
    SWAPPER_RPC_URL: str(),
  });
}

require('dotenv').config();
validateEnv();

# Scan Service

Meter Scan backend service includes two major components:

1. `sync` that extracts data from chain and store it in base db
2. `api` that exposes query endpoints

## Sync Workflow

```
+----------------+       +--------------+        +----------------+
|                |       |              |        |                |
| Meter FullNode +-----> +   Base DB    +------->+ Defined Entity |
|                |       |              |        |                |
+----------------+       +--------------+        +----------------+
```

- `Base DB`: Blocks/TXs/PowBlocks/PowTxs/Receipts/...
- `Defined Entity`: Balances/Transfers/ etc

## Features

- Blocks/TXs/Receipts
- Committee/Epoch
- MTR/MTRG Native Balance and Transfer
- MTR/MTRG System Contract Transfer
- ERC20 Token Balance and Transfer
- Staking Engine
- Auction Engine
- AccountLock Engine
- NFT

## Usage

1. Install dependency

```
git clone https://github.com/meterio/scan-service
cd scan-service
yarn
```

2. Prepare .env file with these information

```
# file .env

# database
MONGO_PATH=localhost:27017
MONGO_PWD=scan
MONGO_USER=scan
MONGO_SSL_CA=

# used by api
SWAPPER_PRIVATE_KEY=
SWAPPER_RPC_URL=

```

3. Help

```bash
yarn start help
```

4. Run sync

```bash
# sync pos
yarn start sync pos -n main

# sync nft
yarn start sync nft -n main
```

5. Run api

```bash
yarn start api -n main -p 3000
```

## API Docker

```bash
# build docker
./api.docker.sh
```

## NFT related APIs

> Mainnet API base: `https://api.meter.io:8000/api`

> Testnet API base: `https://api.meter.io:4000/api`

Notice: `page` and `limit` are optional params for API access, `limit` means how many entries will be included in one page. The total number of entries will be returned in response with the name of `totalRows`, you'll need to loop the page number from 1 to Math.ceiling(`totalRows`/`limit`) to collect all the information

### Get all the tokens in NFT collection

> GET /nfts/:address/tokens?page=1&limit=20

eg: https://api.meter.io:8000/api/nfts/0x608203020799f9bda8bfcc3ac60fc7d9b0ba3d78/tokens

### Get detail for NFT token

> GET /nfts/:address/:tokenId

eg: https://api.meter.io:8000/api/nfts/0x608203020799f9bda8bfcc3ac60fc7d9b0ba3d78/3445

### Get NFT token holdings on user address

> GET /accounts/:address/nfts?page=1&limit=20

eg: https://api.meter.io:8000/api/accounts/0x00704fe459dd9ea5b23a2254333a8dce5485b6d1/nfts?page=1&limit=20

### List out all the token holders for NFT collection

> GET /account/:tokenAddress/holders?page=1&limit=20

eg: https://api.meter.io:8000/api/accounts/0x608203020799f9bda8bfcc3ac60fc7d9b0ba3d78/holders?page=1&limit=20

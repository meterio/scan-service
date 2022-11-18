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

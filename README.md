# Scan Service

Meter Scan backend service for the [Meter blockchain explorer](https://scan.meter.io). It consists of two major components:

1. **`sync`** — extracts data from the chain and stores it in MongoDB
2. **`api`** — exposes REST query endpoints for the frontend

## Architecture

```
                          ┌─────────────────────────────────────────────┐
                          │               Meter Full Node                │
                          └────────────────────┬────────────────────────┘
                                               │ RPC / REST
                    ┌──────────────────────────▼──────────────────────────┐
                    │                    Sync Services                     │
                    │                                                      │
                    │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
                    │  │  pos     │  │  pow     │  │  scriptengine     │ │
                    │  │ (blocks, │  │ (PoW     │  │  (DeFi/auction/   │ │
                    │  │  txs,    │  │  blocks) │  │   staking events) │ │
                    │  │  epochs) │  └──────────┘  └───────────────────┘ │
                    │  └──────────┘                                       │
                    │  ┌──────────┐  ┌──────────┐                        │
                    │  │  nft     │  │  metric  │                        │
                    │  │ (ERC721/ │  │ (chain   │                        │
                    │  │  ERC1155)│  │  metrics)│                        │
                    │  └──────────┘  └──────────┘                        │
                    └──────────────────────┬──────────────────────────────┘
                                           │ read/write
                              ┌────────────▼────────────┐
                              │         MongoDB          │
                              │  scandb-main / scandb-   │
                              │  test (per network)      │
                              └────────────┬────────────┘
                                           │ read
                              ┌────────────▼────────────┐
                              │        API Service       │
                              │   (REST endpoints on     │
                              │    port 4000/4001)       │
                              └─────────────────────────┘
```

### Sync Services

| Service        | Description                                                    | Networks        |
|----------------|----------------------------------------------------------------|-----------------|
| `pos`          | Syncs PoS blocks, transactions, receipts, epochs, committees  | mainnet, testnet |
| `pow`          | Syncs PoW blocks and transactions                             | mainnet only    |
| `nft`          | Indexes ERC721 and ERC1155 token events and metadata          | mainnet, testnet |
| `metric`       | Computes and stores chain-level metrics                       | mainnet, testnet |
| `scriptengine` | Processes staking, auction, and accountlock script engine events | mainnet, testnet |

### Database

MongoDB is used as the primary data store. The database name is selected automatically based on the network:

| Network  | Database name     |
|----------|-------------------|
| mainnet  | `scandb-main`     |
| testnet  | `scandb-test`     |

---

## Prerequisites

- **Node.js** v20+
- **npm** (or **yarn**)
- **MongoDB** v5+ — running locally or accessible remotely
- **Docker** + **Docker Compose** — for containerized deployment
- A running **Meter full node** to sync from

---

## Running Locally

### 1. Install dependencies

```bash
git clone https://github.com/meterio/scan-service
cd scan-service
npm install
```

### 2. Configure environment

Copy the sample env file and fill in your values:

```bash
cp .env.sample .env
```

```env
# MongoDB connection
MONGO_PATH=localhost:27017
MONGO_USER=scan
MONGO_PWD=scan
MONGO_SSL_CA=

# Required by API
SWAPPER_PRIVATE_KEY=
SWAPPER_RPC_URL=

COINMARKETCAP_API_KEY=
CALLBACK_URL=
CONSUMER_KEY=
CONSUMER_SECRET=
```

### 3. Run sync services

```bash
# Sync PoS blocks/txs (mainnet)
npm start sync pos -n main

# Sync PoS blocks/txs (testnet)
npm start sync pos -n test

# Sync NFTs
npm start sync nft -n main

# Sync metrics
npm start sync metric -n main

# Sync script engine events
npm start sync scriptengine -n main

# Sync PoW blocks (mainnet only)
npm start sync pow -n main
```

### 4. Run the API

```bash
# Mainnet API on port 4000
npm start api -n main -p 4000

# Testnet API on port 4001
npm start api -n test -p 4001
```

---

## Running with Docker Compose

The Docker image is `meterio/scan-api:latest`. Build it with:

```bash
./api.docker.sh
```

Separate compose files are provided for mainnet and testnet. Each reads from its own env file.

### Mainnet

```bash
cp .env.sample .env.mainnet
# edit .env.mainnet with mainnet values

docker compose -f docker-compose.mainnet.yml up -d
```

### Testnet

```bash
cp .env.sample .env.testnet
# edit .env.testnet with testnet values

docker compose -f docker-compose.testnet.yml up -d
```

### Services included

| Service            | Mainnet | Testnet |
|--------------------|---------|---------|
| `sync-pos`         | ✅      | ✅      |
| `sync-pow`         | ✅      | ❌      |
| `sync-nft`         | ✅      | ✅      |
| `sync-metric`      | ✅      | ✅      |
| `sync-scriptengine`| ✅      | ✅      |

---

## API Reference

> Mainnet API base: `https://api.meter.io:8000/api`

> Testnet API base: `https://api.meter.io:4000/api`

`page` and `limit` are optional query params. `limit` controls entries per page. Use `totalRows` in the response to calculate total pages: `Math.ceil(totalRows / limit)`.

### NFT APIs

#### Get all tokens in an NFT collection

```
GET /nfts/:address/tokens?page=1&limit=20
```

#### Get detail for an NFT token

```
GET /nfts/:address/:tokenId
```

#### Get NFT holdings for an address

```
GET /accounts/:address/nfts?page=1&limit=20
```

#### List all holders of an NFT collection

```
GET /accounts/:tokenAddress/holders?page=1&limit=20
```

---

## Features

- Blocks, transactions, receipts
- Committee and epoch tracking
- MTR/MTRG native balance and transfers
- MTR/MTRG system contract transfers
- ERC20 token balance and transfers
- Staking engine
- Auction engine
- AccountLock engine
- NFT (ERC721 / ERC1155)

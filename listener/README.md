# Wallet Listener Service

Serves an Express server with an included service to periodically check wallet balances and QualifiedInvite document instances, mutating existing instance documents if they are found and not yet qualified.

## 💻 Getting Started

1. Install dependencies

```bash
npm install
```

2. Create a .env file with a SEED (this must be the same as the SEED in your .env file of /composeServer), as well as a JSONRPCPROVIDER. For example:

```bash
SEED='a6e782751d79e724c47380f1aad31f80df876c5cd94b11699e186d9bbc57fa38'
JSONRPCPROVIDER='https://polygon-mumbai.infura.io/v3/98b02479b1984bab836b21a5c6a15775'
```

3. Start your development server:

```bash
npm run start
```

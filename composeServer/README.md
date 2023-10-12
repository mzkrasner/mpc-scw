# ComposeDB Server

Serves a simple Express server that receives requests to create incomplete QualifiedInvite document instances

## 💻 Getting Started

1. Install dependencies

```bash
npm install
```

2. Generate Credentials

```bash
npm run generate
```

3. Create a .env file with a SEED (this must be different than your admin seed in admin_seed.txt). For example:

`SEED='a6e782751d79e724c47380f1aad31f80df876c5cd94b11699e186d9bbc57fa38'`

4. Start your development server:

```bash
nvm use 16
npm run dev
```

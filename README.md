# Programmable MPC Wallets with Flexible Auth 🔑

This is an example web app that shows how you can mint and use Lit's programmable MPC wallets with social accounts, one-time passwords, and passkeys using [Lit JS SDK](https://developer.litprotocol.com/v2/).

This particular demo also runs Ceramic with ComposeDB to show how one might generate SCW from MPC using Biconomy, and save them `QualifiedInvite` instances to ComposeDB

## 💻 Getting Started

1. Install dependencies

```bash
npm install
```

2. Generate admin seed and ComposeDB configuration

```bash
npm run generate
```

3. Start your development server:

```bash
nvm use 16
npm run dev
```

4. Visit [http://localhost:3000](http://localhost:3000) to start playing with the app.

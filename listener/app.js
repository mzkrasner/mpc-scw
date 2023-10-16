import express from "express";
import Web3 from "web3";
import cors from "cors";
import "dotenv/config";
import { CeramicClient } from "@ceramicnetwork/http-client";
import KeyResolver from "key-did-resolver";
import { DID } from "dids";
import { Ed25519Provider } from "key-did-provider-ed25519";
import { fromString } from "uint8arrays/from-string";
import CeramicContext from "../composeServer/scripts/index.mjs";
import bodyParser from "body-parser";

const app = express();
app.use(cors());
app.use(bodyParser.json());
const PORT = process.env.PORT || 3002;
const NODE_URL = process.env.NODE_URL;
const web3 = new Web3(NODE_URL);

const allowCrossDomain = function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
};

app.use(allowCrossDomain);

const composeClient = CeramicContext.composeClient;

const ceramic = new CeramicClient("http://localhost:7007");

//authenticate developer DID in order to create a write transaction
const authenticateDID = async (seed) => {
  const key = fromString(seed, "base16");
  const provider = new Ed25519Provider(key);
  const staticDid = new DID({
    resolver: KeyResolver.getResolver(),
    provider,
  });
  await staticDid.authenticate();
  ceramic.did = staticDid;
  return staticDid;
};

const updateInvite = async (stream) => {
  try {
    const did = await authenticateDID(process.env.SEED);
    composeClient.setDID(did);
    const data = await composeClient.executeQuery(`
        mutation {
          updateQualifiedInvite(
            input: {
              id: "${stream}"
              content: {
                qualified: true
              }
            }
          ) {
            article: document {
              qualified
              id
              inviter{
                id
              }
              invitee{
                id
              }
            }
          }
        }
      `);
    console.log(data);
    return data;
  } catch (err) {
    console.error(err);
    setError(err);
  }
};

const getAllInvites = async () => {
  try {
    const count = await composeClient.executeQuery(`  
      query{
        qualifiedInviteCount
      }
    `);
    console.log(
      count.data.qualifiedInviteCount,
      "Total count of invite documents"
    );
    if (count.data.qualifiedInviteCount > 0) {
      const data = await composeClient.executeQuery(`
        query {
          qualifiedInviteIndex(
            filters: { 
              where: { 
                qualified: { 
                  equalTo: ${false}
                } 
              } 
            }, 
          first: ${count.data.qualifiedInviteCount}) {
            edges {
              node {
                id
                qualified
                invitee{
                  id
                }
              }
            }
          }
        }
      `);
      console.log(
        data.data.qualifiedInviteIndex.edges.length,
        "Index of invites that have not yet been qualified"
      );
      return data.data.qualifiedInviteIndex.edges;
    } else {
      return [];
    }
  } catch (err) {
    console.error(err);
    setError(err);
  }
};

const checkBalances = async () => {
  const invites = await getAllInvites();
  const web3Http = new Web3(process.env.JSONRPCPROVIDER);
  for (let i = 0; i < invites.length; i++) {
    const balance = await web3Http.eth.getBalance(
      invites[i].node.invitee.id.slice(17)
    );
    if (balance > 0) {
      const streamId = invites[i].node.id;
      await updateInvite(streamId);
    }
    console.log(balance, invites[i].node.invitee.id.slice(17), "Balance");
  }
};

const createComposite = async (inviter, invitee) => {
  try {
    const did = await authenticateDID(process.env.SEED);
    composeClient.setDID(did);

    const data = await composeClient.executeQuery(`
        mutation {
          createQualifiedInvite(input: {
            content: {
              inviter: "did:pkh:eip155:1:${inviter}"
              invitee: "did:pkh:eip155:1:${invitee}"
              qualified: true
            }
          }) 
          {
            document {
              id
              inviter{
                id
              }
              invitee{
                id
              }
            }
          }
        }
      `);
    console.log(data);
    return data;
  } catch (err) {
    console.error(err);
    setError(err);
  }
};

// Requests will never reach this route
app.post("/listener", async function (req, res) {
  console.log(req.body);
  const exists = await checkIfExists(req.body.invitee);
  if (!exists) {
    const data = await createComposite(req.body.inviter, req.body.invitee);
    res.json(data);
  }
});

app.listen(PORT, function (err) {
  if (err) console.log(err);
  console.log("Server listening on PORT", PORT);
});

setInterval(checkBalances, 1000);

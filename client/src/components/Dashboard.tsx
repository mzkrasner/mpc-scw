import { AuthMethod, IRelayPKP, SessionSigs } from '@lit-protocol/types';
import { Wallet, providers, ethers } from 'ethers';
import { useEffect, useState } from 'react';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import { useRouter } from 'next/router';
import { useDisconnect } from 'wagmi';
import { AuthMethodType } from '@lit-protocol/constants';
import { useCeramicContext } from '../context';
import { Ed25519Provider } from 'key-did-provider-ed25519';
import { authenticateCeramic } from '../utils';
import { fromString } from 'uint8arrays/from-string';
import KeyResolver from 'key-did-resolver';
import { DID } from 'dids';
import {
  IPaymaster,
  BiconomyPaymaster,
  IHybridPaymaster,
  PaymasterMode,
  SponsorUserOperationDto,
} from '@biconomy/paymaster';
import { IBundler, Bundler } from '@biconomy/bundler';
import {
  BiconomySmartAccountV2,
  DEFAULT_ENTRYPOINT_ADDRESS,
} from '@biconomy/account';
import { ChainId } from '@biconomy/core-types';
import {
  ECDSAOwnershipValidationModule,
  DEFAULT_ECDSA_OWNERSHIP_MODULE,
} from '@biconomy/modules';

interface DashboardProps {
  currentAccount: IRelayPKP;
  sessionSigs: SessionSigs;
}

type DataResult = {
  createQualifiedInvite: {
    document: {
      id: string;
      inviter: {
        id: string;
      };
      invitee: {
        id: string;
      };
    };
  };
};

export default function Dashboard({
  currentAccount,
  sessionSigs,
}: DashboardProps) {
  const [message, setMessage] = useState<string>('Free the web!');
  const [signature, setSignature] = useState<string>();
  const [result, setResult] = useState<DataResult>();
  const [recoveredAddress, setRecoveredAddress] = useState<string>();
  const [verified, setVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [smartAccount, setSmartAccount] = useState<BiconomySmartAccountV2>();
  const [worker, setWorker] = useState(null);
  const [error, setError] = useState<Error>();
  const clients = useCeramicContext();
  const { ceramic, composeClient } = clients;

  const { disconnectAsync } = useDisconnect();
  const router = useRouter();

  const bundler: IBundler = new Bundler({
    bundlerUrl:
      'https://bundler.biconomy.io/api/v2/80001/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44',
    chainId: ChainId.POLYGON_MUMBAI,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
  });

  const paymaster: IPaymaster = new BiconomyPaymaster({
    paymasterUrl:
      'https://paymaster.biconomy.io/api/v1/80001/Tpk8nuCUd.70bd3a7f-a368-4e5a-af14-80c7f1fcda1a',
  });

  async function createAccount() {
    //LIT PKPEthersWallet for input into signer field of `moduleItem`
    const pkpWallet = new PKPEthersWallet({
      controllerSessionSigs: sessionSigs,
      pkpPubKey: currentAccount.publicKey,
    });
    await pkpWallet.init();

    const moduleItem = await ECDSAOwnershipValidationModule.create({
      signer: pkpWallet,
      moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE,
    });

    let smartAccount: BiconomySmartAccountV2;
    let address: string;

    let biconomySmartAccount = await BiconomySmartAccountV2.create({
      chainId: ChainId.POLYGON_MUMBAI, // or any supported chain of your choice
      bundler: bundler,
      paymaster: paymaster,
      entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
      defaultValidationModule: moduleItem,
      activeValidationModule: moduleItem,
    });
    address = await biconomySmartAccount.getAccountAddress();
    const newSig = await biconomySmartAccount.signMessage(message);
    console.log(newSig);
    smartAccount = biconomySmartAccount;
    console.log('address: ', await biconomySmartAccount.getAccountAddress());
    setSmartAccount(biconomySmartAccount);
    const response = await fetch('http://localhost:3001/compose', {
      method: "POST", 
      mode: "cors", 
      cache: "no-cache", 
      headers: {
        "Content-Type": "application/json",
      },
      redirect: "follow", 
      referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: JSON.stringify({
        inviter: '0x8071f6F971B438f7c0EA72C950430EE7655faBCe',
        invitee: address,
      }),
    });
    const toJson = await response.json(); // parses JSON response into native JavaScript objects
    console.log(toJson);
}

  /**
   * Sign a message with current PKP
   */
  async function signMessageWithPKP() {
    setLoading(true);

    try {
      const pkpWallet = new PKPEthersWallet({
        controllerSessionSigs: sessionSigs,
        pkpPubKey: currentAccount.publicKey,
      });
      await pkpWallet.init();

      const signature = await pkpWallet.signMessage(message);
      setSignature(signature);

      // Get the address associated with the signature created by signing the message
      const recoveredAddr = ethers.utils.verifyMessage(message, signature);
      setRecoveredAddress(recoveredAddr);

      // Check if the address associated with the signature is the same as the current PKP
      const verified =
        currentAccount.ethAddress.toLowerCase() === recoveredAddr.toLowerCase();
      setVerified(verified);
    } catch (err) {
      console.error(err);
      setError(err);
    }

    setLoading(false);
  }

  async function generateQualified() {
    setLoading(true);

    try {
      const staticDid = new DID({
        provider: new Ed25519Provider(
          fromString(
            'dfabafa4168279e29d326b5f3eecc64c0faddc69ff089f2381f81249e5369992',
            'base16'
          )
        ),
        //@ts-ignore
        resolver: KeyResolver.getResolver(),
      });

      await staticDid.authenticate();
      //authenticate on ceramic instance
      composeClient.setDID(staticDid);
      ceramic.did = staticDid;

      //not sure where this comes from or how it's obtained
      //would represent the inviter's did based on their mpc wallet
      const inviter = '0x8071f6F971B438f7c0EA72C950430EE7655faBCe';

      const invitee = await smartAccount?.getAccountAddress();
      const data = await composeClient.executeQuery<DataResult>(`
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
      setResult(data.data!);
    } catch (err) {
      console.error(err);
      setError(err);
    }

    setLoading(false);
  }

  async function handleLogout() {
    try {
      await disconnectAsync();
    } catch (err) {}
    localStorage.removeItem('lit-wallet-sig');
    router.reload();
  }


  return (
    <div className="container">
      <div className="logout-container">
        <button className="btn btn--link" onClick={handleLogout}>
          Logout
        </button>
      </div>
      <h1>Ready for the open web</h1>
      <div className="details-card">
        <p>My address: {currentAccount.ethAddress.toLowerCase()}</p>
      </div>
      <div className="divider"></div>
      <div className="message-card">
        <p>Test out your wallet by signing this message:</p>
        <p className="message-card__prompt">{message}</p>
        <button
            onClick={signMessageWithPKP}
          disabled={loading}
          className={`btn ${
            signature ? (verified ? 'btn--success' : 'btn--error') : ''
          } ${loading && 'btn--loading'}`}
        >
          {signature ? (
            verified ? (
              <span>Verified ✓</span>
            ) : (
              <span>Failed x</span>
            )
          ) : (
            <span>Sign message</span>
          )}
        </button>
        <button
          onClick={createAccount}
          disabled={loading}
          className={`btn ${
            signature ? (verified ? 'btn--success' : 'btn--error') : ''
          } ${loading && 'btn--loading'}`}
        >
          <span>Create </span>
        </button>
        {smartAccount && (
          <>
            <button
              onClick={generateQualified}
              disabled={loading}
              className={`btn ${
                signature ? (verified ? 'btn--success' : 'btn--error') : ''
              } ${loading && 'btn--loading'}`}
            >
              <span>Create Qualified </span>
            </button>
            <div className="details-card">
              <p>Result: {JSON.stringify(result)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

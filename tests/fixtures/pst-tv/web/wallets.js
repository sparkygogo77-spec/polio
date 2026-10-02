// Connect browser wallets (Phantom, Solflare, Backpack, ...) through the Solana Wallet Standard.
// No wallet library: the Wallet Standard is a small event protocol. Test networks only: the page
// asks wallets to sign for devnet, testnet or a local validator, and never for mainnet.

const SUPPORTED_NETWORKS = { devnet: 'solana:devnet', testnet: 'solana:testnet', localnet: 'solana:localnet', standin: 'solana:localnet' };

/** The Wallet Standard chain for the server's network. Throws for mainnet or anything unknown. */
export function chainFor(network) {
  if (network === 'mainnet' || network === 'mainnet-beta') throw new Error('Mainnet is not allowed: PonsStars runs on test networks only.');
  const chain = SUPPORTED_NETWORKS[network];
  if (!chain) throw new Error(`unknown network ${network}`);
  return chain;
}

/**
 * Find installed wallets. Calls `onChange(list)` whenever one registers. Each entry is the wallet
 * object from the Wallet Standard (name, icon, features, accounts).
 */
export function discoverWallets(onChange) {
  const wallets = [];
  const api = {
    register(...ws) {
      for (const w of ws) if (!wallets.includes(w) && isSolanaSigner(w)) wallets.push(w);
      onChange([...wallets]);
      return () => {
        for (const w of ws) {
          const i = wallets.indexOf(w);
          if (i >= 0) wallets.splice(i, 1);
        }
        onChange([...wallets]);
      };
    },
  };
  globalThis.addEventListener('wallet-standard:register-wallet', (e) => {
    try {
      e.detail(api);
    } catch {
      /* a broken wallet must not break the page */
    }
  });
  globalThis.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }));
  return () => [...wallets];
}

/** A wallet we can use: connect, sign messages and sign transactions on Solana. */
export function isSolanaSigner(w) {
  const f = w?.features ?? {};
  return !!(f['standard:connect'] && f['solana:signMessage'] && f['solana:signTransaction']);
}

/** Read a Solana "compact-u16" length. Returns [value, bytes used]. */
function compactU16(bytes, at) {
  let value = 0;
  for (let i = 0; i < 3; i++) {
    const b = bytes[at + i];
    value |= (b & 0x7f) << (7 * i);
    if ((b & 0x80) === 0) return [value, i + 1];
  }
  throw new Error('bad length');
}

/** An unsigned transaction in wire format: signature count, empty signatures, then the message. */
export function wireFromMessage(message) {
  const n = message[0]; // header: number of required signatures
  if (!(n >= 1 && n < 128)) throw new Error('unexpected transaction header');
  const out = new Uint8Array(1 + 64 * n + message.length);
  out[0] = n;
  out.set(message, 1 + 64 * n);
  return out;
}

/**
 * Take the fee payer's signature out of a wallet-signed transaction, and make sure the wallet did
 * not change the transaction (for example by adding fees): the server signs off on exact bytes.
 */
export function signatureFromSignedTx(signed, message) {
  const [n, used] = compactU16(signed, 0);
  if (n < 1) throw new Error('the wallet returned no signature');
  const msg = signed.subarray(used + 64 * n);
  if (msg.length !== message.length || msg.some((b, i) => b !== message[i])) {
    throw new Error('the wallet changed the transaction; it was not sent');
  }
  const sig = signed.slice(used, used + 64);
  if (sig.every((b) => b === 0)) throw new Error('the wallet did not sign');
  return sig;
}

/**
 * Connect a Wallet Standard wallet for the server's network. Returns
 * { kind, name, address, sign(bytes) for messages, signTx(messageBytes) for transactions }.
 */
export async function connectStandardWallet(wallet, network) {
  const chain = chainFor(network);
  const { accounts } = await wallet.features['standard:connect'].connect();
  const account = (accounts ?? wallet.accounts ?? [])[0];
  if (!account) throw new Error(`${wallet.name} did not share an account`);
  const signMessage = wallet.features['solana:signMessage'].signMessage;
  const signTransaction = wallet.features['solana:signTransaction'].signTransaction;
  return {
    kind: 'standard',
    name: wallet.name,
    address: account.address,
    chain,
    sign: async (bytes) => {
      const [out] = await signMessage({ account, message: bytes });
      return new Uint8Array(out.signature);
    },
    // Wallets with solana:signIn build the sign-in text themselves and check that the site asking
    // is the site named in it. Returns { message (the exact signed text), signature }.
    signIn: wallet.features['solana:signIn']
      ? async (fields) => {
          const [out] = await wallet.features['solana:signIn'].signIn(fields);
          if (out.account?.address !== account.address) throw new Error('the wallet signed in with another account');
          return { message: new TextDecoder().decode(out.signedMessage), signature: new Uint8Array(out.signature) };
        }
      : null,
    signTx: async (message) => {
      const [out] = await signTransaction({ account, transaction: wireFromMessage(message), chain });
      return signatureFromSignedTx(new Uint8Array(out.signedTransaction), message);
    },
    disconnect: async () => {
      await wallet.features['standard:disconnect']?.disconnect?.();
    },
  };
}

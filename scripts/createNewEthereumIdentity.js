const { KmsKeyType, hexToBytes } = require("@0xpolygonid/js-sdk");
const { DidMethod, Blockchain, NetworkId } = require("@iden3/js-iden3-core");
const { SigningKey, Wallet, JsonRpcProvider } = require("ethers");
const { getInitializedRuntime } = require("./shared/bootstrap");
const {
  parseArgs,
  formatError,
  outputSuccess,
  addHexPrefix,
} = require("./shared/utils");

async function main() {
  try {
    const args = parseArgs();
    const {
      kms,
      identityWallet,
      didsStorage,
      billionsMainnetConfig,
      revocationOpts,
    } = await getInitializedRuntime();

    let privateKeyHex = args.key;
    if (privateKeyHex) {
      const stripped = privateKeyHex.startsWith("0x")
        ? privateKeyHex.slice(2)
        : privateKeyHex;
      if (!/^[0-9a-fA-F]{64}$/.test(stripped)) {
        console.error(
          "Error: --key must be a 32-byte hex string (64 hex characters, with optional 0x prefix)",
        );
        process.exit(1);
      }
    } else {
      privateKeyHex = new SigningKey(Wallet.createRandom().privateKey)
        .privateKey;
    }

    // Create signer from private key
    const signer = new SigningKey(addHexPrefix(privateKeyHex));

    // Get the Secp256k1 key provider
    const keyProvider = kms.getKeyProvider(KmsKeyType.Secp256k1);
    if (!keyProvider) {
      console.error("Error: Secp256k1 key provider not found");
      process.exit(1);
    }

    // Create wallet with Billions Network provider
    const wallet = new Wallet(
      signer,
      new JsonRpcProvider(billionsMainnetConfig.url),
    );

    // Create Ethereum-based identity
    let did;
    try {
      const result = await identityWallet.createEthereumBasedIdentity({
        method: DidMethod.Iden3,
        blockchain: Blockchain.Billions,
        networkId: NetworkId.Main,
        seed: hexToBytes(privateKeyHex),
        revocationOpts: revocationOpts,
        ethSigner: wallet,
        createBjjCredential: false,
      });
      did = result.did;
    } catch (err) {
      console.error(
        `Error: Failed to create Ethereum-based identity: ${err.message}`,
      );
      process.exit(1);
    }

    // Save DID to storage
    await didsStorage.save({
      did: did.string(),
      publicKeyHex: signer.publicKey,
      isDefault: true,
    });

    outputSuccess(did.string());
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

main();

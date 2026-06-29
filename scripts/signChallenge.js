const {
  JWSPacker,
  byteEncoder,
  byteDecoder,
  KmsKeyType,
} = require("@0xpolygonid/js-sdk");
const { getInitializedRuntime } = require("./shared/bootstrap");
const {
  parseArgs,
  outputSuccess,
  createDidDocument,
  getAuthResponseMessage,
  buildEthereumAddressFromDid,
  resolveDidEntry,
  requireArgs,
  runScript,
} = require("./shared/utils");
const { buildJsonAttestation } = require("./shared/attestation");

async function signChallenge(challenge, entry, kms) {
  const didDocument = createDidDocument(entry.did, entry.publicKeyHex);

  const resolveDIDDocument = {
    resolve: () => Promise.resolve({ didDocument }),
  };

  const jwsPacker = new JWSPacker(kms, resolveDIDDocument);

  challenge.attestationInfo = buildJsonAttestation({
    recipientDid: entry.did,
    recipientEthAddress: buildEthereumAddressFromDid(entry.did),
  });

  const authMessage = getAuthResponseMessage(entry.did, challenge);
  const msgBytes = byteEncoder.encode(JSON.stringify(authMessage));

  let token;
  try {
    token = await jwsPacker.pack(msgBytes, {
      alg: "ES256K-R",
      issuer: entry.did,
      did: entry.did,
      keyType: KmsKeyType.Secp256k1,
    });
  } catch (err) {
    throw new Error(`Failed to sign challenge: ${err.message}`);
  }

  return byteDecoder.decode(token);
}

async function main() {
  const args = parseArgs();
  requireArgs(args, ["challenge"], "node scripts/signChallenge.js --challenge <challenge> [--did <did>]");

  const { kms, didsStorage } = await getInitializedRuntime();

  const entry = await resolveDidEntry(didsStorage, args.did);

  const challenge = JSON.parse(args.challenge);
  const tokenString = await signChallenge(challenge, entry, kms);

  outputSuccess({ success: true, data: { token: tokenString } });
}

module.exports = { signChallenge };

if (require.main === module) {
  runScript(main);
}

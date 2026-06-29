const { JWSPacker, byteEncoder } = require("@0xpolygonid/js-sdk");
const { getInitializedRuntime } = require("./shared/bootstrap");
const { parseArgs, formatError, outputSuccess } = require("./shared/utils");

const DID_PATTERN = /^did:iden3:[a-zA-Z0-9:]+$/;

async function main() {
  try {
    const args = parseArgs();

    if (!args.token || !args.did) {
      console.error("Error: --did and --token parameters are required");
      console.error(
        "Usage: node scripts/verifySignature.js --did <did> --token <token>",
      );
      process.exit(1);
    }

    if (!DID_PATTERN.test(args.did)) {
      console.error("Error: Invalid DID format");
      process.exit(1);
    }

    const { kms, challengeStorage } = await getInitializedRuntime();

    const challenge = await challengeStorage.consumeChallenge(args.did);
    if (!challenge) {
      console.error(`Error: No valid challenge found for DID: ${args.did}`);
      console.error("Generate a challenge first with generateChallenge.js");
      process.exit(1);
    }

    const resolveDIDDocument = {
      resolve: async (did) => {
        if (!DID_PATTERN.test(did)) {
          throw new Error("Invalid DID format for resolution");
        }
        const resp = await fetch(
          `https://resolver.privado.id/1.0/identifiers/${encodeURIComponent(did)}`,
        );
        if (!resp.ok) {
          throw new Error(
            `DID resolution failed with status ${resp.status}`,
          );
        }
        const didResolutionRes = await resp.json();
        if (!didResolutionRes || !didResolutionRes.didDocument) {
          throw new Error("DID resolution returned invalid response");
        }
        return didResolutionRes;
      },
    };

    const jws = new JWSPacker(kms, resolveDIDDocument);
    const basicMessage = await jws.unpack(byteEncoder.encode(args.token));

    if (basicMessage.from !== args.did) {
      console.error(
        `Error: Invalid from: expected from ${args.did}, got ${basicMessage.from}`,
      );
      process.exit(1);
    }

    const payload = basicMessage.body;
    if (payload.message !== challenge) {
      console.error("Error: Invalid signature: challenge mismatch");
      process.exit(1);
    }

    outputSuccess("Signature verified successfully");
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

main();

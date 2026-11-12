const { createPairing } = require("./linkHumanToAgent");
const { parseArgs, formatError } = require("./shared/utils");

async function main() {
  try {
    const args = parseArgs({
      options: ["challenge", "did"],
      required: ["challenge"],
    });

    const challenge = JSON.parse(args.challenge);
    const url = await createPairing(challenge, args.did);

    console.log(url);
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

main();

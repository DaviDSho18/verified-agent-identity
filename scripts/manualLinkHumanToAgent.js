const { createPairing } = require("./linkHumanToAgent");
const { parseArgs, formatError } = require("./shared/utils");

async function main() {
  try {
    const args = parseArgs();

    if (!args.challenge) {
      console.error(
        "Invalid arguments. Usage: node manualLinkHumanToAgent.js --challenge <json> [--did <did>]",
      );
      console.error(
        'Example: node manualLinkHumanToAgent.js --challenge \'{"name": "Agent Name", "description": "Short description of the agent"}\'',
      );
      process.exit(1);
    }

    let challenge;
    try {
      challenge = JSON.parse(args.challenge);
    } catch (err) {
      console.error(
        `Error: --challenge value is not valid JSON: ${err.message}`,
      );
      process.exit(1);
    }
    const url = await createPairing(challenge, args.did);

    console.log(url);
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

main();

const { createPairing } = require("./linkHumanToAgent");
const { parseArgs, requireArgs, runScript } = require("./shared/utils");

async function main() {
  const args = parseArgs();
  requireArgs(
    args,
    ["challenge"],
    'node manualLinkHumanToAgent.js --challenge <json> [--did <did>]\nExample: node manualLinkHumanToAgent.js --challenge \'{"name": "Agent Name", "description": "Short description of the agent"}\'',
  );

  const challenge = JSON.parse(args.challenge);
  const url = await createPairing(challenge, args.did);

  console.log(url);
}

runScript(main);

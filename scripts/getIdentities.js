const { getInitializedRuntime } = require("./shared/bootstrap");
const { parseArgs, formatError, outputSuccess } = require("./shared/utils");

async function main() {
  try {
    parseArgs();
    const { didsStorage } = await getInitializedRuntime();

    const identities = await didsStorage.list();

    if (identities.length === 0) {
      console.error(
        "No identities found. Create one with createNewEthereumIdentity.js",
      );
      process.exit(1);
    }

    outputSuccess(identities);
  } catch (error) {
    console.error(formatError(error));
    process.exit(1);
  }
}

main();

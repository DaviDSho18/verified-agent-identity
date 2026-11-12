const { parseArgs: parseNodeArgs } = require("node:util");
const path = require("node:path");

function parseArgs(
  { options = [], required = [] } = {},
  argv = process.argv.slice(2),
) {
  const flags = options.map((name) => {
    const flag = `--${name} <${name}>`;
    return required.includes(name) ? flag : `[${flag}]`;
  });
  const usage = `Usage: node scripts/${path.basename(process.argv[1])} ${[
    ...flags,
    "[--help]",
  ].join(" ")}`;

  try {
    const { values } = parseNodeArgs({
      args: argv,
      options: {
        ...Object.fromEntries(options.map((name) => [name, { type: "string" }])),
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: false,
    });

    if (values.help) {
      console.log(usage);
      process.exit(0);
    }

    for (const name of options) {
      if (values[name] !== undefined && !values[name].trim()) {
        throw new Error(`--${name} requires a non-empty value`);
      }
    }
    for (const name of required) {
      if (values[name] === undefined) {
        throw new Error(`--${name} is required`);
      }
    }
    return values;
  } catch (error) {
    throw new Error(`${error.message}\n${usage}`);
  }
}

module.exports = { parseArgs };

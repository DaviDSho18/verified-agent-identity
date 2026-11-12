const assert = require("node:assert/strict");
const { test } = require("node:test");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, readdirSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseArgs } = require("../shared/cli");

const schema = { options: ["did", "token"], required: ["did", "token"] };

test("parses separate and equals-form values, preserving JSON and spaces", () => {
  const challenge = '{"name":"My Agent","description":"A helpful agent"}';
  const args = parseArgs({ options: ["challenge", "did"] }, [
    "--challenge", challenge, "--did=did:example:123",
  ]);
  assert.equal(args.challenge, challenge);
  assert.equal(args.did, "did:example:123");
});

test("rejects missing values, blank values, typos, and positional arguments", () => {
  for (const argv of [
    ["--key"], ["--key", "--help"], ["--key="],
    ["--key", "   "], ["--ky", "example"], ["example"],
  ]) {
    assert.throws(() => parseArgs({ options: ["key"] }, argv), /Usage:/);
  }
  assert.throws(() => parseArgs(schema, ["--did", "--token", "example"]), /Usage:/);
});

test("requires both DID and token for signature verification", () => {
  assert.throws(() => parseArgs(schema, ["--token", "example"]), /--did is required/);
  assert.throws(() => parseArgs(schema, ["--did", "did:example:123"]), /--token is required/);
});

const commands = [
  "createNewEthereumIdentity", "getIdentities", "getDidDocument",
  "generateChallenge", "signChallenge", "verifySignature",
  "linkHumanToAgent", "manualLinkHumanToAgent",
];

function runInEmptyHome(t, command, args) {
  const home = mkdtempSync(path.join(os.tmpdir(), "identity-cli-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [
    path.join(__dirname, "..", `${command}.js`), ...args,
  ], {
    env: { ...process.env, HOME: home },
    encoding: "utf8",
    timeout: 15000,
  });
  assert.ifError(result.error);
  assert.deepEqual(readdirSync(home), [], "must not initialize identity storage");
  return result;
}

for (const command of commands) {
  test(`${command}: --help and -h succeed without identity storage`, (t) => {
    for (const flag of ["--help", "-h"]) {
      const result = runInEmptyHome(t, command, [flag]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, new RegExp(`Usage: node scripts/${command}\\.js`));
      assert.equal(result.stderr, "");
    }
  });
}

test("identity creation rejects malformed options instead of creating an identity", (t) => {
  for (const args of [["--key"], ["--ky", "example"], ["--key="]]) {
    const result = runInEmptyHome(t, "createNewEthereumIdentity", args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Usage: node scripts\/createNewEthereumIdentity\.js/);
  }
});

test("verification explains missing DID before opening storage or resolving a DID", (t) => {
  const result = runInEmptyHome(t, "verifySignature", ["--token", "example"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--did is required/);
  assert.doesNotMatch(result.stderr, /No challenge found/);
});

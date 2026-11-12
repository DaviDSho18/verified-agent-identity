const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { KeysFileStorage } = require("../shared/storage/keys");

const MASTER_KEY = "test-only-master-key";
const FIRST_KEY = "ab".repeat(32);
const SECOND_KEY = "cd".repeat(32);

async function setup(t, masterKey) {
  const previous = process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "billions-keys-test-"));
  t.after(async () => {
    if (previous === undefined) {
      delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
    } else {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = previous;
    }
    await fs.rm(directory, { recursive: true, force: true });
  });
  if (masterKey === undefined) {
    delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
  } else {
    process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = masterKey;
  }

  const storage = new KeysFileStorage();
  // Never read or write the user's identity directory.
  storage.filePath = path.join(directory, "nested", "kms.json");
  const seed = async (value) => {
    await fs.mkdir(path.dirname(storage.filePath), { recursive: true });
    await fs.writeFile(storage.filePath, JSON.stringify(value));
  };
  const readRaw = () => fs.readFile(storage.filePath, "utf8");
  const readEntries = async () => JSON.parse(await readRaw());
  const reopen = () => {
    const reopened = new KeysFileStorage();
    reopened.filePath = storage.filePath;
    return reopened;
  };
  return { storage, seed, readRaw, readEntries, reopen };
}

test("a fresh store persists and updates plaintext keys without duplicating aliases", async (t) => {
  const { storage, readEntries, reopen } = await setup(t);
  assert.deepEqual(await storage.list(), []);
  assert.equal(await storage.get({ alias: "missing" }), "");

  await storage.importKey({ alias: "agent", key: FIRST_KEY });
  const [original] = await readEntries();
  assert.equal(original.version, 1);
  assert.equal(original.provider, "plain");
  assert.equal(original.data.key, FIRST_KEY);
  assert.ok(Number.isFinite(Date.parse(original.data.createdAt)));

  await storage.importKey({ alias: "agent", key: SECOND_KEY });
  const entries = await readEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].data.createdAt, original.data.createdAt);
  assert.equal(await reopen().get({ alias: "agent" }), SECOND_KEY);
  assert.deepEqual(await reopen().list(), [{ alias: "agent", key: SECOND_KEY }]);
});

test("encrypted keys stay encrypted on disk and can be retrieved after reopening", async (t) => {
  const { storage, readRaw, readEntries, reopen } = await setup(t, MASTER_KEY);
  await storage.importKey({ alias: "agent", key: FIRST_KEY });
  const [original] = await readEntries();
  assert.equal(original.provider, "encrypted");
  assert.equal(original.version, 1);
  assert.equal((await readRaw()).includes(FIRST_KEY), false);
  assert.equal(await reopen().get({ alias: "agent" }), FIRST_KEY);

  await reopen().importKey({ alias: "agent", key: SECOND_KEY });
  const entries = await readEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].provider, "encrypted");
  assert.equal(entries[0].data.createdAt, original.data.createdAt);
  assert.equal((await readRaw()).includes(SECOND_KEY), false);
  assert.deepEqual(await reopen().list(), [{ alias: "agent", key: SECOND_KEY }]);
});

test("writing migrates legacy and versioned plaintext keys to encrypted entries", async (t) => {
  const { storage, seed, readEntries, reopen } = await setup(t, MASTER_KEY);
  const createdAt = "2025-01-01T00:00:00.000Z";
  await seed([
    { alias: "legacy", privateKeyHex: FIRST_KEY },
    { version: 1, provider: "plain", data: { alias: "plain", key: SECOND_KEY, createdAt } },
  ]);
  assert.equal(await storage.get({ alias: "legacy" }), FIRST_KEY);
  await storage.importKey({ alias: "new", key: FIRST_KEY });

  const entries = await readEntries();
  assert.equal(entries.length, 3);
  for (const entry of entries) {
    assert.equal(entry.version, 1);
    assert.equal(entry.provider, "encrypted");
    assert.equal(Object.hasOwn(entry, "privateKeyHex"), false);
  }
  assert.equal(entries.find((entry) => entry.data.alias === "plain").data.createdAt, createdAt);
  assert.deepEqual(await reopen().list(), [
    { alias: "legacy", key: FIRST_KEY },
    { alias: "plain", key: SECOND_KEY },
    { alias: "new", key: FIRST_KEY },
  ]);
});

test("without a master key, encrypted entries remain hidden and survive unrelated writes", async (t) => {
  const { storage, readEntries, reopen } = await setup(t, MASTER_KEY);
  await storage.importKey({ alias: "locked", key: FIRST_KEY });
  const [encrypted] = await readEntries();

  delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
  const withoutKey = reopen();
  assert.equal(await withoutKey.get({ alias: "locked" }), "");
  assert.deepEqual(await withoutKey.list(), []);
  await withoutKey.importKey({ alias: "new", key: SECOND_KEY });
  await withoutKey.importKey({ alias: "new", key: FIRST_KEY });

  const entries = await readEntries();
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.find((entry) => entry.data.alias === "locked"), encrypted);
  assert.equal(entries.find((entry) => entry.data.alias === "new").provider, "plain");
  process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = MASTER_KEY;
  assert.equal(await reopen().get({ alias: "locked" }), FIRST_KEY);
});

test("explicitly replacing an opaque alias removes the old encrypted entry only", async (t) => {
  const { storage, readEntries, reopen } = await setup(t, MASTER_KEY);
  await storage.importKey({ alias: "replace", key: FIRST_KEY });
  await storage.importKey({ alias: "keep", key: FIRST_KEY });
  const preserved = (await readEntries()).find((entry) => entry.data.alias === "keep");

  delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
  await reopen().importKey({ alias: "replace", key: SECOND_KEY });
  const entries = await readEntries();
  assert.equal(entries.length, 2);
  assert.equal(await reopen().get({ alias: "replace" }), SECOND_KEY);
  assert.deepEqual(entries.find((entry) => entry.data.alias === "keep"), preserved);
  process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = MASTER_KEY;
  assert.equal(await reopen().get({ alias: "replace" }), SECOND_KEY);
  assert.equal(await reopen().get({ alias: "keep" }), FIRST_KEY);
});

test("a wrong master key fails reads and imports without overwriting existing data", async (t) => {
  const { storage, readRaw, reopen } = await setup(t, MASTER_KEY);
  await storage.importKey({ alias: "agent", key: FIRST_KEY });
  const before = await readRaw();

  process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "incorrect-test-master-key";
  await assert.rejects(reopen().get({ alias: "agent" }), /kms\.json decryption failed/);
  await assert.rejects(
    reopen().importKey({ alias: "new", key: SECOND_KEY }),
    /kms\.json decryption failed/,
  );
  assert.equal(await readRaw(), before);
});

test("corrupt JSON and invalid root data fail imports without resetting the key store", async (t) => {
  const { storage, seed, readRaw } = await setup(t);
  await seed({ unexpected: "object" });
  const invalidRoot = await readRaw();
  await assert.rejects(storage.importKey({ alias: "new", key: FIRST_KEY }), /kms\.json root must be an array/);
  assert.equal(await readRaw(), invalidRoot);

  await fs.writeFile(storage.filePath, "[{broken");
  await assert.rejects(storage.importKey({ alias: "new", key: FIRST_KEY }), SyntaxError);
  assert.equal(await readRaw(), "[{broken");
});

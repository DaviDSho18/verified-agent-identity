const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  getMasterKey,
  encryptKey,
  decryptKey,
} = require("../shared/storage/crypto");

const MASTER_KEY = "test-only-master-key";
const PRIVATE_KEY = "ab".repeat(32);

test("master key configuration rejects absent or short values and trims valid ones", (t) => {
  const previous = process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
    } else {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = previous;
    }
  });

  delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
  assert.equal(getMasterKey(), null);
  for (const value of ["", "   ", "a".repeat(15), `  ${"a".repeat(15)}  `]) {
    process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = value;
    assert.equal(getMasterKey(), null);
  }
  process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = `  ${"a".repeat(16)} \n`;
  assert.equal(getMasterKey(), "a".repeat(16));
});

test("encryption round-trips key bytes and uses a fresh IV for each write", () => {
  const first = encryptKey(PRIVATE_KEY, MASTER_KEY);
  const second = encryptKey(PRIVATE_KEY, MASTER_KEY);

  assert.match(first, /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
  assert.notEqual(first.split(":")[0], second.split(":")[0]);
  assert.equal(decryptKey(first, MASTER_KEY), PRIVATE_KEY);
  assert.equal(decryptKey(second, MASTER_KEY), PRIVATE_KEY);
});

test("decryption rejects the wrong master key", () => {
  const encrypted = encryptKey(PRIVATE_KEY, MASTER_KEY);
  assert.throws(
    () => decryptKey(encrypted, "different-test-master-key"),
    /kms\.json decryption failed: wrong BILLIONS_NETWORK_MASTER_KMS_KEY or file has been tampered with/,
  );
});

for (const [index, field] of ["IV", "authentication tag", "ciphertext"].entries()) {
  test(`decryption rejects a modified ${field}`, () => {
    const parts = encryptKey(PRIVATE_KEY, MASTER_KEY).split(":");
    const bytes = Buffer.from(parts[index], "hex");
    bytes[0] ^= 1;
    parts[index] = bytes.toString("hex");

    assert.throws(
      () => decryptKey(parts.join(":"), MASTER_KEY),
      /kms\.json decryption failed/,
    );
  });
}

test("decryption rejects payloads with missing or extra components", () => {
  for (const payload of ["", "aa:bb", "aa:bb:cc:dd"]) {
    assert.throws(
      () => decryptKey(payload, MASTER_KEY),
      /Invalid encrypted key format in kms\.json/,
    );
  }
});

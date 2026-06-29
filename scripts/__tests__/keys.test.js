"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { KeysFileStorage } = require("../shared/storage/keys");

describe("KeysFileStorage", () => {
  let tmpDir;
  let storage;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "keys-test-"));
    storage = new KeysFileStorage("kms.json");
    storage.filePath = path.join(tmpDir, "kms.json");
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("readFile (plain provider)", () => {
    it("returns empty array when file does not exist", async () => {
      const result = await storage.readFile();
      expect(result).toEqual([]);
    });

    it("reads v1 plain entries", async () => {
      const data = [
        {
          version: 1,
          provider: "plain",
          data: {
            alias: "secp256k1:key1",
            key: "deadbeef1234",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
      ];
      await fs.writeFile(storage.filePath, JSON.stringify(data), "utf-8");

      const result = await storage.readFile();
      expect(result).toHaveLength(1);
      expect(result[0].alias).toBe("secp256k1:key1");
      expect(result[0].privateKeyHex).toBe("deadbeef1234");
      expect(result[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("reads legacy format entries", async () => {
      const data = [{ alias: "secp256k1:legacy", privateKeyHex: "abcdef" }];
      await fs.writeFile(storage.filePath, JSON.stringify(data), "utf-8");

      const result = await storage.readFile();
      expect(result).toHaveLength(1);
      expect(result[0].alias).toBe("secp256k1:legacy");
      expect(result[0].privateKeyHex).toBe("abcdef");
    });

    it("throws when root is not an array", async () => {
      await fs.writeFile(storage.filePath, JSON.stringify({}), "utf-8");
      await expect(storage.readFile()).rejects.toThrow(
        "kms.json root must be an array"
      );
    });
  });

  describe("readFile (encrypted provider)", () => {
    it("marks encrypted entries as opaque when master key is not set", async () => {
      const data = [
        {
          version: 1,
          provider: "encrypted",
          data: {
            alias: "secp256k1:enc1",
            key: "aabb:ccdd:eeff",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
      ];
      await fs.writeFile(storage.filePath, JSON.stringify(data), "utf-8");

      const result = await storage.readFile();
      // Encrypted entries without master key are filtered out
      expect(result).toHaveLength(0);
    });

    it("decrypts entries when master key is set", async () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY =
        "test-master-key-for-testing";

      // First write a plain entry and then encrypt it via writeFile
      const plainStorage = new KeysFileStorage("kms.json");
      plainStorage.filePath = path.join(tmpDir, "kms.json");

      await plainStorage.writeFile([
        {
          alias: "secp256k1:key1",
          privateKeyHex: "myPrivateKey123",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);

      // Read it back
      const freshStorage = new KeysFileStorage("kms.json");
      freshStorage.filePath = path.join(tmpDir, "kms.json");
      const result = await freshStorage.readFile();

      expect(result).toHaveLength(1);
      expect(result[0].alias).toBe("secp256k1:key1");
      expect(result[0].privateKeyHex).toBe("myPrivateKey123");
    });
  });

  describe("writeFile", () => {
    it("writes entries in v1 plain format when no master key", async () => {
      await storage.writeFile([
        {
          alias: "secp256k1:key1",
          privateKeyHex: "aabbcc",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);

      const raw = JSON.parse(
        await fs.readFile(storage.filePath, "utf-8")
      );
      expect(raw[0].version).toBe(1);
      expect(raw[0].provider).toBe("plain");
      expect(raw[0].data.alias).toBe("secp256k1:key1");
      expect(raw[0].data.key).toBe("aabbcc");
    });

    it("writes entries in encrypted format when master key is set", async () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY =
        "test-master-key-for-testing";
      const encStorage = new KeysFileStorage("kms.json");
      encStorage.filePath = path.join(tmpDir, "kms.json");

      await encStorage.writeFile([
        {
          alias: "secp256k1:key1",
          privateKeyHex: "secret123",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]);

      const raw = JSON.parse(
        await fs.readFile(encStorage.filePath, "utf-8")
      );
      expect(raw[0].version).toBe(1);
      expect(raw[0].provider).toBe("encrypted");
      expect(raw[0].data.key).toContain(":");
      expect(raw[0].data.key).not.toBe("secret123");
    });

    it("preserves opaque entries through round-trip", async () => {
      const encryptedEntry = {
        version: 1,
        provider: "encrypted",
        data: {
          alias: "secp256k1:opaque1",
          key: "aabb:ccdd:eeff",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      };
      const plainEntry = {
        version: 1,
        provider: "plain",
        data: {
          alias: "secp256k1:plain1",
          key: "1234",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      };

      await fs.writeFile(
        storage.filePath,
        JSON.stringify([encryptedEntry, plainEntry]),
        "utf-8"
      );

      // Read (without master key, encrypted entry becomes opaque)
      const decoded = await storage.readFile();
      expect(decoded).toHaveLength(1); // only plain one is visible

      // Write back (should preserve the opaque encrypted entry)
      await storage.writeFile(decoded);

      const raw = JSON.parse(
        await fs.readFile(storage.filePath, "utf-8")
      );
      expect(raw).toHaveLength(2);
      expect(raw[1]).toEqual(encryptedEntry);
    });
  });

  describe("importKey", () => {
    it("adds a new key", async () => {
      await storage.importKey({ alias: "secp256k1:new", key: "newkey123" });

      const keys = await storage.readFile();
      expect(keys).toHaveLength(1);
      expect(keys[0].alias).toBe("secp256k1:new");
      expect(keys[0].privateKeyHex).toBe("newkey123");
      expect(keys[0].createdAt).toBeDefined();
    });

    it("updates existing key by alias", async () => {
      await storage.importKey({ alias: "secp256k1:key1", key: "original" });
      await storage.importKey({ alias: "secp256k1:key1", key: "updated" });

      const keys = await storage.readFile();
      expect(keys).toHaveLength(1);
      expect(keys[0].privateKeyHex).toBe("updated");
    });

    it("removes opaque entry with same alias on import", async () => {
      // Simulate having an opaque entry
      const encEntry = {
        version: 1,
        provider: "encrypted",
        data: {
          alias: "secp256k1:key1",
          key: "aa:bb:cc",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      };
      await fs.writeFile(
        storage.filePath,
        JSON.stringify([encEntry]),
        "utf-8"
      );

      // Read to populate _opaqueEntries
      await storage.readFile();
      expect(storage._opaqueEntries).toHaveLength(1);

      // Import key with same alias
      await storage.importKey({ alias: "secp256k1:key1", key: "newplain" });

      const keys = await storage.readFile();
      expect(keys).toHaveLength(1);
      expect(keys[0].privateKeyHex).toBe("newplain");
    });
  });

  describe("get", () => {
    it("returns key value for existing alias", async () => {
      await storage.importKey({ alias: "secp256k1:key1", key: "abc123" });

      const result = await storage.get({ alias: "secp256k1:key1" });
      expect(result).toBe("abc123");
    });

    it("returns empty string for nonexistent alias", async () => {
      const result = await storage.get({ alias: "secp256k1:missing" });
      expect(result).toBe("");
    });
  });

  describe("list", () => {
    it("returns empty array when no keys stored", async () => {
      const result = await storage.list();
      expect(result).toEqual([]);
    });

    it("returns alias and key for all stored keys", async () => {
      await storage.importKey({ alias: "secp256k1:a", key: "key-a" });
      await storage.importKey({ alias: "secp256k1:b", key: "key-b" });

      const result = await storage.list();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ alias: "secp256k1:a", key: "key-a" });
      expect(result[1]).toEqual({ alias: "secp256k1:b", key: "key-b" });
    });
  });
});

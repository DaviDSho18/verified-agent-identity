"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { DidsFileStorage } = require("../shared/storage/did");

describe("DidsFileStorage", () => {
  let tmpDir;
  let storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "did-test-"));
    storage = new DidsFileStorage("defaultDid.json");
    storage.filePath = path.join(tmpDir, "defaultDid.json");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("save", () => {
    it("saves a new DID entry", async () => {
      await storage.save({
        did: "did:iden3:test:123",
        publicKeyHex: "0x04abc",
        isDefault: false,
      });

      const entries = await storage.readFile();
      expect(entries).toHaveLength(1);
      expect(entries[0].did).toBe("did:iden3:test:123");
      expect(entries[0].publicKeyHex).toBe("0x04abc");
      expect(entries[0].isDefault).toBe(false);
    });

    it("updates existing DID entry", async () => {
      await storage.save({
        did: "did:iden3:test:123",
        publicKeyHex: "0x04abc",
        isDefault: false,
      });
      await storage.save({
        did: "did:iden3:test:123",
        publicKeyHex: "0x04xyz",
        isDefault: true,
      });

      const entries = await storage.readFile();
      expect(entries).toHaveLength(1);
      expect(entries[0].publicKeyHex).toBe("0x04xyz");
      expect(entries[0].isDefault).toBe(true);
    });

    it("unsets other defaults when saving with isDefault=true", async () => {
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0x01",
        isDefault: true,
      });
      await storage.save({
        did: "did:iden3:test:2",
        publicKeyHex: "0x02",
        isDefault: true,
      });

      const entries = await storage.readFile();
      expect(entries).toHaveLength(2);
      expect(entries[0].isDefault).toBe(false);
      expect(entries[1].isDefault).toBe(true);
    });

    it("does not unset others when isDefault=false", async () => {
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0x01",
        isDefault: true,
      });
      await storage.save({
        did: "did:iden3:test:2",
        publicKeyHex: "0x02",
        isDefault: false,
      });

      const entries = await storage.readFile();
      expect(entries[0].isDefault).toBe(true);
      expect(entries[1].isDefault).toBe(false);
    });
  });

  describe("find", () => {
    it("returns entry when DID exists", async () => {
      await storage.save({
        did: "did:iden3:test:123",
        publicKeyHex: "0x04abc",
        isDefault: false,
      });

      const result = await storage.find("did:iden3:test:123");
      expect(result.did).toBe("did:iden3:test:123");
      expect(result.publicKeyHex).toBe("0x04abc");
    });

    it("returns undefined when DID does not exist", async () => {
      const result = await storage.find("did:iden3:test:missing");
      expect(result).toBeUndefined();
    });
  });

  describe("getDefault", () => {
    it("returns the default DID entry", async () => {
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0x01",
        isDefault: false,
      });
      await storage.save({
        did: "did:iden3:test:2",
        publicKeyHex: "0x02",
        isDefault: true,
      });

      const result = await storage.getDefault();
      expect(result.did).toBe("did:iden3:test:2");
    });

    it("returns undefined when no default is set", async () => {
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0x01",
        isDefault: false,
      });

      const result = await storage.getDefault();
      expect(result).toBeUndefined();
    });

    it("returns undefined when storage is empty", async () => {
      const result = await storage.getDefault();
      expect(result).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns empty array when no entries", async () => {
      const result = await storage.list();
      expect(result).toEqual([]);
    });

    it("returns all DID entries", async () => {
      await storage.save({
        did: "did:iden3:test:1",
        publicKeyHex: "0x01",
        isDefault: true,
      });
      await storage.save({
        did: "did:iden3:test:2",
        publicKeyHex: "0x02",
        isDefault: false,
      });

      const result = await storage.list();
      expect(result).toHaveLength(2);
    });
  });
});

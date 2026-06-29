"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { ChallengeFileStorage } = require("../shared/storage/challenge");

describe("ChallengeFileStorage", () => {
  let tmpDir;
  let storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "challenge-test-"));
    storage = new ChallengeFileStorage("challenges.json");
    // Override the file path to use our temp directory
    storage.filePath = path.join(tmpDir, "challenges.json");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("save", () => {
    it("saves a new challenge entry", async () => {
      await storage.save("did:test:123", "challenge-abc");

      const entries = await storage.readFile();
      expect(entries).toHaveLength(1);
      expect(entries[0].did).toBe("did:test:123");
      expect(entries[0].challenge).toBe("challenge-abc");
      expect(entries[0].created_at).toBeDefined();
    });

    it("updates existing challenge for same DID", async () => {
      await storage.save("did:test:123", "challenge-1");
      await storage.save("did:test:123", "challenge-2");

      const entries = await storage.readFile();
      expect(entries).toHaveLength(1);
      expect(entries[0].challenge).toBe("challenge-2");
    });

    it("saves multiple challenges for different DIDs", async () => {
      await storage.save("did:test:1", "challenge-a");
      await storage.save("did:test:2", "challenge-b");
      await storage.save("did:test:3", "challenge-c");

      const entries = await storage.readFile();
      expect(entries).toHaveLength(3);
    });
  });

  describe("find", () => {
    it("returns entry when DID exists", async () => {
      await storage.save("did:test:123", "my-challenge");

      const result = await storage.find("did:test:123");
      expect(result.did).toBe("did:test:123");
      expect(result.challenge).toBe("my-challenge");
    });

    it("returns undefined when DID does not exist", async () => {
      const result = await storage.find("did:test:nonexistent");
      expect(result).toBeUndefined();
    });
  });

  describe("getChallenge", () => {
    it("returns challenge string when DID exists", async () => {
      await storage.save("did:test:123", "the-challenge");

      const result = await storage.getChallenge("did:test:123");
      expect(result).toBe("the-challenge");
    });

    it("returns undefined when DID does not exist", async () => {
      const result = await storage.getChallenge("did:test:missing");
      expect(result).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns empty array when no challenges saved", async () => {
      const result = await storage.list();
      expect(result).toEqual([]);
    });

    it("returns all saved challenges", async () => {
      await storage.save("did:test:1", "c1");
      await storage.save("did:test:2", "c2");

      const result = await storage.list();
      expect(result).toHaveLength(2);
    });
  });

  describe("delete", () => {
    it("returns true and removes entry when DID exists", async () => {
      await storage.save("did:test:123", "challenge");

      const result = await storage.delete("did:test:123");
      expect(result).toBe(true);

      const entries = await storage.list();
      expect(entries).toHaveLength(0);
    });

    it("returns false when DID does not exist", async () => {
      await storage.save("did:test:123", "challenge");

      const result = await storage.delete("did:test:nonexistent");
      expect(result).toBe(false);

      const entries = await storage.list();
      expect(entries).toHaveLength(1);
    });

    it("only removes the targeted DID", async () => {
      await storage.save("did:test:1", "c1");
      await storage.save("did:test:2", "c2");
      await storage.save("did:test:3", "c3");

      await storage.delete("did:test:2");

      const entries = await storage.list();
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.did)).toEqual(["did:test:1", "did:test:3"]);
    });
  });
});

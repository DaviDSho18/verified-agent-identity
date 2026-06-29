"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { IdentitiesFileStorage } = require("../shared/storage/identities");

describe("IdentitiesFileStorage", () => {
  let tmpDir;
  let storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "identities-test-"));
    storage = new IdentitiesFileStorage("identities.json");
    storage.filePath = path.join(tmpDir, "identities.json");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("load", () => {
    it("returns empty array when file does not exist", async () => {
      const result = await storage.load();
      expect(result).toEqual([]);
    });

    it("returns stored data", async () => {
      const data = [{ id: "item-1", value: "test" }];
      await fs.writeFile(storage.filePath, JSON.stringify(data), "utf-8");

      const result = await storage.load();
      expect(result).toEqual(data);
    });
  });

  describe("save", () => {
    it("adds a new item", async () => {
      await storage.save("item-1", { id: "item-1", value: "hello" });

      const data = await storage.load();
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual({ id: "item-1", value: "hello" });
    });

    it("updates existing item by key", async () => {
      await storage.save("item-1", { id: "item-1", value: "v1" });
      await storage.save("item-1", { id: "item-1", value: "v2" });

      const data = await storage.load();
      expect(data).toHaveLength(1);
      expect(data[0].value).toBe("v2");
    });

    it("uses custom keyName for matching", async () => {
      await storage.save("abc", { uid: "abc", name: "first" }, "uid");
      await storage.save("abc", { uid: "abc", name: "updated" }, "uid");

      const data = await storage.load();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("updated");
    });

    it("adds multiple items with different keys", async () => {
      await storage.save("item-1", { id: "item-1", value: "a" });
      await storage.save("item-2", { id: "item-2", value: "b" });
      await storage.save("item-3", { id: "item-3", value: "c" });

      const data = await storage.load();
      expect(data).toHaveLength(3);
    });
  });

  describe("get", () => {
    it("returns item when key exists", async () => {
      await storage.save("item-1", { id: "item-1", value: "test" });

      const result = await storage.get("item-1");
      expect(result).toEqual({ id: "item-1", value: "test" });
    });

    it("returns undefined when key does not exist", async () => {
      const result = await storage.get("nonexistent");
      expect(result).toBeUndefined();
    });

    it("uses custom keyName for lookup", async () => {
      await storage.save("xyz", { uid: "xyz", data: 42 }, "uid");

      const result = await storage.get("xyz", "uid");
      expect(result).toEqual({ uid: "xyz", data: 42 });
    });
  });

  describe("delete", () => {
    it("removes item when key exists", async () => {
      await storage.save("item-1", { id: "item-1", value: "a" });
      await storage.save("item-2", { id: "item-2", value: "b" });

      await storage.delete("item-1");

      const data = await storage.load();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("item-2");
    });

    it("throws when key does not exist", async () => {
      await storage.save("item-1", { id: "item-1", value: "a" });

      await expect(storage.delete("nonexistent")).rejects.toThrow(
        "Item with id=nonexistent not found"
      );
    });

    it("uses custom keyName for deletion", async () => {
      await storage.save("abc", { uid: "abc", name: "test" }, "uid");

      await storage.delete("abc", "uid");

      const data = await storage.load();
      expect(data).toHaveLength(0);
    });

    it("throws with custom keyName when not found", async () => {
      await expect(storage.delete("missing", "uid")).rejects.toThrow(
        "Item with uid=missing not found"
      );
    });
  });
});

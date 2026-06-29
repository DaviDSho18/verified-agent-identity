"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { FileStorage } = require("../shared/storage/base");

describe("FileStorage", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "filestorage-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates directory and writes file", async () => {
    const storage = new FileStorage("test.json", tmpDir);
    const data = [{ id: 1, name: "test" }];
    await storage.writeFile(data);

    const content = await fs.readFile(path.join(tmpDir, "test.json"), "utf-8");
    expect(JSON.parse(content)).toEqual(data);
  });

  it("reads existing file", async () => {
    const filePath = path.join(tmpDir, "test.json");
    const data = [{ id: 1 }, { id: 2 }];
    await fs.writeFile(filePath, JSON.stringify(data), "utf-8");

    const storage = new FileStorage("test.json", tmpDir);
    const result = await storage.readFile();
    expect(result).toEqual(data);
  });

  it("returns empty array when file does not exist", async () => {
    const storage = new FileStorage("nonexistent.json", tmpDir);
    const result = await storage.readFile();
    expect(result).toEqual([]);
  });

  it("throws on malformed JSON", async () => {
    const filePath = path.join(tmpDir, "bad.json");
    await fs.writeFile(filePath, "not valid json{{{", "utf-8");

    const storage = new FileStorage("bad.json", tmpDir);
    await expect(storage.readFile()).rejects.toThrow();
  });

  it("creates nested directories if needed", async () => {
    const nestedDir = path.join(tmpDir, "nested", "deep");
    const storage = new FileStorage("data.json", nestedDir);
    await storage.writeFile({ hello: "world" });

    const content = await fs.readFile(path.join(nestedDir, "data.json"), "utf-8");
    expect(JSON.parse(content)).toEqual({ hello: "world" });
  });

  it("overwrites existing file atomically", async () => {
    const storage = new FileStorage("test.json", tmpDir);
    await storage.writeFile([1, 2, 3]);
    await storage.writeFile([4, 5, 6]);

    const result = await storage.readFile();
    expect(result).toEqual([4, 5, 6]);
  });

  it("temp file is cleaned up after write", async () => {
    const storage = new FileStorage("test.json", tmpDir);
    await storage.writeFile([1]);

    const files = await fs.readdir(tmpDir);
    expect(files).not.toContain("test.json.tmp");
    expect(files).toContain("test.json");
  });
});

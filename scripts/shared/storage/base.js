const fs = require("fs/promises");
const path = require("path");

class FileStorage {
  constructor(filename, baseDir = `${process.env.HOME}/.openclaw/billions`) {
    this.filePath = path.join(baseDir, filename);
  }

  async ensureDirectory() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  }

  async readFile() {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async writeFile(data) {
    await this.ensureDirectory();
    const json = JSON.stringify(data, null, 2);
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, json, { encoding: "utf-8", mode: 0o600 });
    await fs.rename(tempPath, this.filePath);
  }
}

module.exports = { FileStorage };

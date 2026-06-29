const { FileStorage } = require("./base");

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class ChallengeFileStorage extends FileStorage {
  constructor(filename = "challenges.json") {
    super(filename);
  }

  async save(did, challenge) {
    const entries = await this.readFile();
    const created_at = new Date().toISOString();

    const index = entries.findIndex((entry) => entry.did === did);

    if (index >= 0) {
      entries[index] = { did, challenge, created_at };
    } else {
      entries.push({ did, challenge, created_at });
    }

    await this.writeFile(entries);
  }

  async find(did) {
    const entries = await this.readFile();
    return entries.find((entry) => entry.did === did);
  }

  async getChallenge(did) {
    const entry = await this.find(did);
    if (!entry) {
      return undefined;
    }
    const age = Date.now() - new Date(entry.created_at).getTime();
    if (age > CHALLENGE_TTL_MS) {
      await this.delete(did);
      return undefined;
    }
    return entry.challenge;
  }

  async consumeChallenge(did) {
    const challenge = await this.getChallenge(did);
    if (challenge) {
      await this.delete(did);
    }
    return challenge;
  }

  async list() {
    return this.readFile();
  }

  async delete(did) {
    const entries = await this.readFile();
    const initialLength = entries.length;
    const filtered = entries.filter((entry) => entry.did !== did);

    if (filtered.length < initialLength) {
      await this.writeFile(filtered);
      return true;
    }

    return false;
  }
}

module.exports = { ChallengeFileStorage };

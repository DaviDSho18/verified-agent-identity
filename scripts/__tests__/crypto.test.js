"use strict";

const { getMasterKey, encryptKey, decryptKey } = require("../shared/storage/crypto");

describe("crypto", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getMasterKey", () => {
    it("returns null when env var is not set", () => {
      delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when env var is empty string", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "";
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when env var is whitespace only", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "          ";
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when env var is shorter than 16 characters", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "short";
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when trimmed value is shorter than 16 characters", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "   short   ";
      expect(getMasterKey()).toBeNull();
    });

    it("returns trimmed key when env var is valid (>= 16 chars)", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "  my-secret-master-key-1234  ";
      expect(getMasterKey()).toBe("my-secret-master-key-1234");
    });

    it("returns key when exactly 16 characters", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "1234567890123456";
      expect(getMasterKey()).toBe("1234567890123456");
    });
  });

  describe("encryptKey / decryptKey", () => {
    const masterKey = "test-master-key-for-encryption";
    const plaintext = "deadbeef1234567890abcdef";

    it("encrypts and decrypts back to original value", () => {
      const encrypted = encryptKey(plaintext, masterKey);
      const decrypted = decryptKey(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertexts for same input (random IV)", () => {
      const encrypted1 = encryptKey(plaintext, masterKey);
      const encrypted2 = encryptKey(plaintext, masterKey);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("encrypted format is iv:authTag:ciphertext (3 hex parts)", () => {
      const encrypted = encryptKey(plaintext, masterKey);
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
      // IV is 12 bytes = 24 hex chars
      expect(parts[0]).toHaveLength(24);
      // AuthTag is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // Ciphertext is non-empty
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it("throws on invalid encrypted format (missing parts)", () => {
      expect(() => decryptKey("onlyonepart", masterKey)).toThrow(
        "Invalid encrypted key format in kms.json"
      );
    });

    it("throws on wrong master key", () => {
      const encrypted = encryptKey(plaintext, masterKey);
      expect(() => decryptKey(encrypted, "wrong-master-key-different")).toThrow(
        "kms.json decryption failed"
      );
    });

    it("throws on tampered ciphertext", () => {
      const encrypted = encryptKey(plaintext, masterKey);
      const parts = encrypted.split(":");
      // Tamper with ciphertext
      parts[2] = "ff".repeat(parts[2].length / 2);
      const tampered = parts.join(":");
      expect(() => decryptKey(tampered, masterKey)).toThrow(
        "kms.json decryption failed"
      );
    });

    it("handles empty string as plaintext", () => {
      const encrypted = encryptKey("", masterKey);
      const decrypted = decryptKey(encrypted, masterKey);
      expect(decrypted).toBe("");
    });

    it("handles long plaintext", () => {
      const longText = "a".repeat(1000);
      const encrypted = encryptKey(longText, masterKey);
      const decrypted = decryptKey(encrypted, masterKey);
      expect(decrypted).toBe(longText);
    });
  });
});

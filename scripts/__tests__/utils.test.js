"use strict";

// Mock external dependencies that use ESM internally
jest.mock("@0xpolygonid/js-sdk", () => ({
  bytesToHex: (bytes) =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  keyPath: (keyType, keyID) => `${keyType}:${keyID}`,
  PROTOCOL_CONSTANTS: {
    PROTOCOL_MESSAGE_TYPE: {
      AUTHORIZATION_RESPONSE_MESSAGE_TYPE:
        "https://iden3-communication.io/authorization/1.0/response",
    },
  },
}));

jest.mock("@iden3/js-iden3-core", () => ({
  DID: {
    parse: (did) => ({ string: () => did }),
    idFromDID: () => ({
      bigInt: () => BigInt(123),
    }),
  },
  Id: {
    ethAddressFromId: () => new Uint8Array(20).fill(0xab),
  },
}));

jest.mock("uuid", () => ({
  v7: () => "mock-uuid-v7",
}));

jest.mock("@noble/curves/secp256k1", () => ({
  secp256k1: {
    Point: {
      fromHex: () => ({
        toHex: () => "02compressed-point-hex",
      }),
    },
  },
}));

const {
  normalizeKey,
  addHexPrefix,
  parseArgs,
  formatError,
  outputSuccess,
  urlFormating,
  codeFormating,
  buildEthereumAddressFromDid,
  createDidDocument,
  normalizedKeyPath,
  getAuthResponseMessage,
} = require("../shared/utils");

describe("utils", () => {
  describe("normalizeKey", () => {
    it("removes 0x prefix when present", () => {
      expect(normalizeKey("0xdeadbeef")).toBe("deadbeef");
    });

    it("returns unchanged when no 0x prefix", () => {
      expect(normalizeKey("deadbeef")).toBe("deadbeef");
    });

    it("only removes leading 0x, not embedded", () => {
      expect(normalizeKey("0xab0xcd")).toBe("ab0xcd");
    });

    it("handles empty string after 0x", () => {
      expect(normalizeKey("0x")).toBe("");
    });
  });

  describe("addHexPrefix", () => {
    it("adds 0x prefix when missing", () => {
      expect(addHexPrefix("deadbeef")).toBe("0xdeadbeef");
    });

    it("does not double-add 0x prefix", () => {
      expect(addHexPrefix("0xdeadbeef")).toBe("0xdeadbeef");
    });

    it("handles empty string", () => {
      expect(addHexPrefix("")).toBe("0x");
    });
  });

  describe("parseArgs", () => {
    const originalArgv = process.argv;

    afterEach(() => {
      process.argv = originalArgv;
    });

    it("parses key-value pairs from command line", () => {
      process.argv = ["node", "script.js", "--did", "did:test:123", "--key", "abc"];
      const result = parseArgs();
      expect(result).toEqual({ did: "did:test:123", key: "abc" });
    });

    it("returns empty object when no args", () => {
      process.argv = ["node", "script.js"];
      const result = parseArgs();
      expect(result).toEqual({});
    });

    it("handles single argument", () => {
      process.argv = ["node", "script.js", "--name", "hello"];
      const result = parseArgs();
      expect(result).toEqual({ name: "hello" });
    });

    it("ignores non-prefixed arguments", () => {
      process.argv = ["node", "script.js", "--key", "value", "extra"];
      const result = parseArgs();
      expect(result).toEqual({ key: "value" });
    });
  });

  describe("formatError", () => {
    it("formats error with message", () => {
      const error = new Error("something went wrong");
      expect(formatError(error)).toBe("Error: something went wrong");
    });

    it("handles error with empty message", () => {
      const error = new Error("");
      expect(formatError(error)).toBe("Error: ");
    });
  });

  describe("outputSuccess", () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("outputs string directly", () => {
      outputSuccess("hello world");
      expect(consoleSpy).toHaveBeenCalledWith("hello world");
    });

    it("outputs object as formatted JSON", () => {
      outputSuccess({ key: "value" });
      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify({ key: "value" }, null, 2)
      );
    });

    it("outputs array as formatted JSON", () => {
      outputSuccess([1, 2, 3]);
      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify([1, 2, 3], null, 2)
      );
    });
  });

  describe("urlFormating", () => {
    it("formats as markdown link", () => {
      expect(urlFormating("Click here", "https://example.com")).toBe(
        "[Click here](https://example.com)"
      );
    });
  });

  describe("codeFormating", () => {
    it("wraps in escaped triple backticks", () => {
      expect(codeFormating("const x = 1")).toBe(
        "\\`\\`\\`const x = 1\\`\\`\\`"
      );
    });
  });

  describe("buildEthereumAddressFromDid", () => {
    it("returns an address with 0x prefix", () => {
      const result = buildEthereumAddressFromDid("did:iden3:test:123");
      expect(result.startsWith("0x")).toBe(true);
    });
  });

  describe("createDidDocument", () => {
    it("returns a valid DID document structure", () => {
      const result = createDidDocument("did:iden3:test:123", "0x04abcdef");

      expect(result["@context"]).toContain("https://www.w3.org/ns/did/v1");
      expect(result.id).toBe("did:iden3:test:123");
      expect(result.verificationMethod).toHaveLength(1);
      expect(result.verificationMethod[0].id).toBe(
        "did:iden3:test:123#ethereum-based-id"
      );
      expect(result.verificationMethod[0].controller).toBe("did:iden3:test:123");
      expect(result.verificationMethod[0].type).toBe(
        "EcdsaSecp256k1RecoveryMethod2020"
      );
      expect(result.authentication).toEqual([
        "did:iden3:test:123#ethereum-based-id",
      ]);
    });
  });

  describe("normalizedKeyPath", () => {
    it("normalizes the key ID and builds path", () => {
      const result = normalizedKeyPath("secp256k1", "0xabc");
      expect(result).toBe("secp256k1:abc");
    });

    it("passes through key without prefix unchanged", () => {
      const result = normalizedKeyPath("secp256k1", "abc");
      expect(result).toBe("secp256k1:abc");
    });
  });

  describe("getAuthResponseMessage", () => {
    it("returns a message with required fields", () => {
      const result = getAuthResponseMessage("did:iden3:test:123", "my-challenge");

      expect(result.id).toBe("mock-uuid-v7");
      expect(result.thid).toBe("mock-uuid-v7");
      expect(result.from).toBe("did:iden3:test:123");
      expect(result.to).toBe("");
      expect(result.type).toBe(
        "https://iden3-communication.io/authorization/1.0/response"
      );
      expect(result.body.message).toBe("my-challenge");
      expect(result.body.scope).toEqual([]);
    });
  });
});

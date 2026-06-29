"use strict";

// Mock @iden3/js-iden3-core which uses ESM-only dependencies
jest.mock("@iden3/js-iden3-core", () => ({
  DID: {
    parse: (did) => ({ string: () => did }),
    idFromDID: (parsed) => ({
      bigInt: () => BigInt("12345678901234567890"),
    }),
  },
}));

const { ethers } = require("ethers");

// Now we need to test attestation.js which uses DID from @iden3/js-iden3-core
// After mocking, we can require it
const {
  buildEncodedAttestation,
  computeAttestationHash,
  buildJsonAttestation,
} = require("../shared/attestation");

describe("attestation", () => {
  const testReq = {
    recipientDid: "did:iden3:billions:main:testRecipient123",
    recipientEthAddress: "0x1234567890123456789012345678901234567890",
  };

  describe("buildJsonAttestation", () => {
    it("returns attestation object with expected structure", () => {
      const result = buildJsonAttestation(testReq);

      expect(result.schemaId).toBe(
        "0xca354bee6dc5eded165461d15ccb13aceb6f77ebbb1fd3fe45aca686097f2911"
      );
      expect(result.attester).toBeDefined();
      expect(result.attester.did).toBe("");
      expect(result.attester.ethereumAddress).toBe(
        "0x0000000000000000000000000000000000000000"
      );
      expect(result.recipient).toBeDefined();
      expect(result.recipient.did).toBe(testReq.recipientDid);
      expect(result.recipient.ethereumAddress).toBe(
        testReq.recipientEthAddress
      );
      expect(result.expirationTime).toBe("0");
      expect(result.revocable).toBe(false);
      expect(result.refId).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      expect(result.data).toBe("0x");
    });

    it("includes recipient iden3Id as string", () => {
      const result = buildJsonAttestation(testReq);
      expect(typeof result.recipient.iden3Id).toBe("string");
      expect(result.recipient.iden3Id.length).toBeGreaterThan(0);
    });

    it("attester iden3Id is '0'", () => {
      const result = buildJsonAttestation(testReq);
      expect(result.attester.iden3Id).toBe("0");
    });
  });

  describe("buildEncodedAttestation", () => {
    it("returns a hex-encoded ABI string", () => {
      const result = buildEncodedAttestation(testReq);

      expect(typeof result).toBe("string");
      expect(result.startsWith("0x")).toBe(true);
      // ABI-encoded data is always even-length
      expect(result.length % 2).toBe(0);
    });

    it("produces deterministic output for same input", () => {
      const result1 = buildEncodedAttestation(testReq);
      const result2 = buildEncodedAttestation(testReq);
      expect(result1).toBe(result2);
    });

    it("encodes different recipients differently", () => {
      const req2 = {
        recipientDid: "did:iden3:billions:main:differentRecipient",
        recipientEthAddress: "0x0000000000000000000000000000000000000001",
      };
      const result1 = buildEncodedAttestation(testReq);
      const result2 = buildEncodedAttestation(req2);
      expect(result1).not.toBe(result2);
    });
  });

  describe("computeAttestationHash", () => {
    it("returns a numeric string", () => {
      const result = computeAttestationHash(testReq);

      expect(typeof result).toBe("string");
      expect(/^\d+$/.test(result)).toBe(true);
    });

    it("produces deterministic output for same input", () => {
      const result1 = computeAttestationHash(testReq);
      const result2 = computeAttestationHash(testReq);
      expect(result1).toBe(result2);
    });

    it("produces different output for different inputs", () => {
      const req2 = {
        recipientDid: "did:iden3:billions:main:differentRecipient",
        recipientEthAddress: "0x0000000000000000000000000000000000000001",
      };
      const result1 = computeAttestationHash(testReq);
      const result2 = computeAttestationHash(req2);
      expect(result1).not.toBe(result2);
    });

    it("result is bounded by mask (top 4 bits cleared)", () => {
      const result = BigInt(computeAttestationHash(testReq));
      const mask = BigInt(
        "0x0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
      );
      expect(result <= mask).toBe(true);
    });
  });
});

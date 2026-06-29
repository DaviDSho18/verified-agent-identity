const transactionSender = "0xB3F5d3DD47F6ca17468898291491eBDA69a67797"; // relay sender address
const verifierDid =
  "did:iden3:privado:main:2SZu1G6YDUtk9AAY6TZic24CcCYcZvtdyp1cQv9cig"; // should be the same as dashboard DID
const callbackBase =
  "https://attestation-relay.billions.network/api/v1/callback?attestation=";
const walletAddress = "https://wallet.billions.network";
const verificationMessage =
  "Complete the verification to link your identity to the agent";
const pairingReasonMessage = "agent_pairing:v1";
const accept = [
  "iden3comm/v1;env=application/iden3-zkp-json;circuitId=authV2,authV3,authV3-8-32;alg=groth16",
];
const nullifierSessionId = "240416041207230509012302";
const pouScopeId = 1; // keccak256(nullifierSessionId)
const pouAllowedIssuer = [
  "did:iden3:billions:main:2VwqkgA2dNEwsnmojaay7C5jJEb8ZygecqCSU3xVfm",
];
const authScopeId = 2;
const urlShortener = "https://identity-dashboard.billions.network";

module.exports = {
  transactionSender,
  verifierDid,
  callbackBase,
  walletAddress,
  verificationMessage,
  pairingReasonMessage,
  accept,
  nullifierSessionId,
  pouScopeId,
  pouAllowedIssuer,
  authScopeId,
  urlShortener,
};

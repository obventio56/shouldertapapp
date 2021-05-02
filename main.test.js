const { generateAuthorizationHeader, generateSignature } = require("./main");

test("Generates correct signature", () => {
  // Twitter example: https://developer.twitter.com/en/docs/authentication/oauth-1-0a/creating-a-signature
  const status = "Hello Ladies + Gentlemen, a signed OAuth request!";
  const include_entities = "true";
  const oauth_consumer_key = "xvz1evFS4wEEPTGEFPHBog";
  const oauth_nonce = "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg";
  const oauth_signature_method = "HMAC-SHA1";
  const oauth_timestamp = "1318622958";
  const oauth_token = "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb";
  const oauth_version = "1.0";
  const method = "POST";
  const endpoint = "https://api.twitter.com/1.1/statuses/update.json";
  const consumer_secret = "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw";
  const secret = "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE";

  const oauth_params = [
    ["oauth_consumer_key", oauth_consumer_key],
    ["oauth_nonce", oauth_nonce],
    ["oauth_signature_method", oauth_signature_method],
    ["oauth_timestamp", oauth_timestamp],
    ["oauth_token", oauth_token],
    ["oauth_version", oauth_version]
  ];

  const signature_params = {
    consumer_secret,
    secret,
    method,
    endpoint,
    status,
    include_entities
  };

  const signature = generateSignature(oauth_params, signature_params);

  expect(signature).toBe("hCtSmYh+iHYCEqBWrE7C7hYmtUk=");
});

test("Generates correct header", () => {
  // Twitter example: https://developer.twitter.com/en/docs/authentication/oauth-1-0a/authorizing-a-request
  const status = "Hello Ladies + Gentlemen, a signed OAuth request!";
  const include_entities = "true";
  const oauth_consumer_key = "xvz1evFS4wEEPTGEFPHBog";
  const oauth_nonce = "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg";
  const oauth_signature_method = "HMAC-SHA1";
  const oauth_timestamp = "1318622958";
  const oauth_token = "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb";
  const oauth_version = "1.0";
  const method = "POST";
  const endpoint = "https://api.twitter.com/1.1/statuses/update.json";
  const consumer_secret = "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw";
  const secret = "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE";

  const authorization_header = generateAuthorizationHeader({
    oauth_consumer_key: oauth_consumer_key,
    oauth_nonce: oauth_nonce,
    oauth_signature_method: oauth_signature_method,
    oauth_timestamp: oauth_timestamp,
    oauth_token: oauth_token,
    oauth_version: oauth_version,
    method,
    endpoint,
    status,
    include_entities,
    consumer_secret,
    secret
  });

  expect(authorization_header).toBe(
    `OAuth oauth_consumer_key="xvz1evFS4wEEPTGEFPHBog", oauth_nonce="kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg", oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D\", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1318622958", oauth_token="370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb", oauth_version="1.0"`
  );
});

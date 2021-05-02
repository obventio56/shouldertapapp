const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");

const CONSUMER_KEY = "Jlm4NQn3lejqHjoNWpJTx6X1A"; // oauth_consumer_key;
const CONSUMER_SECRET = "jIXCsYPMkmnT7S5En4z375gL2MCjnr8RW5po7HZgEKZpW1WVAq";

const ACCESS_TOKEN = "764210683-975dEGpTtmFF6up2jpaMcHNkGizqHIjZsA0FDSyL"; // oauth_token
const SECRET = "1aVYK2Z9tKtFOqOYLmPTBhobeTVKJey2pNfRDqJDNuV5D";

const ENDPOINT = "https://stream.twitter.com/1.1/statuses/filter.json";
const TRACK = "bieber";

// Globals to hold tweets, stream object, start time, and timeout
let tweets = [];
let stream = false;
let start_epoch = 0;
let time_limit_timeout;

// Display progress in terminal
setInterval(
  () =>
    process.stdout.write(
      `Recieved ${tweets.length}/100 tweets. ${Math.round(
        (30000 - Date.now() + start_epoch) / 1000
      )} seconds remaining. \r`
    ),
  1000
);

// Default encodeURIComponent doesn't escape "!", which Twitter expects
const percentEncode = c => encodeURIComponent(c).replace(/!/g, "%21");

// Generates nounce according to Twitter example:
// "base64 encoding 32 bytes of random data, and stripping out all non-word characters"
const getNounce = () =>
  crypto
    .randomBytes(32)
    .toString("base64")
    .replace(/\W/g, "");

// Creates HMAC-SHA1 signature
const sign = (string, key) => {
  const hmac = crypto.createHmac("sha1", key);
  hmac.update(string);
  return hmac.digest("base64");
};

// Impliments https://developer.twitter.com/en/docs/authentication/oauth-1-0a/creating-a-signature
const generateSignature = (oauth_params, signature_params) => {
  const {
    consumer_secret,
    secret,
    method,
    endpoint: base_url,
    ...extra_params
  } = signature_params;

  // Must include oauth params and query params
  const params = [...oauth_params, ...Object.entries(extra_params)];

  const param_string = params
    .map(p => p.map(c => percentEncode(c)))
    .sort((a, b) => {
      if (a[0] > b[0]) return 1;
      if (a[0] < b[0]) return -1;
      return 0;
    })
    .map(p => `${p[0]}=${p[1]}`)
    .join("&");

  const signature_base_string = `${method}&${percentEncode(
    base_url
  )}&${percentEncode(param_string)}`;

  const signing_key = `${percentEncode(consumer_secret)}&${percentEncode(
    secret
  )}`;

  return sign(signature_base_string, signing_key);
};

// Impliments https://developer.twitter.com/en/docs/authentication/oauth-1-0a/authorizing-a-request
const generateAuthorizationHeader = params => {
  const {
    oauth_consumer_key,
    oauth_nonce,
    oauth_signature_method,
    oauth_timestamp,
    oauth_token,
    oauth_version,
    ...signature_params
  } = params;

  const oauth_params = [
    ["oauth_consumer_key", oauth_consumer_key],
    ["oauth_nonce", oauth_nonce],
    ["oauth_signature_method", oauth_signature_method],
    ["oauth_timestamp", oauth_timestamp],
    ["oauth_token", oauth_token],
    ["oauth_version", oauth_version]
  ];

  const signature = generateSignature(oauth_params, signature_params);
  oauth_params.push(["oauth_signature", signature]);

  const params_string = oauth_params
    .sort((a, b) => {
      if (a[0] > b[0]) return 1;
      if (a[0] < b[0]) return -1;
      return 0;
    })
    .map(p => `${percentEncode(p[0])}="${percentEncode(p[1])}"`)
    .join(", ");

  return `OAuth ${params_string}`;
};

// Format tweets and save as TSV
const saveTweets = () => {
  stream.off("data", collectTweets);
  clearTimeout(time_limit_timeout);

  const tweet_data = tweets
    .map(tweet => {
      const {
        created_at: message_created_at,
        id: message_id,
        text,
        user: { id: user_id, created_at: user_created_at, name, screen_name },
        extended_tweet: { full_text = false } = {}
      } = tweet;

      return [
        message_id,
        Math.floor(new Date(message_created_at).getTime() / 1000),
        full_text || text,
        user_id,
        Math.floor(new Date(user_created_at).getTime() / 1000),
        name,
        screen_name
      ];
    })
    .sort((a, b) => {
      // Sort by user_created_at
      if (a[4] < b[4]) return -1;
      if (a[4] > b[4]) return 1;

      // user_id (incase 2 users share a timestamp)
      if (a[3] < b[3]) return -1;
      if (a[3] > b[3]) return 1;

      // message_created_at
      if (a[1] < b[1]) return -1;
      if (a[1] > b[1]) return 1;
    });

  const sorted_with_header = [
    [
      "message_id",
      "message_created_at",
      "text",
      "user_id",
      "user_created_at",
      "user_name",
      "user_screen_name"
    ],
    ...tweet_data
  ];

  // Join columns with \t, join rows with \n, escape \n and \t
  const tsv = sorted_with_header
    .map(i =>
      i
        .map(c => {
          return `${c}`.replace(/\t/gm, "\\t");
        })
        .join("\t")
        .replace(/\n/gm, "\\n")
    )
    .join("\n");

  fs.writeFileSync("output.tsv", tsv);
  console.log("\n Done! Results are in output.tsv");
  process.exit(0);
};

// Collect tweets in chunks from API.
// Using closure to scope buffer variable.
const collectTweets = () => {
  let buffer = "";
  const end_token = "\r\n";

  return chunk => {
    // If found 100+ tweets stop and save.
    if (tweets.length >= 100) {
      saveTweets();
      return;
    }

    buffer += chunk.toString("utf8");

    // Scan buffer for any completed messages, and process them
    let end_token_index = buffer.indexOf(end_token);
    while (end_token_index > 0) {
      message = buffer.slice(0, end_token_index);
      buffer = buffer.slice(end_token_index + 2);

      try {
        const tweet = JSON.parse(message);

        if (!tweet.id) {
          console.log("Non-tweet message", tweet);
          if (tweet.disconnect) {
            console.log("disconnected");
            reconnect();
          }
        } else {
          tweets.push(tweet);
        }
      } catch (err) {
        console.log("Invalid JSON", message);
      }

      end_token_index = buffer.indexOf(end_token);
    }
  };
};

// Attempt to reopen stream on disconnect (has yet to happen in testing).
const reconnect = () => {
  if (stream) stream.off("data", collectTweets);
  if (time_limit_timeout) clearTimeout(time_limit_timeout);
  initStream(true);
};

const initStream = (reconnect = false) => {
  if (!reconnect) start_epoch = Date.now();

  // Stop after 30 seconds
  time_limit_timeout = setTimeout(() => {
    saveTweets();
  }, 30000 - Date.now() + start_epoch);

  const authorization_header = generateAuthorizationHeader({
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: getNounce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: `${Math.floor(Date.now() / 1000)}`,
    oauth_token: ACCESS_TOKEN,
    oauth_version: "1.0",
    consumer_secret: CONSUMER_SECRET,
    secret: SECRET,
    method: "POST",
    endpoint: ENDPOINT,
    track: TRACK
  });

  // Request to open stream
  axios({
    method: "post",
    url: ENDPOINT,
    headers: {
      Authorization: authorization_header
    },
    params: {
      track: TRACK
    },
    responseType: "stream"
  })
    .then(response => {
      stream = response.data;
      stream.on("data", collectTweets());
    })
    .catch(err => console.log("Error opening stream", err));
};

module.exports = { generateAuthorizationHeader, generateSignature, initStream };

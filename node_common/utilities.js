import * as Environment from "~/node_common/environment";
import * as Constants from "~/node_common/constants";
import * as Social from "~/node_common/social";
import * as ScriptLogging from "~/node_common/script-logging";
import * as Strings from "~/common/strings";

import JWT from "jsonwebtoken";

import { Buckets, PrivateKey, Pow, Client, ThreadID } from "@textile/hub";

const BUCKET_NAME = "data";
const INIT = "INIT BUCKETS    ";
const SHOVEL = "SHOVEL          ";

const TEXTILE_KEY_INFO = {
  key: Environment.TEXTILE_HUB_KEY,
  secret: Environment.TEXTILE_HUB_SECRET,
};

export const decodeCookieToken = (token) => {
  try {
    const decoded = JWT.verify(token, Environment.JWT_SECRET);
    return decoded.id;
  } catch (e) {
    ScriptLogging.error(SHOVEL, e.message);
    return null;
  }
};

export const setupWithThread = async ({ buckets }) => {
  const client = new Client(buckets.context);

  try {
    const res = await client.getThread("buckets");

    buckets.withThread(res.id.toString());
  } catch (error) {
    if (error.message !== "Thread not found") {
      throw new Error(error.message);
    }

    const newId = ThreadID.fromRandom();
    await client.newDB(newId, "buckets");
    const threadID = newId.toString();

    buckets.withThread(threadID);
  }

  return buckets;
};

// NOTE(jim): Requires @textile/hub
export const getBucketAPIFromUserToken = async ({ user, bucketName, encrypted = false }) => {
  const token = user.data.tokens.api;
  const name = Strings.isEmpty(bucketName) ? BUCKET_NAME : bucketName;
  const identity = await PrivateKey.fromString(token);
  let buckets = await Buckets.withKeyInfo(TEXTILE_KEY_INFO, { debug: true });

  await buckets.getToken(identity);

  let root = null;
  console.log(`[ buckets ] getOrCreate init ${name}`);
  try {
    const created = await buckets.getOrCreate(name, undefined, encrypted);
    root = created.root;
  } catch (e) {
    console.log(`[ textile ] warning: ${e.message}`);
    Social.sendTextileSlackMessage({
      file: "/node_common/utilities.js",
      user,
      message: e.message,
      code: e.code,
      functionName: `buckets.getOrCreate`,
    });
  }

  if (!root) {
    console.log(`[ buckets ] getOrCreate init for ${name} failed`);
    return { buckets: null, bucketKey: null, bucketRoot: null };
  }

  console.log(`[ buckets ] getOrCreate success for ${name}`);
  return {
    buckets,
    bucketKey: root.key,
    bucketRoot: root,
    bucketName: name,
  };
};

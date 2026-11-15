"use strict";

const fs = require("fs");
const path = require("path");

const CHANNEL_INVITE = "0029VbDJULz30LKTYe95S91l";

const STATE_FILE = path.join(
  __dirname,
  "../data/channel-follow-state.json"
);

function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};

    return JSON.parse(
      fs.readFileSync(STATE_FILE, "utf8")
    );
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), {
    recursive: true
  });

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(state, null, 2)
  );
}

async function getChannelMetadata(sock, invite = CHANNEL_INVITE) {
  if (typeof sock.newsletterMetadata !== "function") {
    throw new Error("newsletterMetadata pa disponib.");
  }

  return sock.newsletterMetadata("invite", invite);
}

async function followChannel(sock, channelId) {
  if (typeof sock.newsletterFollow !== "function") {
    throw new Error("newsletterFollow pa disponib.");
  }

  return sock.newsletterFollow(channelId);
}

async function autoFollowChannel(sock, sessionId, logger) {
  try {
    const metadata = await getChannelMetadata(sock);
    const channelId = metadata?.id;

    if (!channelId) {
      throw new Error("ID Channel la pa jwenn.");
    }

    const state = readState();
    const sessionKey = String(sessionId);

    if (state[sessionKey]?.includes(channelId)) {
      logger?.info(
        `[${sessionId}] Channel la te deja swiv atravè sèvis TOPFEROS MD.`
      );
      return;
    }

    await followChannel(sock, channelId);

    state[sessionKey] = [
      ...(state[sessionKey] || []),
      channelId
    ];

    saveState(state);

    logger?.info(
      `[${sessionId}] Demann Follow Channel la reyisi.`
    );

  } catch (error) {
    logger?.warn(
      `[${sessionId}] Channel Service: ${
        error?.message || String(error)
      }`
    );
  }
}

module.exports = {
  getChannelMetadata,
  followChannel,
  autoFollowChannel
};
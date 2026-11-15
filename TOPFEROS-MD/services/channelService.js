
"use strict";

const fs = require("fs");
const path = require("path");

const CHANNEL_INVITE = "0029VbDJULz30LKTYe95S91l";

const STATE_FILE = path.join(
  __dirname,
  "../data/channel-follow-state.json"
);

const pendingFollows = new Map();

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

// Idantifye kont WhatsApp la, pa session bot la.
function getWhatsAppAccountId(sock) {
  const jid = sock.user?.id;

  if (!jid) {
    throw new Error("ID kont WhatsApp la pa disponib.");
  }

  // Retire device ID pou menm kont lan gen menm idantite.
  return jid.replace(/:\d+@/, "@");
}

async function getChannelMetadata(
  sock,
  invite = CHANNEL_INVITE
) {
  if (typeof sock.newsletterMetadata !== "function") {
    throw new Error("newsletterMetadata pa disponib.");
  }

  return sock.newsletterMetadata("invite", invite);
}

async function getFollowedChannels(sock) {
  if (
    typeof sock.newsletterFetchAllParticipating !== "function"
  ) {
    throw new Error(
      "Baileys sa a pa bay metòd pou verifye Channel kont lan swiv."
    );
  }

  return sock.newsletterFetchAllParticipating();
}

function isAlreadyFollowing(channels, channelId) {
  if (!channels) return false;

  if (Array.isArray(channels)) {
    return channels.some(
      channel => channel?.id === channelId
    );
  }

  return Object.prototype.hasOwnProperty.call(
    channels,
    channelId
  );
}

async function followChannel(sock, channelId) {
  if (typeof sock.newsletterFollow !== "function") {
    throw new Error("newsletterFollow pa disponib.");
  }

  return sock.newsletterFollow(channelId);
}

async function autoFollowChannel(sock, sessionId, logger) {
  let accountId;

  try {
    accountId = getWhatsAppAccountId(sock);

    // Evite de session menm kont lan lanse Follow an menm tan.
    if (pendingFollows.has(accountId)) {
      return await pendingFollows.get(accountId);
    }

    const task = (async () => {
      const metadata = await getChannelMetadata(sock);
      const channelId = metadata?.id;

      if (!channelId) {
        throw new Error("ID Channel TOPFEROS MD la pa jwenn.");
      }

      // Verifye abònman reyèl kont WhatsApp la.
      const channels = await getFollowedChannels(sock);

      if (isAlreadyFollowing(channels, channelId)) {
        logger?.info(
          `[${accountId}] Kont WhatsApp la deja swiv TOPFEROS MD Channel.`
        );
        return;
      }

      await followChannel(sock, channelId);

      const state = readState();
      state[accountId] = [
        ...new Set([
          ...(state[accountId] || []),
          channelId
        ])
      ];

      saveState(state);

      logger?.info(
        `[${accountId}] Demann Follow TOPFEROS MD Channel voye.`
      );
    })();

    pendingFollows.set(accountId, task);

    try {
      await task;
    } finally {
      pendingFollows.delete(accountId);
    }

  } catch (error) {
    logger?.warn(
      `[${accountId || sessionId}] Channel Service: ${
        error?.message || String(error)
      }`
    );
  }
}

module.exports = {
  getWhatsAppAccountId,
  getChannelMetadata,
  getFollowedChannels,
  followChannel,
  autoFollowChannel
};

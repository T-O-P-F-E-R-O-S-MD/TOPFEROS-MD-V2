"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| AUTOMATIC ANTI-BOT SERVICE
|--------------------------------------------------------------------------
*/

const activity = new Map();

const WINDOW_MS = 30000;
const FLOOD_WINDOW_MS = 10000;
const MAX_MESSAGES = 6;
const MAX_REPEATS = 3;
const MAX_RECORDS = 10000;

function normalizeNumber(value) {
  return String(value || "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/:\d+@/g, "@")
    .replace(/[^0-9]/g, "");
}

function getMessageText(message) {
  const content = message?.message || {};

  return String(
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function analyzeMessage(key, message) {
  const now = Date.now();

  let record = activity.get(key);

  if (!record) {
    record = {
      timestamps: [],
      messages: []
    };
  }

  record.timestamps = record.timestamps.filter(
    time => now - time <= FLOOD_WINDOW_MS
  );

  record.messages = record.messages.filter(
    item => now - item.time <= WINDOW_MS
  );

  record.timestamps.push(now);

  const text = getMessageText(message);

  if (text) {
    record.messages.push({
      text,
      time: now
    });
  }

  const repeatedCount = text
    ? record.messages.filter(item => item.text === text).length
    : 0;

  let score = 0;

  if (record.timestamps.length >= MAX_MESSAGES) {
    score += 50;
  }

  if (repeatedCount >= MAX_REPEATS) {
    score += 50;
  }

  if (activity.size >= MAX_RECORDS && !activity.has(key)) {
    const oldestKey = activity.keys().next().value;
    if (oldestKey) activity.delete(oldestKey);
  }

  activity.set(key, record);

  return {
    detected: score >= 100,
    score,
    repeatedCount,
    messageCount: record.timestamps.length
  };
}

async function isGroupAdmin(sock, groupJid, participantJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);

    const participant = metadata.participants.find(item =>
      item.id === participantJid ||
      item.jid === participantJid
    );

    return Boolean(
      participant &&
      (participant.admin === "admin" ||
       participant.admin === "superadmin")
    );
  } catch (error) {
    console.error(
      "[ANTI-BOT] Admin verification failed:",
      error.message
    );

    return false;
  }
}

async function handleAntiBot({
  sock,
  message,
  sessionId,
  settings = {},
  isOwner = false
}) {
  const chatJid = message?.key?.remoteJid;
  const senderJid =
    message?.key?.participant || chatJid;

  if (
    !sock ||
    !chatJid ||
    !senderJid ||
    message?.key?.fromMe ||
    isOwner
  ) {
    return { handled: false };
  }

  if (
    settings.antiBotFilter !== true ||
    settings.botDetection !== true ||
    settings.autoScan !== true
  ) {
    return { handled: false };
  }

  const isGroup = chatJid.endsWith("@g.us");
  const mode = settings.antiBotMode || "both";

  if (
    (mode === "groups" && !isGroup) ||
    (mode === "private" && isGroup)
  ) {
    return { handled: false };
  }

  const senderNumber = normalizeNumber(
    message?.key?.participantAlt ||
    message?.key?.remoteJidAlt ||
    senderJid
  );

  const exceptions = Array.isArray(settings.antiBlockNumbers)
    ? settings.antiBlockNumbers.map(normalizeNumber)
    : [];

  if (
    senderNumber &&
    exceptions.includes(senderNumber)
  ) {
    return { handled: false, exempt: true };
  }

  const botNumber = normalizeNumber(sock.user?.id);

  if (senderNumber && senderNumber === botNumber) {
    return { handled: false };
  }

  if (isGroup) {
    const admin = await isGroupAdmin(
      sock,
      chatJid,
      senderJid
    );

    if (admin) {
      return { handled: false, protectedAdmin: true };
    }
  }

  const key = [
    sessionId || "default",
    chatJid,
    senderJid
  ].join(":");

  const result = analyzeMessage(key, message);

  if (!result.detected) {
    return {
      handled: false,
      score: result.score
    };
  }

  const action = ["Delete", "Warn", "Block"].includes(
    settings.antiBotAction
  )
    ? settings.antiBotAction
    : "Warn";

  console.warn("[TOPFEROS MD ANTI-BOT]", {
    sender: senderJid,
    score: result.score,
    repeatedCount: result.repeatedCount,
    messageCount: result.messageCount,
    action
  });

  let deleted = false;
  let warned = false;

  if (action === "Delete") {
    try {
      await sock.sendMessage(chatJid, {
        delete: message.key
      });

      deleted = true;
    } catch (error) {
      console.error(
        "[ANTI-BOT] Delete failed:",
        error.message
      );
    }
  }

  // Block is deliberately treated as Warn:
  // heuristic detection alone must not block a WhatsApp account.
  if (action === "Warn" || action === "Block") {
    try {
      await sock.sendMessage(chatJid, {
        text:
          "⚠️ TOPFEROS MD ANTI-BOT\n\n" +
          "Repeated or automated messaging behavior was detected. " +
          "Please stop sending repeated messages."
      });

      warned = true;
    } catch (error) {
      console.error(
        "[ANTI-BOT] Warning failed:",
        error.message
      );
    }
  }

  if (settings.adminNotification === true) {
    console.log(
      "[TOPFEROS MD ANTI-BOT] Detection notification:",
      senderJid
    );
  }

  return {
    handled: true,
    detected: true,
    score: result.score,
    action,
    deleted,
    warned
  };
}

module.exports = {
  handleAntiBot,
  analyzeMessage
};
"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| AUTOMATIC ANTI-BOT BEHAVIOR SERVICE
|--------------------------------------------------------------------------
| Detects suspicious automation patterns, not bot identity.
| Requires a message flood AND repeated identical text before action.
| No external bot-number list or environment variable is required.
*/

const activity = new Map();
const actionCooldowns = new Map();

const WINDOW_MS = 30000;
const FLOOD_WINDOW_MS = 10000;
const ACTION_COOLDOWN_MS = 60000;
const MAX_MESSAGES = 6;
const MAX_REPEATS = 3;
const MAX_RECORDS = 10000;

function normalizeJid(value) {
  return String(value || "")
    .trim()
    .replace(/:\d+(?=@)/, "");
}

function normalizeNumber(value) {
  return String(value || "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/:\d+@/g, "@")
    .replace(/[^0-9]/g, "");
}

function getMessageText(message) {
  const content = message?.message || {};
  const text =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.listResponseMessage?.title ||
    "";

  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function analyzeMessage(key, message) {
  const now = Date.now();
  let record = activity.get(key);

  if (!record) {
    record = { timestamps: [], messages: [] };
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
    record.messages.push({ text, time: now });
  }

  const repeatedCount = text
    ? record.messages.filter(item => item.text === text).length
    : 0;

  const floodDetected = record.timestamps.length >= MAX_MESSAGES;
  const repetitionDetected = repeatedCount >= MAX_REPEATS;

  const score =
    (floodDetected ? 50 : 0) +
    (repetitionDetected ? 50 : 0);

  if (activity.size >= MAX_RECORDS && !activity.has(key)) {
    const oldestKey = activity.keys().next().value;
    if (oldestKey) activity.delete(oldestKey);
  }

  activity.set(key, record);

  return {
    detected: floodDetected && repetitionDetected,
    score,
    repeatedCount,
    messageCount: record.timestamps.length,
    floodDetected,
    repetitionDetected
  };
}

function findParticipant(metadata, jid) {
  const target = normalizeJid(jid);

  return (metadata?.participants || []).find(item =>
    normalizeJid(item.id) === target ||
    normalizeJid(item.jid) === target
  );
}

function isAdmin(participant) {
  return Boolean(
    participant &&
    (
      participant.admin === "admin" ||
      participant.admin === "superadmin"
    )
  );
}

async function getGroupContext(sock, groupJid, senderJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);

    const botParticipant = findParticipant(
      metadata,
      sock.user?.id
    );

    const senderParticipant = findParticipant(
      metadata,
      senderJid
    );

    return {
      metadata,
      botIsAdmin: isAdmin(botParticipant),
      senderIsAdmin: isAdmin(senderParticipant),

      admins: (metadata.participants || [])
        .filter(isAdmin)
        .map(item => item.id || item.jid)
        .filter(Boolean)
        .filter(jid =>
          normalizeJid(jid) !== normalizeJid(sock.user?.id)
        )
    };
  } catch (error) {
    console.error(
      "[ANTI-BOT] Group metadata lookup failed:",
      error?.message || error
    );

    return {
      metadata: null,
      botIsAdmin: false,
      senderIsAdmin: false,
      admins: []
    };
  }
}

async function notifyAdmins({
  sock,
  chatJid,
  admins,
  ownerJid,
  text
}) {
  try {
    if (chatJid.endsWith("@g.us")) {
      if (!admins.length) return false;

      await sock.sendMessage(chatJid, {
        text,
        mentions: admins
      });

      return true;
    }

    if (ownerJid) {
      await sock.sendMessage(ownerJid, { text });
      return true;
    }
  } catch (error) {
    console.error(
      "[ANTI-BOT] Admin notification failed:",
      error?.message || error
    );
  }

  return false;
}

async function handleAntiBot({
  sock,
  message,
  sessionId,
  settings = {},
  isOwner = false,
  ownerJid = ""
}) {
  const chatJid = message?.key?.remoteJid || "";

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

  const group = chatJid.endsWith("@g.us");

  const mode = [
    "groups",
    "private",
    "both"
  ].includes(settings.antiBotMode)
    ? settings.antiBotMode
    : "both";

  if (
    (mode === "groups" && !group) ||
    (mode === "private" && group)
  ) {
    return { handled: false };
  }

  const senderNumber = normalizeNumber(
    message?.key?.participantAlt ||
    message?.key?.remoteJidAlt ||
    senderJid
  );

  const exceptions = Array.isArray(settings.antiBlockNumbers)
    ? settings.antiBlockNumbers
        .map(normalizeNumber)
        .filter(Boolean)
    : [];

  if (
    senderNumber &&
    exceptions.includes(senderNumber)
  ) {
    return {
      handled: false,
      exempt: true
    };
  }

  const botJid = normalizeJid(sock.user?.id);

  if (
    botJid &&
    normalizeJid(senderJid) === botJid
  ) {
    return { handled: false };
  }

  const activityKey = [
    sessionId || "default",
    chatJid,
    senderJid
  ].join(":");

  const detection = analyzeMessage(
    activityKey,
    message
  );

  if (!detection.detected) {
    return {
      handled: false,
      score: detection.score
    };
  }

  let groupContext = {
    botIsAdmin: false,
    senderIsAdmin: false,
    admins: []
  };

  if (group) {
    groupContext = await getGroupContext(
      sock,
      chatJid,
      senderJid
    );

    if (groupContext.senderIsAdmin) {
      return {
        handled: false,
        protectedAdmin: true
      };
    }
  }

  const now = Date.now();

  const lastActionAt =
    actionCooldowns.get(activityKey) || 0;

  if (now - lastActionAt < ACTION_COOLDOWN_MS) {
    return {
      handled: true,
      detected: true,
      cooldown: true,
      score: detection.score
    };
  }

  actionCooldowns.set(activityKey, now);

  if (actionCooldowns.size > MAX_RECORDS) {
    const oldestKey = actionCooldowns.keys().next().value;
    if (oldestKey) actionCooldowns.delete(oldestKey);
  }

  const action = [
    "Delete",
    "Warn",
    "Block"
  ].includes(settings.antiBotAction)
    ? settings.antiBotAction
    : "Warn";

  let deleted = false;
  let warned = false;
  let kicked = false;

  // Delete requires the bot to be a group administrator.
  if (
    action === "Delete" &&
    group &&
    groupContext.botIsAdmin
  ) {
    try {
      await sock.sendMessage(chatJid, {
        delete: message.key
      });

      deleted = true;
    } catch (error) {
      console.error(
        "[ANTI-BOT] Delete failed:",
        error?.message || error
      );
    }
  }

  // Block removes the sender from this group only.
  const shouldKick =
    group &&
    groupContext.botIsAdmin &&
    (
      settings.autoKick === true ||
      action === "Block"
    );

  if (shouldKick) {
    try {
      await sock.groupParticipantsUpdate(
        chatJid,
        [senderJid],
        "remove"
      );

      kicked = true;
    } catch (error) {
      console.error(
        "[ANTI-BOT] Group removal failed:",
        error?.message || error
      );
    }
  }

  const shouldWarn =
    action === "Warn" ||
    (action === "Delete" && !deleted) ||
    (action === "Block" && !kicked) ||
    (settings.autoKick === true && !kicked);

  if (shouldWarn) {
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
        error?.message || error
      );
    }
  }

  if (settings.adminNotification === true) {
    const scoreText = settings.botScore === true
      ? `\nDetection score: ${detection.score}/100`
      : "";

    await notifyAdmins({
      sock,
      chatJid,
      admins: groupContext.admins,
      ownerJid,
      text:
        "🤖 TOPFEROS MD ANTI-BOT ALERT\n\n" +
        `Suspicious repeated-message behavior detected from: ${senderJid}` +
        scoreText +
        `\nAction: ${kicked ? "Group removal" : action}`
    });
  }

  console.warn("[TOPFEROS MD ANTI-BOT]", {
    sessionId,
    sender: senderJid,
    score: settings.botScore === true
      ? detection.score
      : undefined,
    repeatedCount: detection.repeatedCount,
    messageCount: detection.messageCount,
    action,
    deleted,
    warned,
    kicked
  });

  return {
    handled: true,
    detected: true,
    score: detection.score,
    action,
    deleted,
    warned,
    kicked
  };
}

function clearSession(sessionId) {
  const prefix = `${sessionId || "default"}:`;

  for (const key of activity.keys()) {
    if (key.startsWith(prefix)) {
      activity.delete(key);
    }
  }

  for (const key of actionCooldowns.keys()) {
    if (key.startsWith(prefix)) {
      actionCooldowns.delete(key);
    }
  }
}

module.exports = {
  handleAntiBot,
  analyzeMessage,
  clearSession
};
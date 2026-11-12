
"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| ANTI-SPAM + WHATSAPP BLOCK + GROUP AUTO KICK
|--------------------------------------------------------------------------
*/

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(process.cwd(), "data");
const BLACKLIST_FILE = path.join(
  DATA_DIR,
  "antiSpam-blacklist.json"
);

const WINDOW_MS = 8000;
const MAX_MESSAGES = 6;
const MAX_REPEATS = 3;
const COOLDOWN_MS = 20000;

const history = new Map();
const blockedNumbers = new Set();

function loadBlacklist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    if (!fs.existsSync(BLACKLIST_FILE)) {
      fs.writeFileSync(
        BLACKLIST_FILE,
        JSON.stringify([], null, 2)
      );
    }

    const data = JSON.parse(
      fs.readFileSync(BLACKLIST_FILE, "utf8")
    );

    for (const number of data) {
      blockedNumbers.add(String(number));
    }
  } catch (error) {
    console.error("[ANTI-SPAM] Load error:", error.message);
  }
}

function saveBlacklist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  fs.writeFileSync(
    BLACKLIST_FILE,
    JSON.stringify([...blockedNumbers], null, 2)
  );
}

loadBlacklist();

function normalizeNumber(jid) {
  return String(jid || "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/:\d+@/g, "@")
    .replace(/[^0-9]/g, "");
}

function getNumberJid(jid) {
  const number = normalizeNumber(jid);

  if (!number) return null;

  return `${number}@s.whatsapp.net`;
}

function isBlocked(jid) {
  const number = normalizeNumber(jid);

  return Boolean(
    number && blockedNumbers.has(number)
  );
}

function checkSpam(key, text) {
  const now = Date.now();

  let record = history.get(key);

  if (!record) {
    record = {
      timestamps: [],
      lastText: "",
      repeatCount: 0,
      cooldownUntil: 0
    };
  }

  // Cooldown protection
  if (record.cooldownUntil > now) {
    history.set(key, record);

    return {
      spam: true,
      reason: "COOLDOWN",
      suppressWarning: true
    };
  }

  record.timestamps = record.timestamps.filter(
    timestamp => now - timestamp <= WINDOW_MS
  );

  const normalizedText = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (normalizedText) {
    if (normalizedText === record.lastText) {
      record.repeatCount++;
    } else {
      record.lastText = normalizedText;
      record.repeatCount = 1;
    }
  }

  record.timestamps.push(now);

  const flood = record.timestamps.length > MAX_MESSAGES;

  const repeated =
    normalizedText.length > 0 &&
    record.repeatCount >= MAX_REPEATS;

  if (flood || repeated) {
    record.cooldownUntil = now + COOLDOWN_MS;
    record.timestamps = [];
    record.repeatCount = 0;

    history.set(key, record);

    return {
      spam: true,
      reason: flood ? "FLOOD" : "REPEATED_MESSAGE",
      suppressWarning: false
    };
  }

  history.set(key, record);

  return { spam: false };
}

async function isGroupAdmin(sock, groupJid, participantJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);

    const participant = metadata.participants.find(
      item =>
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
      "[ANTI-SPAM] Admin check:",
      error.message
    );

    return false;
  }
}

async function punish({
  sock,
  message,
  sessionId,
  ownerNumber,
  antiSpamMode = "warn"
}) {
  const chatJid = message?.key?.remoteJid;
  const senderJid =
    message?.key?.participant || chatJid;

  if (
  !sock ||
  !chatJid ||
  !senderJid ||
  message?.key?.fromMe
) {
  return { handled: false };
}

  const number = normalizeNumber(
  message?.key?.participantAlt ||
  message?.key?.remoteJidAlt ||
  senderJid
);

const botNumber = normalizeNumber(sock.user?.id);
const owner = normalizeNumber(ownerNumber);

const senderIdentity = String(senderJid).toLowerCase();
const botIdentity = String(sock.user?.id || "").toLowerCase();

if (
  senderIdentity === botIdentity ||
  (number && number === botNumber) ||
  (owner && number === owner)
) {
  return { handled: false };
}

  if (
    !number ||
    number === botNumber ||
    (owner && number === owner)
  ) {
    return { handled: false };
  }

  if (isBlocked(senderJid)) {
    return {
      handled: true,
      alreadyBlocked: true
    };
  }

  const group = chatJid.endsWith("@g.us");

  if (group) {
    const admin = await isGroupAdmin(
      sock,
      chatJid,
      senderJid
    );

    if (admin) {
      return {
        handled: false,
        protectedAdmin: true
      };
    }
  }

  const text =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    "";

  const key = `${sessionId}:${chatJid}:${senderIdentity}`;
  const result = checkSpam(key, text);

  if (!result.spam) {
    return { handled: false };
  }

  const validModes = [
    "warn",
    "delete",
    "kick",
    "warn_delete"
  ];

  const mode = validModes.includes(antiSpamMode)
    ? antiSpamMode
    : "warn";

  let warned = false;
  let deleted = false;
  let kicked = false;

  // WARN
  if (
  (mode === "warn" || mode === "warn_delete") &&
  !result.suppressWarning
) {
    try {
      await sock.sendMessage(
        chatJid,
        {
          text: `⚠️ @${number || senderJid.split("@")[0]} sispann voye mesaj repete oswa spam.`,
          mentions: [senderJid]
        }
      );

      warned = true;
    } catch (error) {
      console.error(
        "[ANTI-SPAM] Warning failed:",
        error.message
      );
    }
  }

  // DELETE
  if (
    mode === "delete" ||
    mode === "warn_delete"
  ) {
    try {
      await sock.sendMessage(
        chatJid,
        {
          delete: message.key
        }
      );

      deleted = true;
    } catch (error) {
      console.error(
        "[ANTI-SPAM] Delete failed:",
        error.message
      );
    }
  }

  // KICK — GROUP ONLY
  if (mode === "kick") {
    if (!group) {
      return {
        handled: true,
        spam: true,
        mode,
        reason: "KICK_ONLY_WORKS_IN_GROUPS"
      };
    }

    try {
      const metadata = await sock.groupMetadata(chatJid);

      const botJid = sock.user?.id;

      const botParticipant = metadata.participants.find(
        item =>
          item.id === botJid ||
          item.jid === botJid
      );

      const botIsAdmin = Boolean(
        botParticipant &&
        (
          botParticipant.admin === "admin" ||
          botParticipant.admin === "superadmin"
        )
      );

      if (botIsAdmin) {
        await sock.groupParticipantsUpdate(
          chatJid,
          [senderJid],
          "remove"
        );

        kicked = true;
      } else {
        console.warn(
          "[ANTI-SPAM] Bot is not group admin. Cannot kick."
        );
      }
    } catch (error) {
      console.error(
        "[ANTI-SPAM] Group removal failed:",
        error.message
      );
    }
  }

  console.log("[ANTI-SPAM]", {
    number,
    reason: result.reason,
    mode,
    warned,
    deleted,
    kicked
  });

  return {
    handled: true,
    spam: true,
    number,
    mode,
    warned,
    deleted,
    kicked
  };
}

async function unblock(sock, numberInput) {
  const number = normalizeNumber(numberInput);

  if (!number) {
    return { success: false, reason: "INVALID_NUMBER" };
  }

  try {
    await sock.updateBlockStatus(
      `${number}@s.whatsapp.net`,
      "unblock"
    );

    blockedNumbers.delete(number);
    saveBlacklist();

    return { success: true, number };
  } catch (error) {
    return {
      success: false,
      reason: error.message
    };
  }
}

function getBlockedNumbers() {
  return [...blockedNumbers];
}

module.exports = {
  punish,
  unblock,
  isBlocked,
  getBlockedNumbers
};

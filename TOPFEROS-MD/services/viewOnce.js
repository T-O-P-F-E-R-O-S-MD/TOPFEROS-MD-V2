
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// MEDIA SERVICE — VV2 / VVV
// BAILEYS 7.x

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const MEDIA_TYPES = [
  ["imageMessage", "image"],
  ["videoMessage", "video"],
  ["audioMessage", "audio"],
  ["documentMessage", "document"]
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 UNWRAP MESSAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function unwrapMessage(input) {
  let content = input?.message || input;

  for (let i = 0; i < 10; i++) {
    if (!content || typeof content !== "object") {
      return null;
    }

    if (content.ephemeralMessage?.message) {
      content = content.ephemeralMessage.message;
      continue;
    }

    if (content.documentWithCaptionMessage?.message) {
      content = content.documentWithCaptionMessage.message;
      continue;
    }

    return content;
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔒 VIEW ONCE DETECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getViewOnceMessage(input) {
  const content = unwrapMessage(input);

  if (!content) return null;

  const keys = [
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension"
  ];

  for (const key of keys) {
    if (content[key]?.message) {
      return content[key].message;
    }
  }

  return null;
}

function isViewOnceMessage(input) {
  const content = unwrapMessage(input);

  if (!content) return false;

  return Boolean(
    getViewOnceMessage(content) ||
    content.imageMessage?.viewOnce ||
    content.videoMessage?.viewOnce
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💬 GET QUOTED MESSAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getQuotedMessage(input) {
  const content = unwrapMessage(input);

  if (!content) return null;

  const queue = [content];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();

    if (
      !current ||
      typeof current !== "object" ||
      visited.has(current)
    ) continue;

    visited.add(current);

    if (current.contextInfo?.quotedMessage) {
      const quoted =
        current.contextInfo.quotedMessage;

      return {
        download: quoted,
        text:
          quoted.conversation ||
          quoted.extendedTextMessage?.text ||
          ""
      };
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 GET VIEW ONCE MEDIA INFO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getViewOnceMedia(input) {
  const content = getViewOnceMessage(input);

  if (!content) return null;

  for (const [key, type] of MEDIA_TYPES) {
    if (content[key]) {
      return {
        type,
        message: content[key]
      };
    }
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 GET NORMAL MEDIA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getNormalMedia(input) {
  if (isViewOnceMessage(input)) {
    return null;
  }

  const content = unwrapMessage(input);

  if (!content) return null;

  for (const [key, type] of MEDIA_TYPES) {
    const item = content[key];

    if (item && !item.viewOnce) {
      return {
        type,
        message: item
      };
    }
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📥 DOWNLOAD MEDIA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function downloadNormalMedia(media) {
  if (!media?.message || !media?.type) {
    throw new Error("Invalid media object");
  }

  const stream = await downloadContentFromMessage(
    media.message,
    media.type
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  const buffer = Buffer.concat(chunks);

  if (!buffer.length) {
    throw new Error("Empty media buffer");
  }

  return buffer;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📤 BUILD PAYLOAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildPayload(media, buffer) {
  const original = media.message;

  switch (media.type) {
    case "image":
      return {
        image: buffer,
        ...(original.caption
          ? { caption: original.caption }
          : {})
      };

    case "video":
      return {
        video: buffer,
        mimetype: original.mimetype || "video/mp4",
        ...(original.caption
          ? { caption: original.caption }
          : {})
      };

    case "audio":
      return {
        audio: buffer,
        mimetype: original.mimetype || "audio/ogg",
        ptt: Boolean(original.ptt)
      };

    case "document":
      return {
        document: buffer,
        mimetype:
          original.mimetype ||
          "application/octet-stream",
        fileName:
          original.fileName ||
          "TOPFEROS-MEDIA",
        ...(original.caption
          ? { caption: original.caption }
          : {})
      };

    default:
      throw new Error("Unsupported media type");
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🤖 NORMALIZE JID
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function normalizeJid(jid) {
  if (!jid || typeof jid !== "string") {
    return null;
  }

  return jid.replace(/:\d+@/, "@");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🤖 GET BOT JID
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getBotJid(sock) {
  return normalizeJid(sock?.user?.id);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💬 SEND RESPONSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendResponse(ctx, text) {
  if (typeof ctx?.send === "function") {
    return ctx.send(text);
  }

  const chatId =
    ctx?.jid ||
    ctx?.message?.key?.remoteJid;

  if (ctx?.sock && chatId) {
    return ctx.sock.sendMessage(chatId, {
      text
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 PROCESS NORMAL MEDIA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function processMedia(ctx, sendToBot = false) {
  const { sock, message } = ctx || {};

  const chatId =
    ctx?.jid ||
    message?.key?.remoteJid;

  if (!sock || !message || !chatId) {
    return { success: false };
  }

  try {
    const quoted = getQuotedMessage(message);

    if (!quoted) {
      await sendResponse(
        ctx,
        "❌ Reponn sou yon foto, videyo, odyo oswa dokiman nòmal."
      );

      return { success: false };
    }

    if (isViewOnceMessage(quoted.download)) {
      await sendResponse(
        ctx,
        "🔒 Mesaj View Once sa a pa sipòte."
      );

      return { success: false };
    }

    const media = getNormalMedia(quoted.download);

    if (!media) {
      await sendResponse(
        ctx,
        "❌ Mwen pa jwenn medya nòmal nan mesaj la."
      );

      return { success: false };
    }

    const buffer =
      await downloadNormalMedia(media);

    const payload =
      buildPayload(media, buffer);

    let destination = chatId;

    // VVV → BOT DM
    if (sendToBot) {
      destination = getBotJid(sock);

      if (!destination) {
        throw new Error("Bot JID not found");
      }
    }

    await sock.sendMessage(
      destination,
      payload
    );

    await sendResponse(
      ctx,
      sendToBot
        ? "✅ Medya a voye nan DM bot la."
        : "✅ Medya a voye nan menm chat la."
    );

    return {
      success: true,
      type: media.type,
      destination
    };

  } catch (error) {
    console.error(
      "[TOPFEROS MD MEDIA ERROR]",
      error?.stack || error?.message || error
    );

    await sendResponse(
      ctx,
      "❌ Transfè medya a echwe."
    );

    return { success: false };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👁️ VV2
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function vv2Command(ctx) {
  return processMedia(ctx, false);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📩 VVV
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function vvvCommand(ctx) {
  return processMedia(ctx, true);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📋 EXECUTE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function execute(ctx) {
  return vvvCommand(ctx);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🤖 AUTO VIEW ONCE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleAutoViewOnce() {
  return {
    success: false,
    handled: false
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

module.exports = {
  name: "viewonce",

  aliases: [
    "vreply",
    "vforward"
  ],

  description:
    "Transfere medya nòmal nan menm chat oswa DM bot la.",

  usage: ".vv2 / .vvv",

  execute,
  processMedia,
  vv2Command,
  vvvCommand,
  unwrapMessage,
  getViewOnceMessage,
  getViewOnceMedia,
  getQuotedMessage,
  getNormalMedia,
  downloadNormalMedia,
  buildPayload,
  normalizeJid,
  getBotJid,
  isViewOnceMessage,
  handleAutoViewOnce
};

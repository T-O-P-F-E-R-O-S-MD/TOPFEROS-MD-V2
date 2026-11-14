"use strict";

/*
|--------------------------------------------------------------------------
| GET CONTENT TYPE — TOPFEROS MD
|--------------------------------------------------------------------------
*/

function getContentType(message) {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  const ignoredKeys = new Set([
    "messageContextInfo",
    "senderKeyDistributionMessage"
  ]);

  return Object.keys(message).find(
    key => !ignoredKeys.has(key)
  );
}

const config = require("./config");

const sessionManager =
  require("./sessionManager");

const settingPanel =
  require("./settingPanel");

const antiSpam = require("../services/antiSpam");

const antiBotService =
  require("../services/antiBotService");

const {
  isUnsafeMessageStructure
} = require("../services/antiBug");

const groupPrinciplesService =
  require("../services/groupPrinciples");

// 🦁 TOPFEROS MD V2.0.0
// VIEW ONCE / MEDIA SERVICE

const viewonce =
  require("../services/viewOnce");

// 🦁 TOPFEROS MD V2.0.0
// VVV COMMAND

const {
  execute: vvvCommand
} = require("../commands/vvv");

const {
  recordOwnerCommand
} = require("./ownerStats");

const {
  attachStatusHandler
} = require("./statusHandler");

const {
  sendMenu
} = require("../commands/menu");

const { helpCommand } = require("../commands/help");
const settingsCommand = require("../commands/settings");

const {
  parrainCommand
} = require("../commands/parrain");

const {
  pairCommand
} = require("../commands/pair");

const {
  startAIChat,
  continueAIChat,
  setLastAIMessage,
  isReplyToLastAIMessage,
  isForwardOfLastAIMessage,
  getForwardQuestion,
  setWaitingForQuestion,
  isWaitingForQuestion,
  hasSession
} = require("../services/aiChat");

const {
  saveCommand,
  sendCommand
} = require("../commands/status");

const {
  playCommand
} = require("../commands/play");

const {
  groupStatusCommand
} = require("../commands/groupstatus");

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| MESSAGE HANDLER
|--------------------------------------------------------------------------
*/
const attachedSockets = new WeakSet();
const commands = new Map();


/*
|--------------------------------------------------------------------------
| TOPFEROS MD — RECENT MESSAGE KEYS
|--------------------------------------------------------------------------
*/

const recentMessageKeys = new Map();
const MAX_CACHED_MESSAGES = 5000;

function rememberMessageKey(message, sessionId) {
  try {
    const key = message?.key;
    const jid = key?.remoteJid;
    const id = key?.id;

    if (!jid || !id) {
      return;
    }

    const timestamp = Number(message.messageTimestamp);

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return;
    }

    const cacheId =
      `${String(sessionId || "")}:${jid}:${id}`;

    recentMessageKeys.set(cacheId, {
      remoteJid: jid,
      id,
      fromMe: Boolean(key.fromMe),
      timestamp,
      ...(key.participant
        ? { participant: key.participant }
        : {})
    });

    while (recentMessageKeys.size > MAX_CACHED_MESSAGES) {
      const oldestKey =
        recentMessageKeys.keys().next().value;

      if (!oldestKey) break;

      recentMessageKeys.delete(oldestKey);
    }
  } catch (error) {
    console.error(
      "[MESSAGE CACHE]",
      error?.message || error
    );
  }
}

function getCachedMessageKey(sessionId, jid, messageId) {
  const cacheId =
    `${String(sessionId || "")}:${jid}:${messageId}`;

  return recentMessageKeys.get(cacheId) || null;
}

function getCachedMessages(sessionId, jid) {
  const prefix = `${String(sessionId || "")}:${jid}:`;
  const messages = [];

  for (const [cacheId, value] of recentMessageKeys.entries()) {
    if (cacheId.startsWith(prefix)) {
      messages.push({ ...value });
    }
  }

  return messages.sort(
    (a, b) => Number(b.timestamp) - Number(a.timestamp)
  );
}

/*
|--------------------------------------------------------------------------
| REGISTER COMMAND
|--------------------------------------------------------------------------
*/

function registerCommand(name, handler, options = {}) {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");

  if (!normalized || typeof handler !== "function") {
    throw new TypeError(
      `[TOPFEROS MD] Invalid command registration: ${name}`
    );
  }

  const aliases = Array.isArray(options.aliases)
    ? options.aliases
        .map(alias =>
          String(alias).trim().toLowerCase().replace(/^\./, "")
        )
        .filter(Boolean)
    : [];

  commands.set(normalized, {
    handler,
    aliases,
    description: options.description || "",
    usage: options.usage || "",
    category: options.category || "GENERAL"
  });

  return commands.get(normalized);
}

registerCommand("gstatus", groupStatusCommand, {
  aliases: ["groupstatus"],
  description: "Publish group image or video to WhatsApp Status.",
  usage: ".gstatus",
  category: "GROUP"
});

/*
|--------------------------------------------------------------------------
| COMMAND: VV2
|--------------------------------------------------------------------------
*/

registerCommand(
  "vv2",
  async (ctx) => {
    return await viewonce.vv2Command(ctx);
  },
  {
    aliases: [],
    description: "Process quoted media.",
    usage: ".vv2",
    category: "MEDIA"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: VVV
|--------------------------------------------------------------------------
*/

registerCommand(
  "vvv",
  async (ctx) => {
    return await viewonce.vvvCommand(ctx);
  },
  {
    aliases: [],
    description: "Send quoted media to DM and chat.",
    usage: ".vvv",
    category: "MEDIA"
  }
);

/*
|--------------------------------------------------------------------------
| FIND COMMAND
|--------------------------------------------------------------------------
*/

function findCommand(
  commandName
) {
  const normalized =
    String(commandName || "")
      .trim()
      .toLowerCase()
      .replace(/^\./, "");

  if (
    commands.has(normalized)
  ) {
    return {
      name: normalized,
      command:
        commands.get(normalized)
    };
  }

  for (
    const [
      name,
      command
    ] of commands
  ) {
    if (
      command.aliases.includes(
        normalized
      )
    ) {
      return {
        name,
        command
      };
    }
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| EXTRACT MESSAGE TEXT
|--------------------------------------------------------------------------
*/

function extractMessageText(
  message
) {
  if (!message) {
    return "";
  }

  const type =
    getContentType(message);

  if (
    type === "conversation"
  ) {
    return (
      message.conversation ||
      ""
    ).trim();
  }

  if (
    type === "extendedTextMessage"
  ) {
    return (
      message.extendedTextMessage
        ?.text ||
      ""
    ).trim();
  }

  if (
    type === "imageMessage"
  ) {
    return (
      message.imageMessage
        ?.caption ||
      ""
    ).trim();
  }

  if (
    type === "videoMessage"
  ) {
    return (
      message.videoMessage
        ?.caption ||
      ""
    ).trim();
  }

  return "";
}
/*
 
/*
|--------------------------------------------------------------------------
| GET MESSAGE TYPE
|--------------------------------------------------------------------------
*/

function getMessageType(
  message
) {
  if (!message) {
    return null;
  }

  return getContentType(
    message
  );
}

/*
|--------------------------------------------------------------------------
| GET CHAT JID
|--------------------------------------------------------------------------
*/

function getChatJid(
  message
) {
  return (
    message?.key?.remoteJid ||
    ""
  );
}

/*
|--------------------------------------------------------------------------
| GET SENDER JID
|--------------------------------------------------------------------------
*/

function getSenderJid(
  message
) {
  if (
    message?.key?.participant
  ) {
    return message.key.participant;
  }

  return (
    message?.key?.remoteJid ||
    ""
  );
}

/*
|--------------------------------------------------------------------------
| GET BOT JID
|--------------------------------------------------------------------------
*/

function getBotJid(
  sock
) {
  return (
    sock?.user?.id ||
    ""
  );
}

/*
|--------------------------------------------------------------------------
| NORMALIZE JID
|--------------------------------------------------------------------------
*/

function normalizeJid(
  jid
) {
  return String(
    jid || ""
  )
    .split(":")[0]
    .trim();
}

/*
|--------------------------------------------------------------------------
| NORMALIZE PHONE NUMBER
|--------------------------------------------------------------------------
*/

function normalizePhone(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /@s\.whatsapp\.net$/i,
      ""
    )
    .replace(
      /[^0-9]/g,
      ""
    );
}

/*
|--------------------------------------------------------------------------
| CHECK OWNER
|--------------------------------------------------------------------------
*/

function isOwner(
  message
) {
  const configuredOwner =
    config?.ownerNumber ||
    config?.owner?.number ||
    config?.bot?.ownerNumber ||
    process.env.OWNER_NUMBER ||
    "";

  const ownerNumber =
    normalizePhone(
      configuredOwner
    );

  if (!ownerNumber) {
    return false;
  }

  const senderNumber =
    normalizePhone(
      getSenderJid(message)
    );

  return Boolean(
    senderNumber &&
    senderNumber === ownerNumber
  );
}

/*
|--------------------------------------------------------------------------
| IS BOT MESSAGE
|--------------------------------------------------------------------------
*/

function isFromBot(
  message,
  sock
) {
  if (
    message?.key?.fromMe
  ) {
    return true;
  }

  const sender =
    normalizeJid(
      getSenderJid(message)
    );

  const bot =
    normalizeJid(
      getBotJid(sock)
    );

  return Boolean(
    sender &&
    bot &&
    sender === bot
  );
}
/*
|--------------------------------------------------------------------------
| IS BOT MESSAGE
|--------------------------------------------------------------------------
*/

function isFromBot(
  message,
  sock
) {
  if (
    message?.key?.fromMe
  ) {
    return true;
  }

  const sender =
    normalizeJid(
      getSenderJid(message)
    );

  const bot =
    normalizeJid(
      getBotJid(sock)
    );

  return Boolean(
    sender &&
    bot &&
    sender === bot
  );
}

/*
|--------------------------------------------------------------------------
| IS GROUP
|--------------------------------------------------------------------------
*/

function isGroup(
  jid
) {
  return String(
    jid || ""
  ).endsWith("@g.us");
}

/*
|--------------------------------------------------------------------------
| IS STATUS
|--------------------------------------------------------------------------
*/

function isStatus(
  jid
) {
  return (
    jid ===
    "status@broadcast"
  );
}

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| GET PREFIX FROM SETTINGS
|--------------------------------------------------------------------------
*/

function getPrefix(sessionId = "") {
  try {
    if (sessionId) {
      const session = sessionManager.getSession(sessionId);

      const savedSettings =
        settingPanel.getSessionSettings(sessionId) || {};

      const prefix = String(
        savedSettings.bot?.prefix ||
        session?.bot?.prefix ||
        config?.bot?.prefix ||
        "."
      ).trim();

      return prefix || ".";
    }
  } catch (error) {
    console.error(
      "[TOPFEROS MD] Prefix loading error:",
      error.stack || error.message
    );
  }

  return String(config?.bot?.prefix || ".").trim() || ".";
}

// ============================================================
// UNWRAP WHATSAPP MESSAGE
// ============================================================

function unwrapMessageContent(messageContent) {
  let current = messageContent;

  if (!current) {
    return null;
  }

  const wrapperKeys = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
    "editedMessage",
    "associatedChildMessage"
  ];

  let safety = 0;

  while (
    current &&
    safety < 10
  ) {
    safety++;

    let found = false;

    for (
      const key of wrapperKeys
    ) {
      if (
        current[key] &&
        typeof current[key] === "object"
      ) {
        current =
          current[key].message ||
          current[key];

        found = true;
        break;
      }
    }

    if (!found) {
      break;
    }
  }

  return current || null;
}

/*
|--------------------------------------------------------------------------
| PARSE COMMAND USING THE SAVED PREFIX
|--------------------------------------------------------------------------
*/

function parseCommand(text, sessionId = "") {
  const prefix = getPrefix(sessionId);

  const cleanText = String(text || "").trim();

  if (!cleanText.startsWith(prefix)) {
    return null;
  }

  const withoutPrefix = cleanText
    .slice(prefix.length)
    .trim();

  if (!withoutPrefix) {
    return null;
  }

  const parts = withoutPrefix.split(/\s+/);

  const command = String(parts.shift() || "")
    .toLowerCase();

  return {
    prefix,
    command,
    args: parts,
    text: parts.join(" "),
    raw: withoutPrefix
  };
}

/*
|--------------------------------------------------------------------------
| SEND TEXT
|--------------------------------------------------------------------------
*/

async function sendText(
  sock,
  jid,
  text,
  options = {}
) {
  if (!sock) {
    throw new Error(
      "WhatsApp socket is required."
    );
  }

  if (!jid) {
    throw new Error(
      "Chat JID is required."
    );
  }

  return sock.sendMessage(
    jid,
    {
      text:
        String(text || "")
    },
    options
  );
}

/*
|--------------------------------------------------------------------------
| SEND REACTION
|--------------------------------------------------------------------------
*/

async function reactToMessage(
  sock,
  message,
  emoji
) {
  if (
    !sock ||
    !message?.key ||
    typeof emoji !== "string" ||
    !emoji.trim()
  ) {
    return false;
  }

  try {
    await sock.sendMessage(
      message.key.remoteJid,
      {
        react: {
          text:
            emoji.trim(),
          key:
            message.key
        }
      }
    );

    return true;
  } catch (error) {
    console.error(
      "[MESSAGE] Reaction failed:",
      error?.message ||
        error
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| GET MODE
|--------------------------------------------------------------------------
*/

function getBotMode() {
  return (
    config?.bot?.mode ||
    "Public"
  );
}

/*
|--------------------------------------------------------------------------
| CHECK MODE
|--------------------------------------------------------------------------
*/

function canProcessMessage(
  message
) {
  const mode =
    String(
      getBotMode()
    )
      .trim()
      .toLowerCase();

  const jid =
    getChatJid(message);

  const group =
    isGroup(jid);

  if (mode === "public") {
    return true;
  }

  if (mode === "private") {
    return !group;
  }

  if (
    mode === "group" ||
    mode === "groups"
  ) {
    return group;
  }

  return true;
}

/*
|--------------------------------------------------------------------------
| BUILD COMMAND CONTEXT
|--------------------------------------------------------------------------
*/

function buildContext(
  sock,
  message,
  parsed,
  sessionId = ""
) {
  const jid = getChatJid(message);
  const sender = getSenderJid(message);

  return {
    sock,
    message,
    jid,
    sender,
    sessionId: String(sessionId || ""),

    isGroup: isGroup(jid),
    isStatus: isStatus(jid),
    isOwner: isOwner(message),

    command: parsed?.command || null,
    args: parsed?.args || [],
    text: parsed?.text || "",
    prefix: parsed?.prefix || getPrefix(sessionId),

    bot: config?.bot || {},
    config,

    send: (text, options = {}) =>
      sendText(sock, jid, text, options),

    react: (emoji) =>
      reactToMessage(sock, message, emoji)
  };
}

/*
|--------------------------------------------------------------------------
| COMMAND: MENU
|--------------------------------------------------------------------------
*/

registerCommand(
  "menu",
  async (ctx) => {
    await sendMenu(
      ctx.sock,
      ctx.message
    );

    return {
      success: true
    };
  },
  {
    description:
      "Display the TOPFEROS MD command menu.",

    usage:
      ".menu",

    category:
      "SYSTEM"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: HELP
|--------------------------------------------------------------------------
*/

registerCommand(
  "help",
  async (ctx) => {
    return helpCommand(ctx);
  },
  {
    aliases: ["h"],
    description: "Display the TOPFEROS MD help guide.",
    usage: ".help",
    category: "SYSTEM"
  }
);
/*
|--------------------------------------------------------------------------
| COMMAND: SETTING
| TOPFEROS MD V2.0.0
|--------------------------------------------------------------------------
*/

registerCommand(
  "setting",
  async (ctx) => {
    return await settingsCommand(ctx);
  },
  {
    aliases: ["settings"],
    description: "Display all bot settings and automation status.",
    usage: ".setting",
    category: "SETTINGS"
  }
);
/*
|--------------------------------------------------------------------------
| COMMAND: PARRAIN
|--------------------------------------------------------------------------
*/

registerCommand(
  "parrain",
  async (ctx) => {
    return parrainCommand(
      ctx.sock,
      ctx.message
    );
  },
  {
    description:
      "Generate a TOPFEROS MD Parrain code.",

    usage:
      ".parrain",

    category:
      "SYSTEM"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: PAIR
|--------------------------------------------------------------------------
*/

registerCommand(
  "pair",
  async (ctx) => {
    return pairCommand(
      ctx.sock,
      ctx.message,
      ctx.args
    );
  },
  {
    description:
      "Create an independent WhatsApp session using a pairing code.",

    usage:
      ".pair <phone number>",

    category:
      "SYSTEM"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: INFO
|--------------------------------------------------------------------------
*/

registerCommand(
  "info",
  async (ctx) => {
    const bot =
      config?.bot || {};

    const info = `
╭━━━〔 ⚙️ BOT INFORMATION 〕━━━╮
┃
┃ 🦁 Name     : ${bot.name || "TOPFEROS MD"}
┃ 📦 Version  : V${bot.version || "2.0.0"}
┃ 🔹 Prefix   : ${bot.prefix || "."}
┃ 🌐 Mode     : ${bot.mode || "Public"}
┃ 📍 Location : ${bot.location || "HAÏTI"}
┃ 🌎 Language : ${bot.language || "English"}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🦁 TECH BY TOPFEROS MD 🐑
`.trim();

    await ctx.send(info);

    return {
      success: true
    };
  },
  {
    description:
      "Display bot information.",

    usage:
      ".info",

    category:
      "SYSTEM"
  }
);


/*
|--------------------------------------------------------------------------
| COMMAND: AI — INTEGRATED CHAT AND FORWARD SYSTEM
|--------------------------------------------------------------------------
*/

function getAIForwardNotice(answer) {
  const text = String(answer || "").toLowerCase();

  if (/[àâçéèêëîïôùûüÿœ]/i.test(text) ||
      /\b(bonjour|merci|vous|votre|réponse|question|continuer)\b/i.test(text)) {
    return "💬 *Pour continuer cette conversation :* Transférez-moi cette réponse ou répondez directement à ce message. 🤖";
  }

  if (/\b(hello|thanks|your|answer|question|continue|please)\b/i.test(text)) {
    return "💬 *To continue this conversation:* Forward this answer back to me or reply directly to this message. 🤖";
  }

  return "💬 *Pou kontinye konvèsasyon an:* Fè *Forward* mesaj sa a tounen ban mwen, oswa reponn dirèkteman sou mesaj sa a. 🤖";
}

registerCommand(
  "ai",
  async (ctx) => {
    if (!ctx.text) {
      await ctx.send(
        `🤖 Voye kesyon ou konsa:\n${ctx.prefix}ai Ki sa entèlijans atifisyèl ye?`
      );

      return { success: false };
    }

   try {
  const result = await startAIChat(
    ctx.jid,
    ctx.text
  );

  if (result?.busy) {
    await ctx.send(
      "⏳ AI a ap trete yon kesyon. Tanpri tann."
    );

    return { success: false };
}

      if (!result || !result.answer) {
        await ctx.send("❌ AI a pa retounen yon repons.");
        return { success: false };
      }

      const outgoing =
        `${result.answer}\n\n${getAIForwardNotice(result.answer)}`;

      const sent = await ctx.send(outgoing);

      setLastAIMessage(
        ctx.jid,
        sent?.key?.id || null,
        outgoing
      );

      return {
        success: true,
        answer: result.answer
      };
    } catch (error) {
      console.error("[AI CHAT]", error?.stack || error);

      await ctx.send(
        "❌ Mwen pa kapab reponn kounye a. Verifye konfigirasyon Gemini API a epi eseye ankò."
      );

      return { success: false };
    }
  },
  {
    description: "Start a new AI conversation.",
    usage: ".ai <question>",
    category: "AI"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: PROMPT
|--------------------------------------------------------------------------
*/

registerCommand(
  "prompt",
  async (ctx) => {
    if (!ctx.text) {
      await ctx.send(
        [
          "🤖 Please provide a prompt request.",
          "",
          `Example: ${ctx.prefix}prompt Create a cinematic lion logo`,
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );

      return {
        success: false
      };
    }

    await ctx.send(
      [
        "🤖 PROMPT REQUEST RECEIVED",
        "",
        `📝 ${ctx.text}`,
        "",
        "⚙️ Prompt AI service is not connected yet.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: true,
      pending: true
    };
  },
  {
    description:
      "Generate or improve an AI prompt.",

    usage:
      ".prompt <request>",

    category:
      "AI"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: PLAY
|--------------------------------------------------------------------------
*/

registerCommand(
  "play",
  async (ctx) => {
    return playCommand(ctx);
  },
  {
    description:
      "Download and send authorized audio or video media.",

    usage:
      ".play <song|video> <direct-url>",

    category:
      "MEDIA"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: VIDEO
|--------------------------------------------------------------------------
*/

registerCommand(
  "video",
  async (ctx) => {
    if (!ctx.text) {
      await ctx.send(
        [
          "🎬 Please provide a video URL.",
          "",
          `Example: ${ctx.prefix}video https://example.com/video`,
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );

      return {
        success: false
      };
    }

    await ctx.send(
      [
        "🎬 VIDEO REQUEST RECEIVED",
        "",
        `🔗 ${ctx.text}`,
        "",
        "⚙️ Video service is not connected yet.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: true,
      pending: true
    };
  },
  {
    description:
      "Download and send a video.",

    usage:
      ".video <url>",

    category:
      "MEDIA"
  }
);

/*
|--------------------------------------------------------------------------
| COMMAND: GSTATUS
|--------------------------------------------------------------------------
*/

registerCommand(
  "gstatus",
  async (ctx) => {
    return groupStatusCommand(ctx);
  },
  {
    aliases: [
      "groupstatus"
    ],

    description:
      "Publish a group image or video to WhatsApp Status.",

    usage:
      ".gstatus",

    category:
      "GROUP"
  }
);

/*
|--------------------------------------------------------------------------
| ATTACH STATUS AI
|--------------------------------------------------------------------------
*/

function attachStatusAI(
  sock,
  options = {}
) {
  if (!sock) {
    throw new Error(
      "WhatsApp socket is required."
    );
  }

  if (
    attachedSockets.has(sock)
  ) {
    return false;
  }

  if (
    options.enabled === false
  ) {
    return false;
  }

  attachStatusHandler(
    sock,
    {
      autoStatusReact:
        options.autoStatusReact !== false,

      autoStatusSeen:
        options.autoStatusSeen !== false,

      autoStatusReply:
        options.autoStatusReply !== false
    }
  );

  attachedSockets.add(
    sock
  );

  return true;
}


/*
|--------------------------------------------------------------------------
| AUTO TYPING / AUTO RECORDING
|--------------------------------------------------------------------------
*/

async function startAutoPresence(
  sock,
  sessionId,
  jid,
  mode = "typing"
) {
  try {
    if (!sock || !sessionId || !jid) return null;

    const settings =
      settingPanel.getSessionSettings(sessionId);

    const automation = settings?.automation || {};

    if (mode === "recording") {
      if (automation.fakeRecording !== true) return null;

      await sock.presenceSubscribe(jid);
      await sock.sendPresenceUpdate("recording", jid);

      return {
        status: "recording",
        startedAt: Date.now()
      };
    }

    if (automation.fakeTyping !== true) return null;

    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate("composing", jid);

    return {
      status: "composing",
      startedAt: Date.now()
    };

  } catch (error) {
    console.error("[AUTO PRESENCE]", error?.message || error);
    return null;
  }
}

async function stopAutoPresence(sock, jid, presence) {
  if (!sock || !jid || !presence) return;

  try {
    const elapsed = Date.now() - presence.startedAt;
    const remaining = Math.max(0, 10000 - elapsed);

    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }

    await sock.sendPresenceUpdate("paused", jid);

  } catch (error) {
    console.error("[AUTO PRESENCE STOP]", error?.message || error);
  }
}

/*
|--------------------------------------------------------------------------
| HANDLE MESSAGE
| TOPFEROS MD V2.0.0
|--------------------------------------------------------------------------
*/

async function handleMessageCore(sock, message, sessionId) {
  try {
    if (!sock || !message) {
      return {
        success: false,
        reason: "Invalid message."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | ANTI BUG GUARD
    |--------------------------------------------------------------------------
    */

    try {
      const currentSettings =
        settingPanel.getSessionSettings(sessionId) || {};

      const automation =
        currentSettings.automation || {};

      if (
        automation.antiBug === true &&
        isUnsafeMessageStructure(message)
      ) {
        return {
          success: false,
          ignored: true,
          reason: "Anti Bug: invalid message structure."
        };
      }
    } catch (error) {
      console.error(
        "[TOPFEROS MD] Anti Bug error:",
        error?.message || error
      );
    }

    rememberMessageKey(message, sessionId);

    /*
    |--------------------------------------------------------------------------
    | IGNORE BOT MESSAGES
    |--------------------------------------------------------------------------
    */

    if (
      !message?.key?.fromMe &&
      isFromBot(message, sock)
    ) {
      return {
        success: false,
        ignored: true,
        reason: "Message originated from bot."
      };
    }

    const jid = getChatJid(message);

/*
|--------------------------------------------------------------------------
| GROUP BIO / PRINCIPLES + VIOLATION LIMIT
|--------------------------------------------------------------------------
*/

try {
  if (
    isGroup(jid) &&
    !message?.key?.fromMe
  ) {
    const groupSettings =
      settingPanel.getSessionSettings(sessionId) || {};

    const groupAutomation =
      groupSettings.groupAutomation || {};

    const groupText =
      extractMessageText(message.message);

    if (
      groupText &&
      groupAutomation.principles
    ) {
      const moderationResult =
        await groupPrinciplesService.handleGroupPrinciples({
          sock,
          message,
          sessionId,
          settings: groupAutomation,
          messageText: groupText
        });

      if (moderationResult?.handled) {
        return {
          success: true,
          ignored: true,
          command: "group-principles",
          result: moderationResult,
          sessionId: sessionId || null
        };
      }
    }
  }
} catch (error) {
  console.error(
    "[GROUP PRINCIPLES CONNECTION]",
    error?.stack || error
  );
}

    // CONTINUE WITH THE REST OF YOUR ORIGINAL CODE HERE.

    /*
    |--------------------------------------------------------------------------
    | STATUS HANDLER
    |--------------------------------------------------------------------------
    */

    if (isStatus(jid)) {
      return {
        success: false,
        ignored: true,
        reason: "Status handled by statusHandler."
      };
    }
/*
|--------------------------------------------------------------------------
| ANTI-SPAM PROTECTION
|--------------------------------------------------------------------------
*/

try {
  const spamSettings =
    settingPanel.getSessionSettings(sessionId) || {};

  const spamAutomation =
    spamSettings.automation || {};

  if (
    spamAutomation.antiSpam === true &&
    !message?.key?.fromMe &&
    !isFromBot(message, sock) &&
    !isOwner(message)
  ) {
    const spamResult = await antiSpam.punish({
  sock,
  message,
  sessionId,
  antiSpamMode: spamAutomation.antiSpamMode || "warn"
});

    if (spamResult.handled) {
      return {
        success: false,
        ignored: true,
        reason: spamResult.spam
  ? `Anti-Spam: ${spamResult.mode || "warn"} applied.`
  : "Anti-Spam: sender already blocked.",
        antiSpam: spamResult,
        sessionId: sessionId || null
      };
    }
  }
} catch (error) {
  console.error(
    "[TOPFEROS MD ANTI-SPAM]",
    error?.stack || error
  );
}
    /*
    |--------------------------------------------------------------------------
    | BOT MODE
    |--------------------------------------------------------------------------
    */

    if (!canProcessMessage(message)) {
      return {
        success: false,
        ignored: true,
        reason: "Message not allowed in current bot mode."
      };
    }

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| ANTI-BOT SERVICE CONNECTION
|--------------------------------------------------------------------------
*/

const filterSettings =
  settingPanel.getSessionSettings(sessionId) || {};

const filterAutomation =
  filterSettings.automation || {};

try {
  const antiBotResult =
    await antiBotService.handleAntiBot({
      sock,
      message,
      sessionId,
      settings: filterAutomation,
      isOwner: isOwner(message),

      ownerJid: (() => {
        const ownerNumber =
          config?.ownerNumber ||
          config?.owner?.number ||
          config?.bot?.ownerNumber ||
          process.env.OWNER_NUMBER ||
          "";

        const cleanOwner =
          String(ownerNumber).replace(/\D/g, "");

        return cleanOwner
          ? `${cleanOwner}@s.whatsapp.net`
          : "";
      })()
    });

  if (antiBotResult?.detected) {
    return {
      success: true,
      ignored: true,
      command: "anti-bot",
      result: antiBotResult,
      sessionId: sessionId || null
    };
  }
} catch (error) {
  console.error(
    "[TOPFEROS MD ANTI-BOT SERVICE]",
    error?.stack || error
  );
}

    /*
    |--------------------------------------------------------------------------
    | EXTRACT MESSAGE TEXT
    |--------------------------------------------------------------------------
    */

    const messageText =
      extractMessageText(message.message);

    /*
    |--------------------------------------------------------------------------
    | CONTINUE AI CHAT THROUGH REPLY OR FORWARD
    |--------------------------------------------------------------------------
    */

    if (
      !message?.key?.fromMe &&
      messageText &&
      hasSession(jid)
    ) {
      const contextInfo =
        message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo ||
        {};

      const quotedMessageId = contextInfo.stanzaId;

      const isReply = isReplyToLastAIMessage(
        jid,
        quotedMessageId
      );

      const isForwarded = Boolean(
        contextInfo.isForwarded ||
        Number(contextInfo.forwardingScore || 0) > 0
      );


const forwardQuestion = getForwardQuestion(
  jid,
  messageText
);

const isAIForward =
  forwardQuestion !== null;

      const parsedAICommand =
        parseCommand(messageText, sessionId);

      const isCommand = Boolean(parsedAICommand);

      const waiting = isWaitingForQuestion(jid);

      if (isAIForward && !forwardQuestion) {
        setWaitingForQuestion(jid, true);

        await sendText(
          sock,
          jid,
          "🤖 Mwen rekonèt repons AI ou transfere a. " +
          "Voye pwochen kesyon ou san prefix .ai."
        );

        return {
          success: true,
          command: "ai-forward-waiting"
        };
      }

      const shouldContinue =
        isReply ||
        (isAIForward && Boolean(forwardQuestion)) ||
        (waiting && !isCommand);

if (shouldContinue) {
  const continuationText =
    isAIForward && forwardQuestion
      ? forwardQuestion
      : messageText;

  const presence = await startAutoPresence(
    sock,
    sessionId,
    jid
  );

  try {
    const result = await continueAIChat(
      jid,
      continuationText
    );

    if (result?.busy) {
      await sendText(
        sock,
        jid,
        "⏳ AI a ap trete yon kesyon. Tanpri tann."
      );

      return {
        success: false,
        reason: "AI session busy."
      };
    }

    if (result?.answer) {
      const outgoing =
        `${result.answer}\n\n${getAIForwardNotice(result.answer)}`;

      const sent = await sendText(
        sock,
        jid,
        outgoing
      );

      setLastAIMessage(
        jid,
        sent?.key?.id || null,
        outgoing
      );

      setWaitingForQuestion(jid, false);

      return {
        success: true,
        command: "ai-continue"
      };
    }
  } catch (error) {
    console.error(
      "[AI CHAT CONTINUE]",
      error?.stack || error
    );

    await sendText(
      sock,
      jid,
      "❌ AI a pa kapab kontinye kounye a. Eseye ankò."
    );

    return {
      success: false,
      reason: "AI continuation failed."
    };
    } finally {
    await stopAutoPresence(
      sock,
      jid,
      presence
    );
  }
}

} // Fèmen kondisyon hasSession(jid)

/*
|--------------------------------------------------------------------------
| COMMANDS: SAVE / SEND WITHOUT PREFIX
|--------------------------------------------------------------------------
*/

    const plainCommand =
      (messageText || "").trim().toLowerCase();

    if (
      !message?.key?.fromMe &&
      ["save", "send"].includes(plainCommand)
    ) {
      const found = findCommand(plainCommand);

      if (found) {
        const context = buildContext(
          sock,
          message,
          {
            command: plainCommand,
            args: [],
            text: "",
            prefix: ""
          },
          sessionId
        );

        await found.command.handler(context);

        return {
          success: true,
          command: plainCommand,
          sessionId: sessionId || null
        };
      }
    }

    /*
    |--------------------------------------------------------------------------
    | IGNORE MESSAGES WITHOUT COMMAND TEXT
    |--------------------------------------------------------------------------
    */

    if (!messageText) {
      return {
        success: false,
        ignored: true,
        reason: "No command text."
      };
    }

/*
|--------------------------------------------------------------------------
| PARSE COMMAND
|--------------------------------------------------------------------------
*/

const parsed =
  parseCommand(messageText, sessionId);

// Ignore messages that are not bot commands.
if (!parsed) {
  return {
    success: false,
    ignored: true,
    reason: "Message is not a command."
  };
}

    /*
    |--------------------------------------------------------------------------
    | OWNER COMMAND: UNBLOCK SPAM NUMBER
    |--------------------------------------------------------------------------
    */

    if (
      parsed?.command === "unblock" &&
      isOwner(message)
    ) {
      const number = parsed.args?.[0];

      if (!number) {
        await sendText(
          sock,
          jid,
          "❌ Itilizasyon: .unblock 509XXXXXXXX"
        );

        return {
          success: false,
          command: "unblock"
        };
      }

      const result = await antiSpam.unblock(
        sock,
        number
      );

      await sendText(
        sock,
        jid,
        result.success
          ? `✅ Nimewo ${result.number} debloke avèk siksè.`
          : `❌ Deblokaj la echwe: ${result.reason}`
      );

      return {
        success: result.success,
        command: "unblock"
      };
    }

    if (
      parsed?.command === "blocklist" &&
      isOwner(message)
    ) {
      const numbers = antiSpam.getBlockedNumbers();

      await sendText(
        sock,
        jid,
        numbers.length
          ? "🚫 *ANTI-SPAM BLOCKLIST*\n\n" +
            numbers.map((n, i) => `${i + 1}. ${n}`).join("\n")
          : "✅ Pa gen nimewo nan lis blokaj la."
      );

      return {
        success: true,
        command: "blocklist"
      };
    }

    /*
    |--------------------------------------------------------------------------
    | FIND COMMAND
    |--------------------------------------------------------------------------
    */

    const found = findCommand(parsed.command);

    if (!found) {
      await sendText(
        sock,
        jid,
        [
          `❌ Unknown command: ${getPrefix(sessionId)}${parsed.command}`,
          "",
          `📖 Type ${getPrefix(sessionId)}menu to see available commands.`,
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );

      return {
        success: false,
        reason: "Unknown command."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | BUILD COMMAND CONTEXT
    |--------------------------------------------------------------------------
    */

    const context = buildContext(
      sock,
      message,
      parsed,
      sessionId
    );

    await reactToMessage(
      sock,
      message,
      "🦁"
    );

    /*
    |--------------------------------------------------------------------------
    | OWNER COMMAND STATISTICS
    |--------------------------------------------------------------------------
    */

    if (context.isOwner) {
      try {
        const ownerStats =
          recordOwnerCommand(found.name);

        context.bot.ownerStats = ownerStats;
      } catch (statsError) {
        console.error(
          "[OWNER STATS] Record failed:",
          statsError?.stack || statsError
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | EXECUTE COMMAND WITH AUTO TYPING / RECORDING
    |--------------------------------------------------------------------------
    */

const result = await found.command.handler(context);

return {
  success: true,
  command: found.name,
  result,
  sessionId: sessionId || null
};

  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | ERROR LOGGING — NO AUTOMATIC ERROR MESSAGE TO CONTACTS
    |--------------------------------------------------------------------------
    */

    console.error(
      "[MESSAGE HANDLER] Error:",
      error?.stack || error
    );

    return {
      success: false,
      error: error?.message || String(error)
    };
  }
}

/*
|--------------------------------------------------------------------------
| GLOBAL AUTO PRESENCE FOR PRIVATE MESSAGES
|--------------------------------------------------------------------------
*/

async function handleMessage(sock, message, sessionId) {
  const jid = getChatJid(message);

  const isPrivateMessage =
    jid &&
    !isGroup(jid) &&
    !isStatus(jid) &&
    !message?.key?.fromMe;

  let presence = null;

  try {
    if (isPrivateMessage) {
      presence = await startAutoPresence(
        sock,
        sessionId,
        jid,
        "typing"
      );
    }

    return await handleMessageCore(
      sock,
      message,
      sessionId
    );

  } finally {
    if (presence) {
      await stopAutoPresence(sock, jid, presence);
    }
  }
}

/*
|--------------------------------------------------------------------------
| GET REGISTERED COMMANDS
|--------------------------------------------------------------------------
*/

function getCommands() {
  const result = [];

  for (
    const [
      name,
      command
    ] of commands
  ) {
    result.push({
      name,

      aliases:
        [...command.aliases],

      description:
        command.description,

      usage:
        command.usage,

      category:
        command.category
    });
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| COMMANDS: SAVE / SEND
|--------------------------------------------------------------------------
*/

registerCommand("save", saveCommand, {
  description: "Identify a quoted WhatsApp Status.",
  usage: "save",
  category: "STATUS"
});

registerCommand("send", sendCommand, {
  description: "Identify a quoted WhatsApp Status.",
  usage: "send",
  category: "STATUS"
});

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  handleMessage,

  getCachedMessages,

  registerCommand,

  findCommand,

  getCommands,

  parseCommand,

  extractMessageText,

  getMessageType,

  getChatJid,

  getSenderJid,

  isGroup,

  isStatus,

  isFromBot,

  sendText,

  reactToMessage,

  attachStatusAI,

  isOwner,

rememberMessageKey,
getCachedMessageKey,
};
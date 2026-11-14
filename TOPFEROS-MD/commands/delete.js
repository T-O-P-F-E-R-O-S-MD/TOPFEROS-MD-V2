
"use strict";

const {
  isGroupAdmin,
  isBotGroupAdmin
} = require("../services/groupAdmin");

const delay = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function normalizeJid(jid) {
  return String(jid || "")
    .split(":")[0]
    .toLowerCase();
}

function getQuotedInfo(ctx) {
  let content = ctx.message?.message;

  while (content) {
    const wrapper =
      content.ephemeralMessage ||
      content.viewOnceMessage ||
      content.viewOnceMessageV2 ||
      content.documentWithCaptionMessage;

    if (!wrapper?.message) break;
    content = wrapper.message;
  }

  const containers = [
    content?.extendedTextMessage,
    content?.imageMessage,
    content?.videoMessage,
    content?.documentMessage,
    content?.stickerMessage,
    content?.audioMessage
  ];

  const info = containers
    .map(item => item?.contextInfo)
    .find(item => item?.stanzaId);

  if (!info) return null;

  return {
    id: info.stanzaId,
    participant: info.participant
  };
}

async function delCommand(ctx) {
  const quoted = getQuotedInfo(ctx);

  if (!quoted) {
    return ctx.send(
      "⚠️ Reponn mesaj ou vle retire a.\n\n" +
      "Voye .del pou retire l pou kont bot la sèlman."
    );
  }

  try {
    const cached = require("../src/messageHandler")
      .getCachedMessageKey(
        ctx.sessionId,
        ctx.jid,
        quoted.id
      );

    if (!cached) {
      return ctx.send(
        "❌ Mwen pa jwenn dat mesaj la nan memwa bot la."
      );
    }

    const key = {
      remoteJid: ctx.jid,
      id: quoted.id,
      fromMe: cached.fromMe,
      ...(cached.participant
        ? { participant: cached.participant }
        : {})
    };

    await ctx.sock.chatModify(
      {
        deleteForMe: {
          key,
          timestamp: String(cached.timestamp),
          deleteMedia: false
        }
      },
      ctx.jid
    );

    return {
      success: true,
      action: "delete-for-me"
    };

  } catch (error) {
    console.error("[DEL]", error);

    return ctx.send(
      "❌ WhatsApp pa t konfime efasman lokal la.\n\n" +
      "Eseye ankò oswa verifye vèsyon Baileys la."
    );
  }
}

async function deltCommand(ctx) {
  const quoted = getQuotedInfo(ctx);

  if (!quoted) {
    return ctx.send(
      "⚠️ Reponn mesaj ou vle efase a, epi voye .delt."
    );
  }

  try {
    const cached = require("../src/messageHandler")
      .getCachedMessageKey(
        ctx.sessionId,
        ctx.jid,
        quoted.id
      );

    const botIds = [
      ctx.sock.user?.id,
      ctx.sock.user?.lid,
      ctx.sock.user?.phoneNumber
    ].filter(Boolean).map(normalizeJid);

    const participant =
      cached?.participant || quoted.participant;

    const fromMe = cached
      ? cached.fromMe
      : Boolean(
          participant &&
          botIds.includes(normalizeJid(participant))
        );

    const key = {
      remoteJid: ctx.jid,
      id: quoted.id,
      fromMe,
      ...(participant ? { participant } : {})
    };

    await ctx.sock.sendMessage(ctx.jid, {
      delete: key
    });

    return {
      success: true,
      action: "delete-for-everyone"
    };

  } catch (error) {
    console.error("[DELT]", error);

    return ctx.send(
      "❌ WhatsApp pa t kapab efase mesaj la pou tout moun.\n" +
      "Verifye otorizasyon ak limit efasman WhatsApp yo."
    );
  }
}

async function deleteCommand(ctx) {
  try {
    const timestamp =
      ctx.message?.messageTimestamp;

    if (!ctx.message?.key?.id || !timestamp) {
      throw new Error("Message key or timestamp unavailable.");
    }

    await ctx.sock.chatModify(
      {
        clear: true,
        lastMessages: [
          {
            key: ctx.message.key,
            messageTimestamp: timestamp
          }
        ]
      },
      ctx.jid
    );

    return ctx.send(
      "✅ CHAT CLEAN REQUEST SENT\n\n" +
      "Konvèsasyon an mande netwayaj sou kont bot la.\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

  } catch (error) {
    console.error("[DELETE]", error);

    return ctx.send(
      "❌ Mwen pa t kapab netwaye chat la.\n\n" +
      (error.message || "WhatsApp error.")
    );
  }
}

async function cleanGroupCommand(ctx) {
  if (!ctx.isGroup) {
    return ctx.send(
      "❌ Kòmand sa a mache nan gwoup sèlman."
    );
  }

  try {
    const metadata =
      await ctx.sock.groupMetadata(ctx.jid);

    const botAdmin =
      await isBotGroupAdmin(ctx.sock, metadata);

    if (!botAdmin) {
      return ctx.send(
        "❌ BOT ADMIN REQUIRED\n\n" +
        "Bot la dwe admin nan gwoup la."
      );
    }

    const senderAdmin =
      await isGroupAdmin(
        ctx.sock,
        metadata,
        ctx.sender
      );

    if (!senderAdmin && !ctx.isOwner) {
      return ctx.send(
        "❌ Se admin gwoup la oswa mèt bot la ki ka itilize kòmand sa a."
      );
    }

    const getMessages =
      require("../src/messageHandler")
        .getCachedMessages;

    if (typeof getMessages !== "function") {
      throw new Error("Message cache unavailable.");
    }

    const messages =
      getMessages(ctx.sessionId, ctx.jid);

    if (!messages.length) {
      return ctx.send(
        "ℹ️ Pa gen mesaj ki anrejistre nan memwa bot la."
      );
    }

    await ctx.send(
      `🧹 GROUP CLEANER STARTED\n\n` +
      `Mesaj bot la kapab eseye efase: ${messages.length}\n` +
      `M ap travay youn apre lòt...`
    );

    let deleted = 0;
    let failed = 0;

    for (const message of messages) {
      try {
        await ctx.sock.sendMessage(
          ctx.jid,
          {
            delete: {
              remoteJid: message.remoteJid,
              id: message.id,
              fromMe: message.fromMe,
              ...(message.participant
                ? { participant: message.participant }
                : {})
            }
          }
        );

        deleted++;
        await delay(80);

      } catch (error) {
        failed++;

        console.error(
          "[CLEANGR MESSAGE]",
          message.id,
          error.message
        );
      }
    }

    await ctx.send(
      `🧹 GROUP CLEANER REPORT\n\n` +
      `📨 Mesaj jwenn: ${messages.length}\n` +
      `✅ Demann efasman voye: ${deleted}\n` +
      `❌ Echèk: ${failed}\n\n` +
      `⚠️ WhatsApp toujou deside ki mesaj ki ka efase tout bon.\n\n` +
      `🦁 TECH BY TOPFEROS MD 🐑`
    );

    return {
      success: true,
      found: messages.length,
      requested: deleted,
      failed
    };

  } catch (error) {
    console.error("[CLEANGR]", error);

    return ctx.send(
      "❌ GROUP CLEANER ERROR\n\n" +
      (error.message || "Unknown error.")
    );
  }
}

function init() {
  const {
    registerCommand
  } = require("../src/messageHandler");

  registerCommand("del", delCommand, {
    description: "Delete a replied message for this account.",
    category: "MESSAGES"
  });

  registerCommand("delt", deltCommand, {
    description: "Delete a replied message for everyone.",
    category: "MESSAGES"
  });

  registerCommand("delete", deleteCommand, {
    description: "Clear the local chat.",
    category: "MESSAGES"
  });

  registerCommand("cleangr", cleanGroupCommand, {
    description: "Clean cached group messages where WhatsApp permits.",
    category: "GROUP"
  });
}

module.exports = {
  init,
  delCommand,
  deltCommand,
  deleteCommand,
  cleanGroupCommand
};


"use strict";

const { registerCommand } = require("../src/messageHandler");

function unwrapMessage(message) {
  let content = message?.message || {};

  while (
    content.ephemeralMessage ||
    content.viewOnceMessage ||
    content.viewOnceMessageV2 ||
    content.documentWithCaptionMessage
  ) {
    content =
      content.ephemeralMessage?.message ||
      content.viewOnceMessage?.message ||
      content.viewOnceMessageV2?.message ||
      content.documentWithCaptionMessage?.message ||
      content;
  }

  return content;
}

function getQuotedKey(ctx) {
  const content = unwrapMessage(ctx.message);

  const contextInfo =
    content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    content.videoMessage?.contextInfo ||
    content.documentMessage?.contextInfo ||
    content.stickerMessage?.contextInfo ||
    content.audioMessage?.contextInfo;

  if (!contextInfo?.stanzaId) {
    return null;
  }

  const botId = ctx.sock?.user?.id
    ?.split(":")[0]
    ?.split("@")[0];

  const participant = contextInfo.participant;

  const fromMe = Boolean(
    participant &&
    botId &&
    participant.split(":")[0].split("@")[0] === botId
  );

  return {
    remoteJid: ctx.jid,
    id: contextInfo.stanzaId,
    fromMe,
    ...(participant ? { participant } : {})
  };
}

async function deleteCommand(ctx) {
  const key = getQuotedKey(ctx);

  if (!key) {
    await ctx.send(
      "⚠️ Reponn mesaj ou vle efase a.\n\n" +
      "Apre sa, voye .delete\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

    return { success: false };
  }

  try {
    await ctx.sock.sendMessage(ctx.jid, {
      delete: key
    });

    return {
      success: true,
      command: "delete"
    };

  } catch (error) {
    console.error("[DELETE ERROR]", error);

    await ctx.send(
      "❌ Mwen pa kapab efase mesaj sa a.\n\n" +
      "Verifye si WhatsApp pèmèt efasman an " +
      "ak si bot la gen otorizasyon ki nesesè.\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

    return { success: false };
  }
}

registerCommand("delete", deleteCommand, {
  aliases: ["del", "delt"],
  description: "Delete a replied WhatsApp message.",
  usage: ".delete",
  category: "MESSAGES"
});

module.exports = {
  deleteCommand,
  getQuotedKey
};

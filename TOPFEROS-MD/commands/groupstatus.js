
"use strict";

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const { registerCommand } = require("../src/messageHandler");

const {
  isGroupAdmin
} = require("../services/groupAdmin");

function unwrapMessage(message) {
  let current = message;

  while (current) {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
      continue;
    }

    if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message;
      continue;
    }

    if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message;
      continue;
    }

    break;
  }

  return current;
}

function getQuotedMessage(message) {
  const content = unwrapMessage(message?.message);

  const context =
    content?.extendedTextMessage?.contextInfo ||
    content?.imageMessage?.contextInfo ||
    content?.videoMessage?.contextInfo;

  return context?.quotedMessage
    ? unwrapMessage(context.quotedMessage)
    : null;
}

async function downloadMedia(mediaMessage, type) {
  const stream = await downloadContentFromMessage(
    mediaMessage,
    type
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function groupStatusCommand(ctx) {
  if (!ctx.isGroup) {
    return ctx.send("❌ This command only works in groups.");
  }

  try {
    const metadata = await ctx.sock.groupMetadata(ctx.jid);

    if (!await isGroupAdmin(ctx.sock, metadata, ctx.sender)) {
      return ctx.send(
        "❌ ADMIN ONLY\n\nOnly group admins can publish group status."
      );
    }

    const quoted = getQuotedMessage(ctx.message);

    const imageMessage = quoted?.imageMessage;
    const videoMessage = quoted?.videoMessage;

    if (!imageMessage && !videoMessage) {
      return ctx.send(
        `❌ IMAGE OR VIDEO REQUIRED\n\nReply to an image or video with:\n${ctx.prefix}gstatus`
      );
    }

    const isImage = Boolean(imageMessage);

    const media = await downloadMedia(
      isImage ? imageMessage : videoMessage,
      isImage ? "image" : "video"
    );

    if (!media?.length) {
      throw new Error("Media download returned empty data.");
    }

    const caption = String(ctx.text || "").trim();

    const statusMessage = isImage
      ? {
          image: media,
          caption
        }
      : {
          video: media,
          caption
        };

    await ctx.sock.sendMessage(
      "status@broadcast",
      statusMessage
    );

    await ctx.send(
      `✅ STATUS PUBLISHED\n\n${isImage ? "🖼️ Image" : "🎥 Video"} published to WhatsApp Status.\n\n🦁 TECH BY TOPFEROS MD 🐑`
    );

    return {
      success: true,
      type: isImage ? "image" : "video"
    };

  } catch (error) {
    console.error("[GSTATUS]", error?.stack || error);

    await ctx.send(
      `❌ STATUS PUBLISH FAILED\n\n${error.message || "Unknown WhatsApp error."}`
    );

    return { success: false };
  }
}

registerCommand("gstatus", groupStatusCommand, {
  aliases: ["groupstatus"],
  description: "Publish a replied image or video to WhatsApp Status.",
  usage: ".gstatus [caption]",
  category: "GROUP"
});

module.exports = { groupStatusCommand };

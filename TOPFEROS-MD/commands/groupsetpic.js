
"use strict";

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const { registerCommand } = require("../src/messageHandler");

const {
  isGroupAdmin,
  isBotGroupAdmin
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

async function setGroupPicCommand(ctx) {
  if (!ctx.isGroup) {
    return ctx.send("❌ This command only works in groups.");
  }

  try {
    const metadata = await ctx.sock.groupMetadata(ctx.jid);

    if (!await isGroupAdmin(ctx.sock, metadata, ctx.sender)) {
      return ctx.send("❌ ADMIN ONLY\n\nOnly group admins can change the group photo.");
    }

    if (!await isBotGroupAdmin(ctx.sock, metadata)) {
      return ctx.send("❌ BOT MUST BE ADMIN\n\nMake the bot a group admin first.");
    }

    const quoted = getQuotedMessage(ctx.message);
    const imageMessage = quoted?.imageMessage;

    if (!imageMessage) {
      return ctx.send(
        `❌ IMAGE REQUIRED\n\nReply directly to an image with:\n${ctx.prefix}setpic`
      );
    }

    const buffer = await downloadMedia(
      imageMessage,
      "image"
    );

    if (!buffer?.length) {
      throw new Error("Image download returned empty data.");
    }

    await ctx.sock.updateProfilePicture(
      ctx.jid,
      buffer
    );

    await ctx.send(
      "✅ GROUP PHOTO UPDATED\n\nThe group photo has been changed successfully.\n\n🦁 TECH BY TOPFEROS MD 🐑"
    );

    return { success: true };

  } catch (error) {
    console.error("[SETPIC]", error?.stack || error);

    await ctx.send(
      `❌ PHOTO UPDATE FAILED\n\n${error.message || "Unknown WhatsApp error."}`
    );

    return { success: false };
  }
}

registerCommand("setpic", setGroupPicCommand, {
  aliases: ["grouppic", "setphoto"],
  description: "Change the group photo by replying to an image.",
  usage: ".setpic",
  category: "GROUP"
});

module.exports = { setGroupPicCommand };

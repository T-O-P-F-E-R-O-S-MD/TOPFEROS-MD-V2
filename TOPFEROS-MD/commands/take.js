
"use strict";

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const {
  Sticker
} = require("wa-sticker-formatter");

const {
  registerCommand
} = require("../src/messageHandler");

function unwrapMessage(message) {
  let current = message?.message;

  while (current) {
    const wrapper =
      current.ephemeralMessage ||
      current.viewOnceMessage ||
      current.viewOnceMessageV2;

    if (!wrapper?.message) break;

    current = wrapper.message;
  }

  return current;
}

function getQuotedSticker(message) {
  const content = unwrapMessage(message);

  const context =
    content?.extendedTextMessage?.contextInfo ||
    content?.imageMessage?.contextInfo ||
    content?.videoMessage?.contextInfo;

  const quoted = context?.quotedMessage;

  if (!quoted) return null;

  let current = quoted;

  while (current) {
    const wrapper =
      current.ephemeralMessage ||
      current.viewOnceMessage ||
      current.viewOnceMessageV2;

    if (!wrapper?.message) break;

    current = wrapper.message;
  }

  return current?.stickerMessage || null;
}

async function downloadSticker(stickerMessage) {
  const stream = await downloadContentFromMessage(
    stickerMessage,
    "sticker"
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function takeCommand(ctx) {
  const stickerMessage =
    getQuotedSticker(ctx.message);

  if (!stickerMessage) {
    return ctx.send(
      "❌ STICKER REQUIRED\n\n" +
      "Reponn yon sticker epi ekri:\n" +
      `${ctx.prefix}take\n\n` +
      "Pou chanje non pack ak author:\n" +
      `${ctx.prefix}take TOPFEROS | TOPFEROS MD\n\n` +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );
  }

  let packName = "TOPFEROS MD";
  let author = "🦁 TECH BY TOPFEROS MD 🐑";

  const args = String(ctx.text || "").trim();

  if (args) {
    const parts = args.split("|");

    packName = parts[0]?.trim() || packName;
    author = parts[1]?.trim() || author;
  }

  if (packName.length > 100 || author.length > 100) {
    return ctx.send(
      "❌ Pack name ak author pa dwe depase 100 karaktè."
    );
  }

  try {
    await ctx.send(
      "⏳ TAKE STICKER\n\n" +
      "M ap telechaje sticker la epi modifye metadata li..."
    );

    const media = await downloadSticker(stickerMessage);

    if (!media.length) {
      throw new Error("Sticker download failed.");
    }

    const sticker = new Sticker(media, {
      pack: packName,
      author: author,
      quality: 90
    });

    const output = await sticker.toBuffer();

    if (!output || !output.length) {
      throw new Error("Sticker metadata generation failed.");
    }

    await ctx.sock.sendMessage(
      ctx.jid,
      {
        sticker: output
      },
      {
        quoted: ctx.message
      }
    );

    console.log("[TAKE] Sticker created:", {
      packName,
      author,
      size: output.length
    });

    return {
      success: true,
      packName,
      author
    };

  } catch (error) {
    console.error(
      "[TAKE ERROR]",
      error?.stack || error
    );

    await ctx.send(
      "❌ TAKE FAILED\n\n" +
      `${error.message || "Sticker processing failed."}\n\n` +
      "Verifye si wa-sticker-formatter enstale.\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

    return {
      success: false,
      error: error.message
    };
  }
}

registerCommand("take", takeCommand, {
  aliases: ["steal"],
  description: "Change sticker pack name and author.",
  usage: ".take Pack Name | Author",
  category: "MEDIA"
});

module.exports = {
  takeCommand,
  getQuotedSticker,
  downloadSticker
};

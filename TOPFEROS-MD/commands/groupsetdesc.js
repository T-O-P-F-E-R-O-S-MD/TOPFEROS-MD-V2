
"use strict";

const { registerCommand } = require("../src/messageHandler");

const {
  isGroupAdmin,
  isBotGroupAdmin
} = require("../services/groupAdmin");

async function setGroupDescriptionCommand(ctx) {
  if (!ctx.isGroup) {
    return ctx.send("❌ This command only works in groups.");
  }

  const description = String(ctx.text || "").trim();

  if (!description) {
    return ctx.send(
      `❌ DESCRIPTION REQUIRED\n\nExample:\n${ctx.prefix}setdesc Welcome to TOPFEROS FAMILY`
    );
  }

  try {
    const metadata = await ctx.sock.groupMetadata(ctx.jid);

    if (!await isGroupAdmin(ctx.sock, metadata, ctx.sender)) {
      return ctx.send("❌ ADMIN ONLY\n\nOnly group admins can change the description.");
    }

    if (!await isBotGroupAdmin(ctx.sock, metadata)) {
      return ctx.send("❌ BOT MUST BE ADMIN\n\nMake the bot a group admin first.");
    }

    await ctx.sock.groupUpdateDescription(
      ctx.jid,
      description
    );

    await ctx.send(
      `✅ GROUP DESCRIPTION UPDATED\n\n📝 ${description}\n\n🦁 TECH BY TOPFEROS MD 🐑`
    );

    return { success: true };

  } catch (error) {
    console.error("[SETDESC]", error?.stack || error);

    await ctx.send(
      `❌ DESCRIPTION UPDATE FAILED\n\n${error.message || "Unknown WhatsApp error."}`
    );

    return { success: false };
  }
}

registerCommand("setdesc", setGroupDescriptionCommand, {
  aliases: ["groupdesc", "setbio"],
  description: "Change the group description.",
  usage: ".setdesc <description>",
  category: "GROUP"
});

module.exports = { setGroupDescriptionCommand };

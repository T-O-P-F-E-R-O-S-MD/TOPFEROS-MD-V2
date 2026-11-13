
"use strict";

// ============================================================
// TOPFEROS MD V2.0.0
// GROUP DEMOTE COMMAND
// WhatsApp / Baileys 7.x
// ============================================================

const { registerCommand } = require("../src/messageHandler");

const {
  isBotGroupAdmin,
  isGroupAdmin
} = require("../services/groupAdmin");

// ------------------------------------------------------------
// JID HELPERS
// ------------------------------------------------------------

function normalizeJid(jid) {
  return String(jid || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+(?=@)/, "");
}

function numberToJid(number) {
  const digits = String(number || "").replace(/\D/g, "");

  return digits
    ? `${digits}@s.whatsapp.net`
    : null;
}

// ------------------------------------------------------------
// GET MENTIONED USERS
// ------------------------------------------------------------

function getMentionedUsers(message) {
  const content = message?.message;

  if (!content) return [];

  const containers = [
    content.extendedTextMessage,
    content.imageMessage,
    content.videoMessage,
    content.documentMessage
  ];

  for (const container of containers) {
    const mentions = container?.contextInfo?.mentionedJid;

    if (Array.isArray(mentions) && mentions.length) {
      return mentions;
    }
  }

  return [];
}

// ------------------------------------------------------------
// GET TARGET
// ------------------------------------------------------------

function getTarget(ctx) {
  const mentioned = getMentionedUsers(ctx.message);

  if (mentioned.length) {
    return normalizeJid(mentioned[0]);
  }

  if (ctx.args?.length) {
    return numberToJid(ctx.args[0]);
  }

  return null;
}

// ------------------------------------------------------------
// DEMOTE COMMAND
// ------------------------------------------------------------

async function demoteCommand(ctx) {

  // Only works inside groups
  if (!ctx.isGroup) {
    await ctx.send(
      "❌ GROUP COMMAND ONLY\n\n" +
      "This command can only be used inside a WhatsApp group.\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

    return {
      success: false,
      reason: "Not a group."
    };
  }

  // Get group information
  let metadata;

  try {
    metadata = await ctx.sock.groupMetadata(ctx.jid);
  } catch (error) {
    console.error(
      "[DEMOTE] Group metadata error:",
      error?.stack || error
    );

    await ctx.send(
      "❌ GROUP INFO ERROR\n\n" +
      "Unable to retrieve group information."
    );

    return {
      success: false,
      error: error?.message || String(error)
    };
  }

  // Check command sender admin permission
  const senderIsAdmin = await isGroupAdmin(
    ctx.sock,
    metadata,
    ctx.sender
  );

  if (!senderIsAdmin) {
    await ctx.send(
      "❌ ADMIN ONLY\n\n" +
      "Only group admins can use this command."
    );

    return {
      success: false,
      reason: "Sender is not a group admin."
    };
  }

  // Check bot admin permission
  const botIsAdmin = await isBotGroupAdmin(
    ctx.sock,
    metadata
  );

  if (!botIsAdmin) {
    await ctx.send(
      "❌ BOT IS NOT ADMIN\n\n" +
      "I need to be a group admin to remove admin permissions."
    );

    return {
      success: false,
      reason: "Bot is not a group admin."
    };
  }

  // Get target member
  const targetJid = getTarget(ctx);

  if (!targetJid) {
    await ctx.send([
      "❌ MEMBER NOT SPECIFIED",
      "",
      "Mention an admin or provide their phone number.",
      "",
      `Example: ${ctx.prefix}demote @admin`,
      `Example: ${ctx.prefix}demote 509xxxxxxxx`,
      "",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n"));

    return {
      success: false,
      reason: "No target member provided."
    };
  }

  // Find target in group participants
  const target = metadata?.participants?.find(
    participant =>
      normalizeJid(participant?.id) === targetJid ||
      normalizeJid(participant?.jid) === targetJid
  );

  if (!target) {
    await ctx.send(
      "❌ MEMBER NOT FOUND\n\n" +
      "This user is not a member of the group."
    );

    return {
      success: false,
      reason: "Target is not a group member."
    };
  }

  // Check target admin status
  if (
    target.admin !== "admin" &&
    target.admin !== "superadmin"
  ) {
    await ctx.send(
      "ℹ️ NOT AN ADMIN\n\n" +
      "This member does not have admin permissions."
    );

    return {
      success: false,
      reason: "Target is not an admin."
    };
  }

  // Protect group owner
  if (target.admin === "superadmin") {
    await ctx.send(
      "❌ OWNER PROTECTED\n\n" +
      "The group owner cannot be demoted by this command."
    );

    return {
      success: false,
      reason: "Target is the group owner."
    };
  }

  // Execute demote
  try {
    await ctx.sock.groupParticipantsUpdate(
      ctx.jid,
      [target.id],
      "demote"
    );

  } catch (error) {
    console.error(
      "[DEMOTE] Demote member error:",
      error?.stack || error
    );

    await ctx.send(
      "❌ DEMOTE FAILED\n\n" +
      "WhatsApp did not allow this member to be demoted. " +
      "Check the bot's admin permissions."
    );

    return {
      success: false,
      error: error?.message || String(error)
    };
  }

  // Success message
  const targetNumber = normalizeJid(target.id)
    .replace(/@[^@]+$/, "");

  await ctx.send([
    "╭━━━〔 ⬇️ DEMOTE 〕━━━╮",
    "┃",
    "┃ ✅ Admin permissions removed.",
    `┃ 👤 Member: ${targetNumber}`,
    "┃",
    "╰━━━━━━━━━━━━━━━━━━━━╯",
    "",
    "🦁 TECH BY TOPFEROS MD 🐑"
  ].join("\n"));

  return {
    success: true,
    target: target.id
  };
}

// ------------------------------------------------------------
// REGISTER COMMAND
// ------------------------------------------------------------

registerCommand("demote", demoteCommand, {
  aliases: [],
  description: "Remove admin permissions from a group member.",
  usage: ".demote @admin",
  category: "GROUP"
});

module.exports = {
  demoteCommand
};

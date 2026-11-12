
"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                    OPEN COMMAND                   ║
// ╚════════════════════════════════════════════════════╝

const {
  registerCommand
} = require("../src/messageHandler");

const {
  isBotGroupAdmin
} = require("../services/groupAdmin");

/*
|--------------------------------------------------------------------------
| NORMALIZE JID
|--------------------------------------------------------------------------
*/

function normalizeJid(jid) {
  if (!jid) return "";

  let value = String(jid).trim().toLowerCase();

  // Remove device ID
  value = value.replace(/:\d+(?=@)/, "");

  // Convert plain phone number to WhatsApp JID
  if (/^\+?\d+$/.test(value)) {
    value = value.replace(/^\+/, "") + "@s.whatsapp.net";
  }

  return value;
}

function isAdmin(metadata, jid) {
  const target = normalizeJid(jid);

  return Boolean(
    metadata?.participants?.some((participant) => {
      const participantJid =
        normalizeJid(participant?.id);

      return (
        participantJid === target &&
        (
          participant?.admin === "admin" ||
          participant?.admin === "superadmin"
        )
      );
    })
  );
}
/*
|--------------------------------------------------------------------------
| GET JID ALIASES
|--------------------------------------------------------------------------
*/

function getJidAliases(user) {
  if (!user) return [];

  const values = [
    user,
    typeof user === "object" ? user.id : null,
    typeof user === "object" ? user.lid : null,
    typeof user === "object" ? user.jid : null,
    typeof user === "object" ? user.phoneNumber : null
  ];

  return [
    ...new Set(
      values
        .map(normalizeJid)
        .filter(Boolean)
    )
  ];
}

/*
|--------------------------------------------------------------------------
| OPEN COMMAND
|--------------------------------------------------------------------------
*/

async function openCommand(ctx) {

  /*
   * Group only.
   */

  if (!ctx.isGroup) {
    await ctx.send(
      [
        "❌ GROUP COMMAND ONLY",
        "",
        "This command can only be used inside a WhatsApp group.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: "Command used outside a group."
    };
  }

  /*
   * Get group metadata.
   */

  let metadata;

  try {
    metadata = await ctx.sock.groupMetadata(ctx.jid);

  } catch (error) {
    console.error(
      "[OPEN] Group metadata error:",
      error?.stack || error
    );

    await ctx.send(
      [
        "❌ GROUP INFO ERROR",
        "",
        "Unable to retrieve group information.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      error: error?.message || String(error)
    };
  }

  /*
   * Check command sender.
   */

  const sender =
    ctx.sender ||
    ctx.message?.key?.participant ||
    "";

  if (!isAdmin(metadata, sender)) {
    await ctx.send(
      [
        "❌ ADMIN ONLY",
        "",
        "Only group admins can use this command.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: "Sender is not a group admin."
    };
  }

    /*
   * Check bot admin status.
   */

  const botIsAdmin =
    await isBotGroupAdmin(
      ctx.sock,
      metadata
    );

  if (!botIsAdmin) {
    await ctx.send(
      [
        "❌ BOT IS NOT ADMIN",
        "",
        "I need to be a group admin to open the group.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason:
        "Bot is not a group admin."
    };
  }

  /*
   * Allow all participants to send messages.
   */

  try {
    await ctx.sock.groupSettingUpdate(
      ctx.jid,
      "not_announcement"
    );

  } catch (error) {
    console.error(
      "[OPEN] Group setting update error:",
      error?.stack || error
    );

    await ctx.send(
      [
        "❌ OPEN FAILED",
        "",
        "WhatsApp did not allow the group setting to be changed.",
        "",
        "Make sure the bot still has admin permissions.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      error: error?.message || String(error)
    };
  }

  /*
   * Success response.
   */

  await ctx.send(
    [
      "╭━━━〔 🔓 OPEN 〕━━━╮",
      "┃",
      "┃ ✅ Group opened successfully.",
      "┃",
      "┃ 👥 All members can send",
      "┃    messages now.",
      "┃",
      "╰━━━━━━━━━━━━━━━━━━╯",
      "",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n")
  );

  return {
    success: true,
    mode: "all-members"
  };
}

/*
|--------------------------------------------------------------------------
| REGISTER COMMAND
|--------------------------------------------------------------------------
*/

registerCommand(
  "open",
  openCommand,
  {
    aliases: [],
    description:
      "Allow all group members to send messages.",
    usage:
      ".open",
    category:
      "GROUP"
  }
);

module.exports = {
  openCommand
};

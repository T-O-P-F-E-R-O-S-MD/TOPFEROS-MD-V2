
"use strict";

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const {
  isGroupAdmin
} = require("../services/groupAdmin");

const STATUS_JID = "status@broadcast";

/*
|--------------------------------------------------------------------------
| UNWRAP MESSAGE
|--------------------------------------------------------------------------
*/

function unwrapMessage(message) {
  let current = message;

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

/*
|--------------------------------------------------------------------------
| GET QUOTED MESSAGE
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| DOWNLOAD MEDIA
|--------------------------------------------------------------------------
*/

async function downloadMedia(mediaMessage, type) {
  const stream = await downloadContentFromMessage(
    mediaMessage,
    type
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

/*
|--------------------------------------------------------------------------
| NORMALIZE JID
|--------------------------------------------------------------------------
*/

function normalizeJid(jid) {
  return String(jid || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+(?=@)/, "");
}

/*
|--------------------------------------------------------------------------
| RESOLVE PARTICIPANT
|--------------------------------------------------------------------------
*/

async function resolveParticipant(sock, participant) {
  const candidates = [
    participant?.id,
    participant?.jid,
    participant?.phoneNumber
  ].filter(Boolean);

  const mapping = sock?.signalRepository?.lidMapping;

  for (const candidate of candidates) {
    const jid = normalizeJid(candidate);

    if (jid.endsWith("@s.whatsapp.net")) {
      return jid;
    }

    if (jid.endsWith("@lid")) {
      try {
        if (typeof mapping?.getPNForLID === "function") {
          const phoneJid = await mapping.getPNForLID(jid);

          if (phoneJid) {
            return normalizeJid(phoneJid);
          }
        }
      } catch (error) {
        console.warn(
          "[GSTATUS] LID resolution:",
          error.message
        );
      }

      return jid;
    }
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| GET STATUS RECIPIENTS
|--------------------------------------------------------------------------
*/

async function getStatusRecipients(sock, metadata) {
  const botIds = [
    sock.user?.id,
    sock.user?.lid,
    sock.user?.phoneNumber
  ]
    .filter(Boolean)
    .map(normalizeJid);

  const recipients = new Set();

  for (const participant of metadata.participants || []) {
    const jid = await resolveParticipant(
      sock,
      participant
    );

    if (!jid || botIds.includes(jid)) continue;

    recipients.add(jid);
  }

  return [...recipients];
}

/*
|--------------------------------------------------------------------------
| COMMAND: GROUP STATUS
|--------------------------------------------------------------------------
*/

async function groupStatusCommand(ctx) {
  if (!ctx.isGroup) {
    return ctx.send(
      "❌ This command only works in groups."
    );
  }

  try {
    // GET GROUP METADATA

    const metadata = await ctx.sock.groupMetadata(
      ctx.jid
    );

    // VERIFY ADMIN

    const admin = await isGroupAdmin(
      ctx.sock,
      metadata,
      ctx.sender
    );

    if (!admin && !ctx.isOwner) {
      return ctx.send(
        "❌ ADMIN ONLY\n\n" +
        "Only group admins or the bot owner can publish Status."
      );
    }

    // GET REPLIED MEDIA

    const quoted = getQuotedMessage(ctx.message);

    const imageMessage = quoted?.imageMessage;
    const videoMessage = quoted?.videoMessage;

    if (!imageMessage && !videoMessage) {
      return ctx.send(
        "❌ IMAGE OR VIDEO REQUIRED\n\n" +
        "Reply to an image or video in the group with:\n" +
        `${ctx.prefix}gstatus`
      );
    }

    const isImage = Boolean(imageMessage);

    // DOWNLOAD MEDIA

    await ctx.send(
      "⏳ GROUP STATUS\n\n" +
      "Downloading and preparing media..."
    );

    const media = await downloadMedia(
      isImage ? imageMessage : videoMessage,
      isImage ? "image" : "video"
    );

    if (!media || !media.length) {
      throw new Error(
        "Media download returned empty data."
      );
    }

    // GET GROUP RECIPIENTS

    const statusJidList = await getStatusRecipients(
      ctx.sock,
      metadata
    );

    if (!statusJidList.length) {
      throw new Error(
        "No valid Status recipients were found."
      );
    }

    // PREPARE STATUS MESSAGE

    const caption = String(ctx.text || "").trim();

    const statusMessage = isImage
      ? {
          image: media,
          mimetype: imageMessage.mimetype || "image/jpeg",
          ...(caption ? { caption } : {})
        }
      : {
          video: media,
          mimetype: videoMessage.mimetype || "video/mp4",
          ...(caption ? { caption } : {})
        };

    // PUBLISH STATUS

    const result = await ctx.sock.sendMessage(
      STATUS_JID,
      statusMessage,
      {
        statusJidList
      }
    );

    if (
      !result?.key?.id ||
      result.key.remoteJid !== STATUS_JID
    ) {
      throw new Error(
        "WhatsApp did not return a valid Status confirmation."
      );
    }

    console.log("[GSTATUS] Status submitted:", {
      id: result.key.id,
      type: isImage ? "image" : "video",
      recipients: statusJidList.length
    });

    // SUCCESS RESPONSE

    await ctx.send(
      "📤 STATUS REQUEST ACCEPTED\n\n" +
      `📷 Type: ${isImage ? "Image" : "Video"}\n` +
      `👥 Recipients: ${statusJidList.length}\n` +
      `🆔 ID: ${result.key.id}\n\n` +
      "WhatsApp accepted the Status request.\n\n" +
      "⚠️ Check Updates > My Status to confirm it is visible.\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

    return {
      success: true,
      accepted: true,
      verifiedVisible: false,
      statusId: result.key.id,
      recipients: statusJidList.length,
      type: isImage ? "image" : "video"
    };

  } catch (error) {
    console.error(
      "[GSTATUS ERROR]",
      error?.stack || error
    );

    await ctx.send(
      "❌ STATUS PUBLISH FAILED\n\n" +
      `${error.message || "Unknown WhatsApp error."}\n\n` +
      "WhatsApp did not confirm the publication.\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

    return {
      success: false,
      error: error.message
    };
  }
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  groupStatusCommand,
  getStatusRecipients,
  downloadMedia
};


"use strict";

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const {
  registerCommand
} = require("../src/messageHandler");

const {
  isGroupAdmin
} = require("../services/groupAdmin");

const STATUS_JID = "status@broadcast";

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

async function downloadMedia(media, type) {
  const stream = await downloadContentFromMessage(
    media,
    type
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function normalizeJid(jid) {
  return String(jid || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+(?=@)/, "");
}

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

async function groupStatusCommand(ctx) {
  if (!ctx.isGroup) {
    return ctx.send(
      "❌ Kòmand sa a mache nan gwoup sèlman."
    );
  }

  try {
    // VERIFY GROUP ADMIN

    const metadata = await ctx.sock.groupMetadata(
      ctx.jid
    );

    const admin = await isGroupAdmin(
      ctx.sock,
      metadata,
      ctx.sender
    );

    if (!admin && !ctx.isOwner) {
      return ctx.send(
        "❌ ADMIN ONLY\n\n" +
        "Se admin gwoup la oswa mèt bot la ki ka pibliye Status."
      );
    }

    // GET REPLIED MEDIA

    const quoted = getQuotedMessage(ctx.message);

    const imageMessage = quoted?.imageMessage;
    const videoMessage = quoted?.videoMessage;

    if (!imageMessage && !videoMessage) {
      return ctx.send(
        "❌ MEDIA REQUIRED\n\n" +
        "Reponn yon foto oswa videyo nan gwoup la.\n\n" +
        "Apre sa, voye .gstatus"
      );
    }

    const isImage = Boolean(imageMessage);

    // DOWNLOAD MEDIA

    await ctx.send(
      "⏳ TOPFEROS GROUP STATUS\n\n" +
      "M ap prepare foto/videyo a..."
    );

    const media = await downloadMedia(
      isImage ? imageMessage : videoMessage,
      isImage ? "image" : "video"
    );

    if (!media || media.length === 0) {
      throw new Error("Media download failed.");
    }

    // GET RECIPIENTS

    const statusJidList = await getStatusRecipients(
      ctx.sock,
      metadata
    );

    if (!statusJidList.length) {
      throw new Error(
        "Pa gen moun nan lis moun ki ka resevwa Status la."
      );
    }

    // PREPARE STATUS

    const caption = String(ctx.text || "").trim();

    const statusMessage = isImage
      ? {
          image: media,
          mimetype:
            imageMessage.mimetype || "image/jpeg",
          ...(caption ? { caption } : {})
        }
      : {
          video: media,
          mimetype:
            videoMessage.mimetype || "video/mp4",
          ...(caption ? { caption } : {})
        };

    // SEND TO WHATSAPP STATUS

    const result = await ctx.sock.sendMessage(
      STATUS_JID,
      statusMessage,
      {
        statusJidList
      }
    );

    // VERIFY WHATSAPP RESPONSE

    if (
      !result?.key?.id ||
      result.key.remoteJid !== STATUS_JID
    ) {
      throw new Error(
        "WhatsApp pa retounen yon konfimasyon valab."
      );
    }

    console.log("[GSTATUS] WhatsApp accepted status:", {
      id: result.key.id,
      type: isImage ? "image" : "video",
      recipients: statusJidList.length
    });

    // DO NOT CLAIM ACTUAL VISIBILITY

    await ctx.send(
      "📤 STATUS REQUEST ACCEPTED\n\n" +
      `📷 Type: ${isImage ? "Image" : "Video"}\n` +
      `👥 Destinatè: ${statusJidList.length}\n` +
      `🆔 ID: ${result.key.id}\n\n` +
      "WhatsApp resevwa demann piblikasyon an.\n\n" +
      "⚠️ Verifye Updates > My Status pou konfime foto a parèt toutbon.\n\n" +
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
      `${error.message || "WhatsApp error."}\n\n` +
      "Bot la pa konfime piblikasyon an.\n\n" +
      "🦁 TECH BY TOPFEROS MD 🐑"
    );

    return {
      success: false,
      error: error.message
    };
  }
}

registerCommand("gstatus", groupStatusCommand, {
  aliases: ["groupstatus"],
  description: "Publish group image or video to WhatsApp Status.",
  usage: ".gstatus",
  category: "GROUP"
});

module.exports = {
  groupStatusCommand,
  getStatusRecipients,
  downloadMedia
};

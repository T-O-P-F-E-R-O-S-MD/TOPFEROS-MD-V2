
"use strict";

// ============================================================
// TOPFEROS MD V2.0.0
// GROUP ADMIN SERVICE
// WhatsApp / Baileys 7.x
// ============================================================

// ------------------------------------------------------------
// NORMALIZE JID
// ------------------------------------------------------------

function cleanJid(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+(?=@)/, "");
}

// ------------------------------------------------------------
// CHECK ADMIN PARTICIPANT
// ------------------------------------------------------------

function isAdminParticipant(participant) {
  return (
    participant?.admin === "admin" ||
    participant?.admin === "superadmin"
  );
}

// ------------------------------------------------------------
// PHONE IDENTITY
// ------------------------------------------------------------

function getPhoneIdentity(value) {
  const jid = cleanJid(value);

  if (!jid.endsWith("@s.whatsapp.net")) {
    return "";
  }

  return jid.split("@")[0];
}

// ------------------------------------------------------------
// RESOLVE WHATSAPP IDENTITY
// Supports PN and LID
// ------------------------------------------------------------

async function resolveIdentity(sock, value) {
  const identities = new Set();
  const jid = cleanJid(value);

  if (jid) {
    identities.add(jid);
  }

  if (!jid) return identities;

  const mapping = sock?.signalRepository?.lidMapping;

  try {

    // LID -> Phone Number
    if (
      jid.endsWith("@lid") &&
      typeof mapping?.getPNForLID === "function"
    ) {
      const pn = await mapping.getPNForLID(jid);

      if (pn) {
        identities.add(cleanJid(pn));
      }
    }

    // Phone Number -> LID
    if (
      jid.endsWith("@s.whatsapp.net") &&
      typeof mapping?.getLIDForPN === "function"
    ) {
      const lid = await mapping.getLIDForPN(jid);

      if (lid) {
        identities.add(cleanJid(lid));
      }
    }

  } catch (error) {
    console.warn(
      "[GROUP ADMIN] Identity mapping warning:",
      error?.message || error
    );
  }

  return identities;
}

// ------------------------------------------------------------
// CHECK IF BOT IS GROUP ADMIN
// ------------------------------------------------------------

async function isBotGroupAdmin(sock, metadata) {
  try {
    const participants = metadata?.participants || [];
    const user = sock?.user || {};

    const botIdentities = new Set();

    for (const value of [
      user.id,
      user.lid,
      user.phoneNumber
    ]) {
      const resolved = await resolveIdentity(sock, value);

      for (const identity of resolved) {
        botIdentities.add(identity);
      }
    }

    if (!botIdentities.size) {
      console.error(
        "[GROUP ADMIN] Bot identity is unavailable."
      );

      return false;
    }

    const botNumbers = new Set(
      [...botIdentities]
        .map(getPhoneIdentity)
        .filter(Boolean)
    );

    for (const participant of participants) {

      if (!isAdminParticipant(participant)) {
        continue;
      }

      const participantIdentities = new Set();

      for (const value of [
        participant.id,
        participant.jid,
        participant.phoneNumber
      ]) {
        const resolved = await resolveIdentity(sock, value);

        for (const identity of resolved) {
          participantIdentities.add(identity);
        }
      }

      // Compare complete identities
      for (const identity of participantIdentities) {
        if (botIdentities.has(identity)) {
          return true;
        }
      }

      // Compare phone numbers
      const participantNumbers = new Set(
        [...participantIdentities]
          .map(getPhoneIdentity)
          .filter(Boolean)
      );

      for (const number of botNumbers) {
        if (participantNumbers.has(number)) {
          return true;
        }
      }
    }

    console.warn(
      "[GROUP ADMIN] Bot was not found as an admin.",
      {
        botId: user.id,
        botLid: user.lid
      }
    );

    return false;

  } catch (error) {
    console.error(
      "[GROUP ADMIN CHECK ERROR]",
      error?.stack || error
    );

    return false;
  }
}

// ------------------------------------------------------------
// CHECK IF A MEMBER IS GROUP ADMIN
// ------------------------------------------------------------

async function isGroupAdmin(sock, metadata, userJid) {
  try {
    const targetIdentities = await resolveIdentity(
      sock,
      userJid
    );

    if (!targetIdentities.size) {
      return false;
    }

    for (const participant of metadata?.participants || []) {

      if (!isAdminParticipant(participant)) {
        continue;
      }

      const participantIdentities = new Set();

      for (const value of [
        participant.id,
        participant.jid,
        participant.phoneNumber
      ]) {
        const resolved = await resolveIdentity(sock, value);

        for (const identity of resolved) {
          participantIdentities.add(identity);
        }
      }

      for (const identity of participantIdentities) {
        if (targetIdentities.has(identity)) {
          return true;
        }
      }
    }

    return false;

  } catch (error) {
    console.error(
      "[GROUP ADMIN CHECK ERROR]",
      error?.stack || error
    );

    return false;
  }
}

// ------------------------------------------------------------
// EXPORT
// ------------------------------------------------------------

module.exports = {
  isBotGroupAdmin,
  isGroupAdmin
};

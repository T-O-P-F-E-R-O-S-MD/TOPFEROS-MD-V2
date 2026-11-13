
"use strict";

function cleanJid(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+(?=@)/, "");
}

async function resolveIdentity(sock, value) {
  const ids = new Set();
  const jid = cleanJid(value);

  if (!jid) return ids;
  ids.add(jid);

  const mapping = sock?.signalRepository?.lidMapping;

  try {
    if (jid.endsWith("@lid") &&
        typeof mapping?.getPNForLID === "function") {
      const pn = await mapping.getPNForLID(jid);
      if (pn) ids.add(cleanJid(pn));
    }

    if (jid.endsWith("@s.whatsapp.net") &&
        typeof mapping?.getLIDForPN === "function") {
      const lid = await mapping.getLIDForPN(jid);
      if (lid) ids.add(cleanJid(lid));
    }
  } catch (error) {
    console.warn("[GROUP ADMIN] LID mapping:", error.message);
  }

  return ids;
}

async function matchesParticipant(sock, participant, jid) {
  const targetIds = await resolveIdentity(sock, jid);

  for (const value of [
    participant?.id,
    participant?.jid,
    participant?.phoneNumber
  ]) {
    const ids = await resolveIdentity(sock, value);

    for (const id of ids) {
      if (targetIds.has(id)) return true;
    }
  }

  return false;
}

async function isGroupAdmin(sock, metadata, jid) {
  for (const participant of metadata?.participants || []) {
    if (
      participant.admin !== "admin" &&
      participant.admin !== "superadmin"
    ) continue;

    if (await matchesParticipant(sock, participant, jid)) {
      return true;
    }
  }

  return false;
}

async function isBotGroupAdmin(sock, metadata) {
  const user = sock?.user || {};

  for (const jid of [
    user.id,
    user.lid,
    user.phoneNumber
  ]) {
    if (jid && await isGroupAdmin(sock, metadata, jid)) {
      return true;
    }
  }

  return false;
}

module.exports = {
  isGroupAdmin,
  isBotGroupAdmin
};

"use strict";

function cleanJid(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+(?=@)/, "");
}

function isAdminParticipant(participant) {
  return (
    participant?.admin === "admin" ||
    participant?.admin === "superadmin"
  );
}

function addIdentity(set, value) {
  const jid = cleanJid(value);
  if (jid) set.add(jid);
}

function getPhoneIdentity(value) {
  const jid = cleanJid(value);

  if (!jid.endsWith("@s.whatsapp.net")) {
    return "";
  }

  return jid.split("@")[0];
}

async function resolveIdentity(sock, value) {
  const identities = new Set();
  const jid = cleanJid(value);

  addIdentity(identities, jid);

  if (!jid) return identities;

  const mapping = sock?.signalRepository?.lidMapping;

  try {
    if (
      jid.endsWith("@lid") &&
      typeof mapping?.getPNForLID === "function"
    ) {
      const pn = await mapping.getPNForLID(jid);
      addIdentity(identities, pn);
    }

    if (
      jid.endsWith("@s.whatsapp.net") &&
      typeof mapping?.getLIDForPN === "function"
    ) {
      const lid = await mapping.getLIDForPN(jid);
      addIdentity(identities, lid);
    }
  } catch (error) {
    console.warn(
      "[GROUP ADMIN] Identity mapping warning:",
      error.message
    );
  }

  return identities;
}

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

      for (const identity of participantIdentities) {
        if (botIdentities.has(identity)) {
          return true;
        }
      }

      const botNumbers = new Set(
        [...botIdentities]
          .map(getPhoneIdentity)
          .filter(Boolean)
      );

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

module.exports = {
  isBotGroupAdmin
};
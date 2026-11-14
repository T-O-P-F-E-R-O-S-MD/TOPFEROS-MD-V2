"use strict";

const sessionManager = require("../src/sessionManager");

function normalizeJid(jid) {
  const value = String(jid || "").trim().toLowerCase();

  if (!value.includes("@")) return "";

  const [user, server] = value.split("@");
  return `${user.split(":")[0]}@${server}`;
}

function isKnownBotJid(sock, jid) {
  const target = normalizeJid(jid);

  if (!target) return false;

  const knownJids = new Set();

  function addIdentity(user) {
    if (!user) return;

    const id = normalizeJid(user.id);
    const lid = normalizeJid(user.lid);

    if (id) knownJids.add(id);
    if (lid) knownJids.add(lid);
  }

  // Kont WhatsApp sesyon aktyèl la
  addIdentity(sock?.user);

  // Tout lòt sesyon TOPFEROS ki anrejistre
  for (const session of sessionManager.getActiveSessions()) {
    addIdentity(session.sock?.user);

    if (session.number) {
      const number = String(session.number).replace(/\D/g, "");

      if (number) {
        knownJids.add(`${number}@s.whatsapp.net`);
      }
    }
  }

  return knownJids.has(target);
}

module.exports = {
  isKnownBotJid
};
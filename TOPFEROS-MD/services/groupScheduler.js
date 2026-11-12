"use strict";

const sessionManager =
  require("../src/sessionManager");

const CHECK_INTERVAL =
  20 * 1000;

let timer = null;

const lastRuns = new Map();

function extractInviteCode(link) {
  const match = String(link || "").match(
    /chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i
  );

  return match ? match[1] : "";
}

function getTimeParts(timezone) {
  const timezoneValue =
    timezone === "Atlantic/Port-au-Prince"
      ? "America/Port-au-Prince"
      : timezone || "America/Port-au-Prince";

  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: timezoneValue,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }
  ).formatToParts(new Date());

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  return {
    date: `${result.year}-${result.month}-${result.day}`,
    time: `${result.hour}:${result.minute}`
  };
}

async function getTargetGroup(sock, settings) {
  if (!sock) {
    throw new Error("WhatsApp socket is unavailable.");
  }

  const groupValue = String(
    settings.groupGid || ""
  ).trim();

  if (!groupValue) {
    throw new Error("GROUP GID is missing.");
  }

  // Accept a direct WhatsApp group JID.
  if (/^\d+(-\d+)?@g\.us$/i.test(groupValue)) {
    return groupValue;
  }

  // Accept a WhatsApp group invite link.
  const inviteCode = extractInviteCode(groupValue);

  if (inviteCode) {
    const inviteInfo = await sock.groupGetInviteInfo(
      inviteCode
    );

    const groupId =
      inviteInfo?.id ||
      inviteInfo?.gid ||
      inviteInfo?.jid;

    if (!groupId) {
      throw new Error("Unable to resolve the group invite link.");
    }

    return groupId;
  }

  throw new Error(
    "GROUP GID must be a group JID or WhatsApp invite link."
  );
}

async function changeGroup(sock, groupId, action) {
  const metadata = await sock.groupMetadata(groupId);

  const botNumber = String(
    sock.user?.id || ""
  )
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");

  const botParticipant = (
    metadata?.participants || []
  ).find((item) => {
    const participantNumber = String(
      item?.id || ""
    )
      .split("@")[0]
      .split(":")[0]
      .replace(/\D/g, "");

    return participantNumber === botNumber;
  });

  if (
    !botParticipant ||
    (
      botParticipant.admin !== "admin" &&
      botParticipant.admin !== "superadmin"
    )
  ) {
    throw new Error("The bot must be a group admin.");
  }

  const setting =
    action === "close"
      ? "announcement"
      : "not_announcement";

  await sock.groupSettingUpdate(
    groupId,
    setting
  );

  console.log(
    `${action === "close" ? "🔒" : "🔓"} GROUP ${action.toUpperCase()} → ${groupId}`
  );
}

async function runSession(session) {
  if (!session?.sock) {
    return;
  }

  const settings =
    session.groupAutomation || {};

  if (settings.enabled !== true) {
    return;
  }

  const timezone =
    settings.timezone ||
    "Atlantic/Port-au-Prince";

  const now = getTimeParts(timezone);

  const actions = [];

  if (
    String(settings.closeTime || "") === now.time
  ) {
    actions.push("close");
  }

  if (
    String(settings.openTime || "") === now.time
  ) {
    actions.push("open");
  }

  for (const action of actions) {
    const runKey =
      `${session.sessionId}:${now.date}:${action}:${now.time}`;

    if (lastRuns.has(runKey)) {
      continue;
    }

    // Prevent duplicate execution during the same minute.
    lastRuns.set(runKey, Date.now());

    try {
      const groupId = await getTargetGroup(
        session.sock,
        settings
      );

      await changeGroup(
        session.sock,
        groupId,
        action
      );
    } catch (error) {
      // Allow another attempt during the same minute
      // if the first attempt failed.
      lastRuns.delete(runKey);

      console.error(
        `❌ GROUP SCHEDULER ${action.toUpperCase()}:`,
        error?.message || error
      );
    }
  }
}

async function tick() {
  const sessions =
    sessionManager.getActiveSessions();

  for (const session of sessions) {
    await runSession(session);
  }

  // Keep the memory map from growing indefinitely.
  const cutoff = Date.now() - (48 * 60 * 60 * 1000);

  for (const [key, timestamp] of lastRuns.entries()) {
    if (timestamp < cutoff) {
      lastRuns.delete(key);
    }
  }
}

function start() {
  if (timer) {
    return;
  }

  timer = setInterval(() => {
    tick().catch((error) => {
      console.error(
        "❌ GROUP SCHEDULER ERROR:",
        error?.message || error
      );
    });
  }, CHECK_INTERVAL);

  tick().catch((error) => {
    console.error(
      "❌ GROUP SCHEDULER START ERROR:",
      error?.message || error
    );
  });

  console.log(
    "⏰ Group scheduler started (per-session timezone)."
  );
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  lastRuns.clear();
}

module.exports = {
  start,
  stop,
  tick
};
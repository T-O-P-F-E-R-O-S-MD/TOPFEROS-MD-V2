"use strict";

const ai = require("./ai");
const sessionStore = require("./sessionStore");

const STORE_FILE = "group-violations.json";
const processedMessages = new Set();

function getSenderNumber(jid) {
  return String(jid || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");
}

function isAdmin(participant) {
  return (
    participant?.admin === "admin" ||
    participant?.admin === "superadmin"
  );
}

function extractJSON(value) {
  const text = String(value || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("Invalid AI moderation response.");
  }

  return JSON.parse(text.slice(start, end + 1));
}

async function loadViolations(sessionId) {
  try {
    const saved = await sessionStore.getSessionFile(
      sessionId,
      STORE_FILE
    );

    if (!saved) return {};

    return typeof saved === "string"
      ? JSON.parse(saved)
      : saved;
  } catch (error) {
    console.error(
      "[GROUP PRINCIPLES] Load error:",
      error.message
    );

    throw error;
  }
}

async function saveViolations(sessionId, data) {
  await sessionStore.saveSessionFile(
    sessionId,
    STORE_FILE,
    JSON.stringify(data)
  );
}

async function analyzeMessage(text, principles) {
  const prompt = `
You are the moderation system for a WhatsApp group.

Analyze the member message using ONLY the group rules below.

GROUP RULES:
${principles}

MEMBER MESSAGE:
${text}

Decide whether the message clearly violates one or more rules.
Do not invent rules. Do not punish harmless disagreement,
questions, jokes, or messages that are not clearly violations.

Return ONLY valid JSON:
{
  "violation": true,
  "reason": "Short explanation in English"
}

If there is no clear violation, return:
{
  "violation": false,
  "reason": ""
}
`;

  const response = await ai.askAI(prompt, {
    temperature: 0,
    maxTokens: 300,
    systemPrompt:
      "You are a careful and fair WhatsApp group rules moderator. Return valid JSON only."
  });

  const result = extractJSON(response);

  return {
    violation: result.violation === true,
    reason: String(result.reason || "").trim()
  };
}

async function handleGroupPrinciples({
  sock,
  message,
  sessionId,
  settings,
  messageText
}) {
  const jid = message?.key?.remoteJid || "";
  const sender = message?.key?.participant || "";

  if (
    !sock ||
    !sessionId ||
    !jid.endsWith("@g.us") ||
    !sender ||
    message?.key?.fromMe ||
    !messageText ||
    !settings ||
    !String(settings.principles || "").trim()
  ) {
    return { handled: false };
  }

  if (!ai.isAIConfigured()) {
    console.error(
      "[GROUP PRINCIPLES] Gemini API key is not configured."
    );

    return { handled: false };
  }

  const messageId = String(message?.key?.id || "");

  if (!messageId) {
    return { handled: false };
  }

  const uniqueKey = `${sessionId}:${jid}:${messageId}`;

  if (processedMessages.has(uniqueKey)) {
    return { handled: false };
  }

  processedMessages.add(uniqueKey);

  if (processedMessages.size > 5000) {
    processedMessages.clear();
  }

  try {
    const metadata = await sock.groupMetadata(jid);

    const participants = metadata?.participants || [];

    const senderParticipant = participants.find(
      item => item.id === sender
    );

    // Never moderate group administrators.
    if (
      !senderParticipant ||
      isAdmin(senderParticipant)
    ) {
      return { handled: false };
    }

    const result = await analyzeMessage(
      messageText,
      settings.principles
    );

    if (!result.violation) {
      return {
        handled: false,
        violation: false
      };
    }

    const violations = await loadViolations(sessionId);

    if (!violations[jid]) {
      violations[jid] = {};
    }

    const senderNumber = getSenderNumber(sender);

    const currentCount =
      Number(violations[jid][senderNumber] || 0) + 1;

    violations[jid][senderNumber] = currentCount;

    // Save the count before applying any punishment.
    await saveViolations(sessionId, violations);

    const limit = Math.max(
      1,
      Number(settings.warningLimit) || 3
    );

    if (currentCount >= limit) {
      await sock.groupParticipantsUpdate(
        jid,
        [sender],
        "remove"
      );

      await sock.sendMessage(jid, {
        text:
          `🚫 @${senderNumber} has reached the group violation limit and has been removed.\n` +
          `Reason: ${result.reason}`,
        mentions: [sender]
      });

      delete violations[jid][senderNumber];

      await saveViolations(sessionId, violations);

      return {
        handled: true,
        violation: true,
        removed: true,
        count: currentCount
      };
    }

    await sock.sendMessage(jid, {
      text:
        `⚠️ GROUP RULE WARNING\n\n` +
        `Member: @${senderNumber}\n` +
        `Violation: ${currentCount}/${limit}\n` +
        `Reason: ${result.reason}\n\n` +
        `Please respect the group principles.`,
      mentions: [sender]
    });

    return {
      handled: true,
      violation: true,
      removed: false,
      count: currentCount
    };
  } catch (error) {
    console.error(
      "[GROUP PRINCIPLES SERVICE]",
      error?.stack || error
    );

    return {
      handled: false,
      error: error.message
    };
  }
}

module.exports = {
  handleGroupPrinciples
};
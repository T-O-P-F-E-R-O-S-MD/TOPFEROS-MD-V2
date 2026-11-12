
"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| ADVANCED ANTI-BUG MESSAGE GUARD
|--------------------------------------------------------------------------
*/

const IGNORED_MESSAGE_KEYS = new Set([
  "messageContextInfo",
  "senderKeyDistributionMessage"
]);

const MESSAGE_WRAPPERS = new Set([
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
  "editedMessage",
  "associatedChildMessage"
]);

const MAX_MESSAGE_TEXT_LENGTH = 20000;
const MAX_WRAPPER_DEPTH = 8;

/*
|--------------------------------------------------------------------------
| OBJECT VALIDATION
|--------------------------------------------------------------------------
*/

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !Buffer.isBuffer(value)
  );
}

/*
|--------------------------------------------------------------------------
| CONTENT TYPE
|--------------------------------------------------------------------------
*/

function getContentType(message) {
  if (!isRecord(message)) return undefined;

  return Object.keys(message).find(
    key => !IGNORED_MESSAGE_KEYS.has(key)
  );
}

/*
|--------------------------------------------------------------------------
| MESSAGE TEXT EXTRACTION
|--------------------------------------------------------------------------
*/

function extractMessageText(message) {
  if (!isRecord(message)) return "";

  let current = message;

  for (
    let depth = 0;
    depth < MAX_WRAPPER_DEPTH;
    depth++
  ) {
    const type = getContentType(current);

    if (!type || !MESSAGE_WRAPPERS.has(type)) {
      break;
    }

    const wrapped = current[type];

    if (
      !isRecord(wrapped) ||
      !isRecord(wrapped.message)
    ) {
      return "";
    }

    current = wrapped.message;
  }

  const type = getContentType(current);

  if (!type) return "";

  let text = "";

  switch (type) {
    case "conversation":
      text = current.conversation || "";
      break;

    case "extendedTextMessage":
      text = current.extendedTextMessage?.text || "";
      break;

    case "imageMessage":
      text = current.imageMessage?.caption || "";
      break;

    case "videoMessage":
      text = current.videoMessage?.caption || "";
      break;

    case "documentMessage":
      text = current.documentMessage?.caption || "";
      break;

    default:
      return "";
  }

  return typeof text === "string" ? text : "";
}

/*
|--------------------------------------------------------------------------
| MESSAGE STRUCTURE INSPECTION
|--------------------------------------------------------------------------
*/

function inspectMessageStructure(message) {
  if (!isRecord(message)) {
    return "message-not-object";
  }

  if (!isRecord(message.key)) {
    return "message-key-invalid";
  }

  const key = message.key;

  if (
    key.remoteJid != null &&
    typeof key.remoteJid !== "string"
  ) {
    return "remote-jid-invalid";
  }

  if (
    key.id != null &&
    typeof key.id !== "string"
  ) {
    return "message-id-invalid";
  }

  if (
    key.fromMe != null &&
    typeof key.fromMe !== "boolean"
  ) {
    return "from-me-invalid";
  }

  if (!isRecord(message.message)) {
    return "message-content-invalid";
  }

  let current = message.message;
  let depth = 0;

  const visited = new Set();

  while (true) {
    if (!isRecord(current)) {
      return "nested-content-invalid";
    }

    if (visited.has(current)) {
      return "circular-content";
    }

    visited.add(current);

    const keys = Object.keys(current).filter(
      name => !IGNORED_MESSAGE_KEYS.has(name)
    );

    if (keys.length === 0) {
      return "empty-message-content";
    }

    if (keys.length > 1) {
      return "ambiguous-message-content";
    }

    const type = keys[0];
    const payload = current[type];

    if (
      payload == null ||
      (
        !isRecord(payload) &&
        typeof payload !== "string"
      )
    ) {
      return "message-payload-invalid";
    }

    if (type === "conversation") {
      if (typeof payload !== "string") {
        return "conversation-invalid";
      }

      if (payload.length > MAX_MESSAGE_TEXT_LENGTH) {
        return "message-text-too-long";
      }

      break;
    }

    if (MESSAGE_WRAPPERS.has(type)) {
      depth++;

      if (depth > MAX_WRAPPER_DEPTH) {
        return "wrapper-depth-exceeded";
      }

      if (!isRecord(payload.message)) {
        return "wrapper-message-invalid";
      }

      current = payload.message;
      continue;
    }

    if (type === "extendedTextMessage") {
      if (
        payload.text != null &&
        typeof payload.text !== "string"
      ) {
        return "text-invalid";
      }

      if (
        (payload.text || "").length >
        MAX_MESSAGE_TEXT_LENGTH
      ) {
        return "message-text-too-long";
      }
    }

    if (
      [
        "imageMessage",
        "videoMessage",
        "documentMessage"
      ].includes(type)
    ) {
      if (
        payload.caption != null &&
        typeof payload.caption !== "string"
      ) {
        return "caption-invalid";
      }

      if (
        (payload.caption || "").length >
        MAX_MESSAGE_TEXT_LENGTH
      ) {
        return "message-text-too-long";
      }
    }

    // Allow valid future WhatsApp message types.
    break;
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| MAIN ANTI-BUG CHECK
|--------------------------------------------------------------------------
*/

function isUnsafeMessageStructure(message) {
  try {
    return inspectMessageStructure(message) !== null;
  } catch (error) {
    console.error(
      "[ANTI BUG SERVICE]",
      error?.stack || error?.message || error
    );

    return true;
  }
}

module.exports = {
  getContentType,
  extractMessageText,
  inspectMessageStructure,
  isUnsafeMessageStructure
};

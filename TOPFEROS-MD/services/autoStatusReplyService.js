
"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| AUTO STATUS REPLY — AI STICKER SERVICE
|--------------------------------------------------------------------------
|
| - Analyze WhatsApp Status with existing AI service.
| - Select a sticker matching the chosen emoji.
| - Send the sticker privately to the Status owner.
| - Respect the user's custom emoji list.
| - Use a random mapped sticker if AI fails.
|
*/

const fs = require("fs");
const path = require("path");

const {
  chooseEmojiWithSource
} = require("./aiReactionService");

const PROJECT_ROOT = path.resolve(__dirname, "..");

const CATALOG_FILE = path.join(
  PROJECT_ROOT,
  "data",
  "statusStickerCatalog.json"
);

const STICKER_DIRECTORY = path.join(
  PROJECT_ROOT,
  "assets",
  "status-stickers"
);

/*
|--------------------------------------------------------------------------
| RANDOM ITEM
|--------------------------------------------------------------------------
*/

function randomItem(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items[
    Math.floor(Math.random() * items.length)
  ];
}

/*
|--------------------------------------------------------------------------
| CLEAN EMOJI LIST
|--------------------------------------------------------------------------
*/

function cleanEmojiList(value) {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];

  const result = [];

  for (const item of input) {
    const emojis = String(item || "")
      .trim()
      .split(/[\s,;]+/)
      .filter(Boolean);

    for (const emoji of emojis) {
      if (!result.includes(emoji)) {
        result.push(emoji);
      }

      if (result.length >= 40) {
        return result;
      }
    }
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| LOAD STICKER CATALOG
|--------------------------------------------------------------------------
*/

function loadStickerCatalog() {
  try {
    if (!fs.existsSync(CATALOG_FILE)) {
      console.warn(
        "[AUTO STATUS STICKER] Catalog not found."
      );

      return [];
    }

    const raw = fs.readFileSync(
      CATALOG_FILE,
      "utf8"
    );

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.stickers)) {
      console.warn(
        "[AUTO STATUS STICKER] Invalid catalog format."
      );

      return [];
    }

    return parsed.stickers.filter(item => {
      return (
        item &&
        typeof item.emoji === "string" &&
        item.emoji.trim() &&
        typeof item.file === "string" &&
        item.file.trim()
      );
    });

  } catch (error) {
    console.error(
      "[AUTO STATUS STICKER] Catalog error:",
      error?.message || error
    );

    return [];
  }
}

/*
|--------------------------------------------------------------------------
| FIND STICKER FILE
|--------------------------------------------------------------------------
*/

function getStickerPath(sticker) {
  if (!sticker || typeof sticker.file !== "string") {
    return null;
  }

  const filename = sticker.file.trim();

  // Only accept filenames, not arbitrary paths.
  if (
    !filename ||
    path.basename(filename) !== filename ||
    !filename.toLowerCase().endsWith(".webp")
  ) {
    return null;
  }

  const filePath = path.join(
    STICKER_DIRECTORY,
    filename
  );

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    if (!fs.statSync(filePath).isFile()) {
      return null;
    }

    return filePath;

  } catch {
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| SELECT STICKER
|--------------------------------------------------------------------------
*/

async function selectStatusSticker(
  statusData = {},
  options = {}
) {
  const catalog = loadStickerCatalog();

  const customEmojis = cleanEmojiList(
    options.statusReplyEmojis
  );

  let availableStickers = catalog.filter(sticker => {
    return Boolean(getStickerPath(sticker));
  });

  // If the user configured emojis, use only those emojis.
  if (customEmojis.length > 0) {
    availableStickers = availableStickers.filter(
      sticker => customEmojis.includes(sticker.emoji)
    );
  }

  if (availableStickers.length === 0) {
    console.warn(
      "[AUTO STATUS STICKER] No matching sticker files available."
    );

    return {
      success: false,
      reason: "No matching sticker files."
    };
  }

  let aiResult = null;

  try {
    aiResult = await chooseEmojiWithSource(statusData);
  } catch (error) {
    console.error(
      "[AUTO STATUS STICKER] AI selection failed:",
      error?.message || error
    );
  }

  const aiEmoji =
    typeof aiResult?.emoji === "string"
      ? aiResult.emoji.trim()
      : "";

  // Keep the AI choice only if it has a matching sticker.
  const matchingStickers = availableStickers.filter(
    sticker => sticker.emoji === aiEmoji
  );

  const selectedSticker =
    matchingStickers.length > 0
      ? randomItem(matchingStickers)
      : randomItem(availableStickers);

  return {
    success: true,
    sticker: selectedSticker,
    emoji: selectedSticker.emoji,
    source:
      matchingStickers.length > 0
        ? aiResult?.source || "ai"
        : "fallback"
  };
}

/*
|--------------------------------------------------------------------------
| SEND PRIVATE STATUS STICKER
|--------------------------------------------------------------------------
*/

async function sendAutoStatusSticker(
  sock,
  message,
  statusData = {},
  options = {}
) {
  if (!sock || !message?.key) {
    return {
      success: false,
      reason: "Socket or message unavailable."
    };
  }

  if (options.autoStatusReply === false) {
    return {
      success: false,
      ignored: true,
      reason: "Auto Status Reply disabled."
    };
  }

  const originalKey = message.key;

  const participant = originalKey.participant;

  if (
    originalKey.remoteJid !== "status@broadcast" ||
    !originalKey.id ||
    !participant ||
    originalKey.fromMe
  ) {
    return {
      success: false,
      ignored: true,
      reason: "Invalid Status owner or message."
    };
  }

  const selection = await selectStatusSticker(
    statusData,
    options
  );

  if (!selection.success) {
    return selection;
  }

  const stickerPath = getStickerPath(
    selection.sticker
  );

  if (!stickerPath) {
    return {
      success: false,
      reason: "Sticker file not found."
    };
  }

  try {
    const stickerBuffer = fs.readFileSync(
      stickerPath
    );

    if (!stickerBuffer.length) {
      throw new Error("Sticker file is empty.");
    }

    await sock.sendMessage(
  participant,
  {
    sticker: stickerBuffer
  },
  {
    quoted: message
  }
);

    console.log(
      "[AUTO STATUS STICKER] Private sticker sent:",
      {
        participant,
        statusId: originalKey.id,
        emoji: selection.emoji,
        file: selection.sticker.file,
        source: selection.source
      }
    );

    return {
      success: true,
      participant,
      emoji: selection.emoji,
      file: selection.sticker.file,
      source: selection.source
    };

  } catch (error) {
    console.error(
      "[AUTO STATUS STICKER] Send failed:",
      error?.stack || error
    );

    return {
      success: false,
      reason: error?.message || "Sticker send failed."
    };
  }
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  loadStickerCatalog,
  selectStatusSticker,
  sendAutoStatusSticker
};

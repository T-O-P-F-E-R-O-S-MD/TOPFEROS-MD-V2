
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// GEMINI AI STATUS REACTION SERVICE

const {
  askAI,
  askAIWithImage
} = require("./ai");

const {
  AI_EMOJIS,
  FALLBACK_EMOJIS,
  getAIEmojiList,
  rememberAIEmojis
} = require("./emojiService");

const AI_TIMEOUT_MS = 30000;

const ALLOWED_EMOJIS = Array.isArray(AI_EMOJIS)
  ? [...new Set(AI_EMOJIS.filter(Boolean))]
  : [];

const SAFE_FALLBACK_EMOJIS = Array.isArray(FALLBACK_EMOJIS)
  ? [...new Set(FALLBACK_EMOJIS.filter(Boolean))]
  : [];

function getChatKey(statusData = {}) {
  return String(
    statusData.chatId ||
    statusData.participant ||
    statusData.sender ||
    "TOPFEROS_GLOBAL_STATUS"
  );
}

function getRandomFromList(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return "❤️";
  }

  return list[Math.floor(Math.random() * list.length)];
}

function getAvailableEmojis(chatId) {
  const available = getAIEmojiList(chatId);

  return available.length
    ? available
    : ALLOWED_EMOJIS;
}

function rememberSelectedEmoji(chatId, emoji) {
  if (emoji && ALLOWED_EMOJIS.includes(emoji)) {
    rememberAIEmojis(chatId, [emoji]);
  }
}

function getRandomDefaultEmoji(chatId) {
  const available = getAvailableEmojis(chatId);

  const fallbackAvailable = SAFE_FALLBACK_EMOJIS.filter(
    emoji => available.includes(emoji)
  );

  return getRandomFromList(
    fallbackAvailable.length
      ? fallbackAvailable
      : available
  );
}

/*
|--------------------------------------------------------------------------
| FALLBACK EMOJI
|--------------------------------------------------------------------------
*/

function getFallbackEmoji(statusData = {}) {
  const chatId = getChatKey(statusData);

  const text = [
    statusData.text || "",
    statusData.caption || ""
  ].join(" ").toLowerCase();

  let preferredEmoji = null;

  if (/love|lanmou|renmen|amour|cheri|chérie/.test(text)) {
    preferredEmoji = "❤️";
  } else if (/lol|haha|komik|drole|drôle|funny|😂/.test(text)) {
    preferredEmoji = "😂";
  } else if (/birthday|anivèsè|anniversaire/.test(text)) {
    preferredEmoji = "🎂";
  } else if (/amen|bondye|god|jesus|lapriyè|prière/.test(text)) {
    preferredEmoji = "🙏";
  } else if (/sad|tris|triste|lapenn/.test(text)) {
    preferredEmoji = "❤️";
  } else if (/beautiful|bèl|joli|magnifique/.test(text)) {
    preferredEmoji = "😍";
  } else if (statusData.mediaType === "image") {
    preferredEmoji = "😍";
  }

  const available = getAvailableEmojis(chatId);

  if (
    preferredEmoji &&
    available.includes(preferredEmoji)
  ) {
    return preferredEmoji;
  }

  return getRandomDefaultEmoji(chatId);
}

/*
|--------------------------------------------------------------------------
| EXTRACT ONE COMPLETE EMOJI
|--------------------------------------------------------------------------
*/

function extractEmoji(text) {
  if (typeof text !== "string") {
    return null;
  }

  const value = text.trim();

  if (!value) {
    return null;
  }

  if (
    typeof Intl !== "undefined" &&
    typeof Intl.Segmenter === "function"
  ) {
    const segmenter = new Intl.Segmenter(
      "en",
      { granularity: "grapheme" }
    );

    for (const item of segmenter.segment(value)) {
      const segment = item.segment;

      if (
        /\p{Extended_Pictographic}/u.test(segment) ||
        /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(segment) ||
        /^[0-9#*]\uFE0F?\u20E3$/u.test(segment)
      ) {
        return segment;
      }
    }

    return null;
  }

  const match = value.match(
    /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/u
  );

  return match ? match[0] : null;
}

/*
|--------------------------------------------------------------------------
| BUILD GEMINI PROMPT
|--------------------------------------------------------------------------
*/

function buildPrompt(statusData = {}, allowedEmojis = ALLOWED_EMOJIS) {
  const text = String(
    statusData.text ||
    statusData.caption ||
    ""
  ).trim();

  const mediaType = String(
    statusData.mediaType || "text"
  ).toLowerCase();

  let context = "";

  if (text) {
    context =
      `Status text/caption: ${text}\n` +
      `Media type: ${mediaType}`;
  } else if (mediaType === "image") {
    context =
      "The status contains an image. " +
      "Analyze the supplied image if available.";
  } else if (mediaType === "video") {
    context =
      "The status contains a video. " +
      "No video frames or transcript are available.";
  } else if (mediaType === "audio") {
    context =
      "The status contains audio. " +
      "No audio transcript is available.";
  } else {
    context = "The status has no readable text.";
  }

  return [
    "You are the emoji reaction assistant for TOPFEROS MD.",
    "Analyze the meaning and emotional tone of this WhatsApp Status.",
    "Choose exactly ONE emoji from the allowed emoji list.",
    "Never invent an emoji outside the allowed list.",
    "Do not repeat recently used emojis.",
    "Return only the emoji.",
    "Do not explain your answer.",
    "",
    "ALLOWED EMOJIS:",
    allowedEmojis.join(" "),
    "",
    context
  ].join("\n");
}

/*
|--------------------------------------------------------------------------
| EXTRACT GEMINI RESPONSE TEXT
|--------------------------------------------------------------------------
*/

function extractAIText(response) {
  if (typeof response === "string") {
    return response.trim();
  }

  if (!response || typeof response !== "object") {
    return "";
  }

  if (typeof response.text === "string") {
    return response.text.trim();
  }

  if (typeof response.output === "string") {
    return response.output.trim();
  }

  if (response.candidates?.[0]?.content?.parts) {
    return response.candidates[0].content.parts
      .map(part => part.text || "")
      .join("")
      .trim();
  }

  const content =
    response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map(item => item.text || "")
      .join("")
      .trim();
  }

  if (typeof response.choices?.[0]?.text === "string") {
    return response.choices[0].text.trim();
  }

  return "";
}

/*
|--------------------------------------------------------------------------
| VALIDATE AI EMOJI
|--------------------------------------------------------------------------
*/

function getAllowedAIEmoji(response, allowedEmojis) {
  const emoji = extractEmoji(
    extractAIText(response)
  );

  if (!emoji) {
    return null;
  }

  return allowedEmojis.includes(emoji)
    ? emoji
    : null;
}

/*
|--------------------------------------------------------------------------
| AI TIMEOUT
|--------------------------------------------------------------------------
*/

async function withTimeout(
  promise,
  timeoutMs = AI_TIMEOUT_MS
) {
  let timer;

  try {
    return await Promise.race([
      Promise.resolve(promise),

      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `Gemini AI timeout after ${timeoutMs}ms`
            )
          );
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/*
|--------------------------------------------------------------------------
| GEMINI EMOJI SELECTION
|--------------------------------------------------------------------------
*/

async function chooseEmojiWithSource(statusData = {}) {
  const chatId = getChatKey(statusData);

  let availableEmojis = getAvailableEmojis(chatId);

  const fallback = getFallbackEmoji(statusData);

  const prompt = buildPrompt(
    statusData,
    availableEmojis
  );

  const hasImage =
    statusData.mediaType === "image" &&
    Buffer.isBuffer(statusData.media) &&
    statusData.media.length > 0;

  const hasReadableText = Boolean(
    String(
      statusData.text ||
      statusData.caption ||
      ""
    ).trim()
  );

  if (!ALLOWED_EMOJIS.length) {
    console.error(
      "[STATUS AI] Central emoji list is empty."
    );

    return {
      emoji: "❤️",
      source: "fallback"
    };
  }

  if (!hasImage && !hasReadableText) {
    rememberSelectedEmoji(chatId, fallback);

    return {
      emoji: fallback,
      source: "fallback"
    };
  }

  // IMAGE STATUS
  if (hasImage) {
    try {
      const imageAnswer = await withTimeout(
        askAIWithImage(
          prompt,
          statusData.media,
          statusData.mimeType || "image/jpeg",
          {
            systemPrompt:
              "Analyze the supplied WhatsApp Status image. " +
              "Choose exactly one emoji from the allowed list. " +
              "Return only that emoji.",
            temperature: 0.2,
            maxTokens: 128
          }
        )
      );

      const imageEmoji = getAllowedAIEmoji(
        imageAnswer,
        availableEmojis
      );

      if (imageEmoji) {
        rememberSelectedEmoji(chatId, imageEmoji);

        return {
          emoji: imageEmoji,
          source: "gemini-image"
        };
      }

      console.warn(
        "[STATUS AI] Image response contained no allowed emoji."
      );
    } catch (error) {
      console.error(
        "[STATUS AI] Image analysis failed:",
        error?.message || error
      );
    }
  }

  // TEXT STATUS
  if (hasReadableText) {
    try {
      const response = await withTimeout(
        askAI(prompt, {
          systemPrompt:
            "Choose exactly one emoji from the allowed list " +
            "for this WhatsApp Status. Return only the emoji.",
          temperature: 0.2,
          maxTokens: 128
        })
      );

      const emoji = getAllowedAIEmoji(
        response,
        availableEmojis
      );

      if (emoji) {
        rememberSelectedEmoji(chatId, emoji);

        return {
          emoji,
          source: "gemini"
        };
      }

      console.warn(
        "[STATUS AI] Text response contained no allowed emoji."
      );
    } catch (error) {
      console.error(
        "[STATUS AI] Gemini failed:",
        error?.message || error
      );
    }
  }

  // Refresh list in case another status used an emoji meanwhile.
  availableEmojis = getAvailableEmojis(chatId);

  const safeFallback = availableEmojis.includes(fallback)
    ? fallback
    : getRandomDefaultEmoji(chatId);

  rememberSelectedEmoji(chatId, safeFallback);

  return {
    emoji: safeFallback,
    source: "fallback"
  };
}

/*
|--------------------------------------------------------------------------
| CHOOSE EMOJI
|--------------------------------------------------------------------------
*/

async function chooseEmoji(statusData = {}) {
  const result =
    await chooseEmojiWithSource(statusData);

  return result.emoji;
}

/*
|--------------------------------------------------------------------------
| ANALYZE STATUS
|--------------------------------------------------------------------------
*/

async function analyzeStatus(statusData = {}) {
  const result =
    await chooseEmojiWithSource(statusData);

  return {
    emoji: result.emoji,
    source: result.source,
    statusText:
      statusData.text ||
      statusData.caption ||
      "",
    mediaType:
      statusData.mediaType || "text",
    messageId:
      statusData.messageId || null,
    participant:
      statusData.participant || null
  };
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  chooseEmoji,
  chooseEmojiWithSource,
  analyzeStatus,
  extractEmoji,
  extractAIText,
  buildPrompt,
  getFallbackEmoji
};

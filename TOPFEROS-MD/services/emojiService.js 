
"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD — CENTRAL EMOJI SERVICE
|--------------------------------------------------------------------------
| Sous santral emoji aplikasyon an.
| AI a itilize lis sa a epi evite repete dènye emoji li te voye yo.
|--------------------------------------------------------------------------
*/

const EMOJI_SOURCE = `
😀🥹😅😂🥲😊😇😍🥰😘🤪🤓😎🥸🤩🥳🙂‍↕️😏😒😞😔😟😕😣😫😖😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😶‍🌫️😱😨😰😥😓🤗🤔🫣🤭🫢🫡🤫🫠🤥😶🫥😐😲🥱🫪😴😈🤢🤮😷🤒🤡🤕💩👻💀☠️👽👏🫶🤲👐👏🤝👍👎👊✊🤜🫷🤞🫴🏻✍️🫵🦶🫂👰👰‍♂️🥷🧟🧜🤰🫃🤱🙅🧏‍♂️🤦🤦‍♂️🤷‍♂️💇‍♂️🧖‍♂️🤳💃🧑‍🩰🕴️👩‍🦽🚶‍♀️🚶🧎‍♀️🏃🏃‍♀️👩‍❤️‍👨👬💑👔🩱👘🥻👙🩲👞👟🥾🧦👑💍👛🌂🥽🎒👜🐶🐱🐭🐹🐰🦊🐻🐼🐻‍❄️🐨🐯🦁🐮🐷🐽🐸🐵🙈🙉🙊🐔🐧🐤🐣🐥🪿🦆🐆🦥🌹🌺🌝🌚🌒☄️💫✨🌟💥🔥🫯🌈🌪️☀️💧💦☔🌊⛄🍎🍇🥑🍔🌭🌯🎂☕🍺🥃🍷🧊⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🪃🥅⛳🪁🛝🏹🎣🤿🥊🥋🎽🛹🛼🛷⛸️🥌🎿⛷️🏂🪂🏋️‍♀️🤼‍♀️🤼🤸‍♀️⛹️‍♀️⛹️🏇🏄‍♀️🏊🚣🏻‍♂️🚵🧗‍♀️🚴‍♂️🏆🥇🥈🥉🏅🎖️🏵️🎗️🎫🎟️🎪🤹‍♀️🤹🎭🩰🎨🫟🎬🎤🎧🎼🎹🪇🥁🪘🎷🎺🪊🪗🎸🪕🪉🎻🪈🎲♟️🎯🎳🎮🎰🧩🚗🚓🚑🛴🚘🚔🚨🚟🚄✈️🚀🛰️🛥️🚥⛽🏰🏯🏟️🎡🎢🎠⛲⛱️🏖️🏝️🏜️🌋⛰️🏔️🏕️🏢💒🕌🛕🏦🏥🏣🌄🌠🎇🎆🌇🌆🏙️🌃🌌🌉🌁⌚📱📲💻🖥️🖨️🖱️💿📸📟📺🕯️🪔💸💵💎⚖️🪎🔮💉🩸🧻🛏️🛌🏻🧸🖼️🪄🎀🎊🎉🎎🪭🏮🪩📩📨💌🩷❤️🧡💛💚🩵💙💜🖤🩶🤍🤎💔❤️‍🔥❤️‍🩹❣️💕💞💓💗💖💘💝💟☮️✝️☪️🕉️☸️🕉️🪯✡️🔯🕎☯️☦️🛐⛎♈♉♊♋♌♍♎♏♐♑♒♓🆔⚛️🉑☢️☣️📴📳🈶🈚🈸🈺🈷️✴️🆚💮💯🆘🛑🧑‍🧑‍🧒‍🧒🧑‍🧒🧑‍🧒‍🧒🚼🇭🇹🏳️🏴🏴‍☠️🏁🚩🏳️‍🌈🏳️‍⚧️🏳‍🟧‍⬛‍🟧🇺🇳🇦🇫🇦🇽🇦🇱🇩🇿🇦🇸🇦🇩🇦🇴🇦🇮🇦🇶🇦🇬🇦🇷🇦🇲🇦🇼🇦🇺🇦🇹🇦🇿🇧🇸🇧🇭🇧🇩🇧🇧🇧🇾🇧🇪🇧🇿🇧🇯🇧🇲🇧🇹🇧🇴🇧🇦🇧🇼🇧🇷🇻🇬🇧🇳🇧🇬🇧🇫🇧🇮🇰🇭🇨🇲🇨🇦🇮🇨🇨🇻🇧🇶🇰🇾🇨🇫🇹🇩🇮🇴🇨🇱🇨🇳🇨🇽🇨🇨🇨🇴🇰🇲🇨🇬🇨🇩🇨🇰🇨🇷🇨🇮🇭🇷🇨🇺🇨🇼🇨🇾🇨🇿🇩🇰🇩🇯🇩🇲🇩🇴🇪🇨🇪🇬🇸🇻🇬🇶🇪🇷🇪🇪🇸🇿🇪🇹🇪🇺🇫🇰🇫🇴🇫🇯🇫🇮🇫🇷🇬🇫🇵🇫🇹🇫🇬🇦🇬🇲🇬🇪🇬🇭🇬🇮🇬🇷🇬🇱🇬🇩🇬🇵🇬🇺🇬🇹🇬🇬🇬🇳🇬🇼🇬🇾🇭🇳🇭🇰🇭🇺🇮🇸🇮🇳🇮🇩🇮🇷🇮🇶🇮🇪🇮🇲🇮🇱🇮🇹🇯🇲🇯🇵🎌🇯🇪🇯🇴🇰🇿🇰🇪🇰🇮🇽🇰🇰🇼🇰🇬🇱🇦🇱🇻🇱🇧🇱🇸🇱🇷🇱🇾🇱🇮🇱🇹🇱🇺🇲🇴🇲🇬🇲🇼🇲🇾🇲🇻🇲🇱🇲🇹🇲🇭🇲🇶🇲🇷🇲🇺🇾🇹🇲🇽🇫🇲🇲🇩🇲🇨🇲🇳🇲🇪🇲🇸🇲🇦🇲🇿🇲🇲🇳🇦🇳🇷🇳🇵🇳🇱🇳🇨🇳🇿🇳🇮🇳🇪🇳🇬🇳🇺🇳🇫🇰🇵🇲🇰🇲🇵🇳🇴🇴🇲🇵🇰🇵🇼🇵🇸🇵🇦🇵🇬🇵🇾🇵🇪🇵🇭🇵🇳🇵🇱🇵🇹🇵🇷🇶🇦🇷🇪🇷🇴🇷🇺🇷🇼🇼🇸🇸🇲🇨🇶🇨🇶🇸🇦🇸🇳🇸🇨🇷🇸🇷🇸🇸🇰🇸🇱🇸🇮
`;

/*
|--------------------------------------------------------------------------
| EMOJI SPLITTER
|--------------------------------------------------------------------------
| Kenbe emoji konplè: drapo, ZWJ, koulè po, variation selectors.
|--------------------------------------------------------------------------
*/

const segmenter =
  typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : null;

function splitEmojis(value) {
  if (!value) return [];

  if (segmenter) {
    return Array.from(
      segmenter.segment(value),
      item => item.segment
    );
  }

  // Fallback: Intl.Segmenter disponib nan Node.js modèn.
  return Array.from(value);
}

/*
|--------------------------------------------------------------------------
| MAIN EMOJI LIST
|--------------------------------------------------------------------------
*/

const EMOJI_LIST = Object.freeze([
  ...new Set(splitEmojis(EMOJI_SOURCE.trim()))
]);

const STATUS_EMOJIS = EMOJI_LIST;

// AI a gen aksè ak lis santral la.
const AI_EMOJIS = EMOJI_LIST;

// Egzakteman 100 emoji diferan.
const FALLBACK_EMOJIS = Object.freeze(
  EMOJI_LIST.slice(0, 100)
);

const FALLBACK_EMOJI = "❤️";

/*
|--------------------------------------------------------------------------
| AI ANTI-REPEAT MEMORY
|--------------------------------------------------------------------------
| Sonje 50 dènye emoji chak chat.
| Sa anpeche AI a repete menm emoji yo twò vit.
|--------------------------------------------------------------------------
*/

const AI_RECENT_LIMIT = 50;
const aiRecentEmojis = new Map();

function getRecentAIEmojis(chatId) {
  if (!chatId) return [];

  return aiRecentEmojis.get(String(chatId)) || [];
}

function rememberAIEmojis(chatId, emojis) {
  if (!chatId || !Array.isArray(emojis)) return [];

  const id = String(chatId);
  const previous = getRecentAIEmojis(id);
  const added = cleanEmojiList(emojis);

  const updated = [
    ...previous,
    ...added
  ].slice(-AI_RECENT_LIMIT);

  aiRecentEmojis.set(id, updated);

  return updated;
}

/*
|--------------------------------------------------------------------------
| CLEAN EMOJI LIST
|--------------------------------------------------------------------------
*/

function cleanEmojiList(value, limit = 5000) {
  if (!Array.isArray(value)) {
    value = typeof value === "string" ? [value] : [];
  }

  const result = [];

  for (const item of value) {
    if (typeof item !== "string") continue;

    for (const emoji of splitEmojis(item.trim())) {
      if (
        emoji &&
        !result.includes(emoji) &&
        result.length < limit
      ) {
        result.push(emoji);
      }
    }
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| AI EMOJI FUNCTIONS
|--------------------------------------------------------------------------
*/

/**
 * Retounen emoji AI poko itilize dènyèman nan chat sa a.
 */
function getAIEmojiList(chatId) {
  const recent = new Set(getRecentAIEmojis(chatId));

  let available = AI_EMOJIS.filter(
    emoji => !recent.has(emoji)
  );

  // Si tout lis la fin pase, rekòmanse ak lis konplè a.
  if (available.length === 0) {
    aiRecentEmojis.delete(String(chatId));
    available = [...AI_EMOJIS];
  }

  return available;
}

/**
 * Retounen yon lis emoji AI ka itilize nan prompt li.
 */
function getAIEmojiPrompt(chatId) {
  const available = getAIEmojiList(chatId);

  return [
    "EMOJI RULES:",
    "- Use emojis only from the list below.",
    "- Do not repeat the same emoji in one response.",
    "- Avoid emojis used recently in this chat.",
    "- Use emojis naturally; do not add one to every sentence.",
    "- If no emoji is necessary, do not use any.",
    "",
    "AVAILABLE EMOJIS:",
    available.join(" ")
  ].join("\n");
}

/**
 * Verifye emoji AI retounen yo.
 * Retire emoji ki pa nan lis la ak doublon nan menm repons lan.
 */
function filterAIEmojis(chatId, text) {
  if (typeof text !== "string") return "";

  const allowed = new Set(AI_EMOJIS);
  const recent = new Set(getRecentAIEmojis(chatId));
  const usedInResponse = new Set();

  const tokens = splitEmojis(text);

  const filtered = tokens.map(token => {
    if (!allowed.has(token)) return token;

    // Retire emoji ki deja nan menm repons lan.
    if (usedInResponse.has(token)) return "";

    // Retire emoji ki te itilize dènyèman nan chat la.
    if (recent.has(token)) return "";

    usedInResponse.add(token);
    return token;
  }).join("");

  // Anrejistre emoji ki rete nan repons lan.
  const sent = splitEmojis(filtered).filter(
    emoji => allowed.has(emoji)
  );

  rememberAIEmojis(chatId, sent);

  return filtered;
}

/**
 * Chwazi yon emoji AI o aza san repete dènye yo.
 */
function getRandomAIEmoji(chatId) {
  const available = getAIEmojiList(chatId);

  const emoji =
    available[Math.floor(Math.random() * available.length)];

  rememberAIEmojis(chatId, [emoji]);

  return emoji;
}

/*
|--------------------------------------------------------------------------
| GENERAL EMOJI FUNCTIONS
|--------------------------------------------------------------------------
*/

function getRandomEmoji(list = EMOJI_LIST) {
  const source =
    Array.isArray(list) && list.length
      ? list
      : EMOJI_LIST;

  return source[Math.floor(Math.random() * source.length)];
}

function getFallbackEmoji() {
  return FALLBACK_EMOJI;
}

function getFallbackEmojis() {
  return FALLBACK_EMOJIS;
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  EMOJI_SOURCE,
  EMOJI_LIST,
  STATUS_EMOJIS,
  AI_EMOJIS,

  FALLBACK_EMOJIS,
  FALLBACK_EMOJI,

  cleanEmojiList,
  splitEmojis,

  getRandomEmoji,
  getFallbackEmoji,
  getFallbackEmojis,

  getAIEmojiList,
  getAIEmojiPrompt,
  getRandomAIEmoji,
  filterAIEmojis,
  rememberAIEmojis,
  getRecentAIEmojis
};

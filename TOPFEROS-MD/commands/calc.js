
"use strict";

const { registerCommand } = require("../src/messageHandler");

function calculate(expression) {
  const input = String(expression || "").replace(/\s+/g, "");

  if (!input) throw new Error("Ekri yon kalkil.");

  if (!/^[0-9+\-*/().%]+$/.test(input)) {
    throw new Error("Kalkil sa a pa valab.");
  }

  if (/[+\-*/%.]{2,}/.test(input.replace(/^-/, ""))) {
    throw new Error("Operatè pa valab.");
  }

  const result = Function('"use strict"; return (' + input + ')')();

  if (!Number.isFinite(result)) {
    throw new Error("Rezilta pa valab.");
  }

  return result;
}

async function calcCommand(ctx) {
  try {
    const result = calculate(ctx.text);

    await ctx.send(
      `🧮 CALCULATOR\n\n` +
      `Expression: ${ctx.text}\n` +
      `Result: ${result}\n\n` +
      `🦁 TECH BY TOPFEROS MD 🐑`
    );

    return { success: true, result };
  } catch (error) {
    await ctx.send(
      `❌ CALC ERROR\n\n${error.message}\n\n` +
      `Example: ${ctx.prefix}calc 25+75`
    );

    return { success: false };
  }
}

registerCommand("calc", calcCommand, {
  aliases: ["calculate", "math"],
  description: "Mathematical calculator",
  usage: ".calc 25+75",
  category: "UTILITY"
});

module.exports = { calcCommand };


"use strict";

const axios = require("axios");
const net = require("net");

const { registerCommand } = require("../src/messageHandler");

function isPrivateIP(ip) {
  if (net.isIP(ip) === 4) {
    const p = ip.split(".").map(Number);

    return (
      p[0] === 10 ||
      p[0] === 127 ||
      p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168 ||
       p[0] === 192 && p[1] === 0) ||
      p[0] >= 224
    );
  }

  if (net.isIP(ip) === 6) {
    const value = ip.toLowerCase();

    return (
      value === "::1" ||
      value === "::" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe80:")
    );
  }

  return false;
}

function validateURL(input) {
  let value = String(input || "").trim();

  if (!value) {
    throw new Error("Tanpri bay yon URL.");
  }

  if (!/^https?:\/\//i.test(value)) {
    value = "https://" + value;
  }

  const url = new URL(value);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Se HTTP oswa HTTPS sèlman.");
  }

  if (
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error("URL sa a pa valab.");
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    isPrivateIP(hostname)
  ) {
    throw new Error("URL prive pa otorize.");
  }

  return url;
}

async function screenshotCommand(ctx) {
  try {
    const url = validateURL(ctx.text);

    await ctx.send(
      "📸 SCREENSHOT\n\n" +
      "M ap pran screenshot sit la. Tanpri tann..."
    );

    const screenshotURL =
      "https://image.thum.io/get/width/1280/fullpage/noanimate/" +
      url.href;

    const response = await axios.get(
      screenshotURL,
      {
        responseType: "arraybuffer",
        timeout: 60000,
        maxContentLength: 12 * 1024 * 1024,
        maxBodyLength: 12 * 1024 * 1024,
        validateStatus: status =>
          status >= 200 && status < 300
      }
    );

    const image = Buffer.from(response.data);

    if (!image.length) {
      throw new Error("Screenshot vid.");
    }

    const contentType =
      String(response.headers["content-type"] || "");

    if (!contentType.startsWith("image/")) {
      throw new Error(
        "Sèvis screenshot la pa retounen yon imaj."
      );
    }

    const isPNG =
      image[0] === 0x89 &&
      image[1] === 0x50 &&
      image[2] === 0x4e &&
      image[3] === 0x47;

    const isJPEG =
      image[0] === 0xff &&
      image[1] === 0xd8 &&
      image[2] === 0xff;

    if (!isPNG && !isJPEG) {
      throw new Error("Fòma imaj la pa sipòte.");
    }

    await ctx.sock.sendMessage(
      ctx.jid,
      {
        image,
        mimetype: isPNG ? "image/png" : "image/jpeg",
        caption:
          "📸 WEBSITE SCREENSHOT\n\n" +
          `🌐 Website: ${url.href}\n\n` +
          "✅ Screenshot resevwa avèk siksè.\n\n" +
          "🦁 TECH BY TOPFEROS MD 🐑"
      },
      {
        quoted: ctx.message
      }
    );

    return {
      success: true,
      url: url.href
    };

  } catch (error) {
    console.error("[SS ERROR]", error);

    await ctx.send(
      "❌ SCREENSHOT FAILED\n\n" +
      (error.message || "Yon erè rive.") +
      "\n\nEgzanp:\n" +
      `${ctx.prefix}ss https://google.com`
    );

    return {
      success: false,
      error: error.message
    };
  }
}

registerCommand("ss", screenshotCommand, {
  aliases: ["screenshot"],
  description: "Take a screenshot of a website.",
  usage: ".ss https://example.com",
  category: "UTILITY"
});

module.exports = {
  screenshotCommand,
  validateURL
};

"use strict";

/*
|--------------------------------------------------------------------------
| 🦁 TOPFEROS MD V2.0.0
| PAIR COMMAND
|--------------------------------------------------------------------------
|
| Usage:
| .pair 509XXXXXXXX
|
|--------------------------------------------------------------------------
*/

async function pairCommand(
  sock,
  message,
  args = []
) {
  const number = String(
    args?.[0] || ""
  ).replace(/\D/g, "");

  const jid =
    message?.key?.remoteJid || "";

  // PHONE NUMBER REQUIRED
  if (!number) {
    if (jid && sock) {
      await sock.sendMessage(jid, {
        text: [
          "╭━━━〔 🦁 TOPFEROS MD V2.0.0 🐑 〕━━━╮",
          "┃",
          "┃ ❌ PHONE NUMBER REQUIRED",
          "┃",
          "┃ 📱 Enter your phone number",
          "┃ 🌍 Use international format",
          "┃",
          "┃ Example:",
          "┃ .pair 509XXXXXXXX",
          "┃",
          "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯",
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      });
    }

    return {
      success: false,
      error: "Phone number is required."
    };
  }

  // INVALID PHONE NUMBER
  if (
    number.length < 8 ||
    number.length > 15
  ) {
    if (jid && sock) {
      await sock.sendMessage(jid, {
        text: [
          "❌ INVALID PHONE NUMBER",
          "",
          "Use the international format:",
          ".pair 509XXXXXXXX",
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      });
    }

    return {
      success: false,
      error: "Invalid phone number."
    };
  }

  try {
    const {
      pairSession
    } = require("../src/connection");

    // GENERATE PAIRING CODE
    const result = await pairSession(number);

    const pairingCode = String(
      result?.pairingCode || ""
    );

    const sessionId = String(
      result?.sessionId || number
    );

    if (!pairingCode) {
      throw new Error(
        "Pairing code was not generated."
      );
    }

    if (jid && sock) {
      const messageText = [
        "╭━━━〔 🦁 TOPFEROS MD V2.0.0 🐑 〕━━━╮",
        "┃",
        "┃ 🔐 PAIRING CODE",
        "┃",
        `┃ 📱 NUMBER: ${sessionId}`,
        "┃",
        `┃ 🔑 CODE: ${pairingCode}`,
        "┃",
        "┃ 📲 Open WhatsApp on this number.",
        "┃ ⚙️ Go to Linked Devices.",
        "┃ 🔗 Choose Link a Device.",
        "┃ 🔢 Enter the pairing code above.",
        "┃",
        "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯",
        "",
        "🟢 Waiting for WhatsApp pairing...",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n");

      // COPY BUTTON
      const interactiveMessage = {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },
            interactiveMessage: {
              body: {
                text: messageText
              },
              footer: {
                text: "🦁 TECH BY TOPFEROS MD 🐑"
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "cta_copy",
                    buttonParamsJson: JSON.stringify({
                      display_text: "📋 Copy Pairing Code",
                      copy_code: pairingCode
                    })
                  }
                ]
              }
            }
          }
        }
      };

      try {
        await sock.relayMessage(
          jid,
          interactiveMessage,
          {
            messageId:
              typeof sock.generateMessageTag === "function"
                ? sock.generateMessageTag()
                : undefined
          }
        );
      } catch (buttonError) {
        // FALLBACK: SEND CODE AS NORMAL TEXT
        await sock.sendMessage(jid, {
          text: [
            messageText,
            "",
            "📋 COPY YOUR PAIRING CODE:",
            pairingCode
          ].join("\n")
        });
      }
    }

    return {
      success: true,
      sessionId,
      pairingCode
    };

  } catch (error) {
    if (jid && sock) {
      await sock.sendMessage(jid, {
        text: [
          "❌ PAIRING FAILED",
          "",
          `📱 NUMBER: ${number}`,
          "",
          `⚠️ ${error?.message || "Unable to generate pairing code."}`,
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      });
    }

    return {
      success: false,
      error:
        error?.message ||
        "Unable to generate pairing code."
    };
  }
}

module.exports = {
  pairCommand
};
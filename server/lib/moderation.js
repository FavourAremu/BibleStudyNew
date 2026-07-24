// server/lib/moderation.js
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const TIMEOUT_MS = 5000;

export async function moderateContent(text, context = "community post") {
  if (!anthropic) return { allowed: true, reason: "moderation disabled" };
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Moderation timeout")), TIMEOUT_MS)
    );
    const moderationPromise = anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `You are a content moderator for a Christian Bible study community app called "Christian Community Centre". Screen this ${context} for violations.

BLOCK: profanity, hate speech, harassment, spam, sexual content, threats, off-topic content unrelated to faith/Bible/Christian community.
ALLOW: Bible discussion, prayer requests, theological debate, testimonies, spiritual encouragement.

Respond ONLY with valid JSON: {"allowed": true} or {"allowed": false, "reason": "brief explanation"}

Content:
"""
${text.slice(0, 1000)}
"""`
      }]
    });
    const msg = await Promise.race([moderationPromise, timeoutPromise]);
    const parsed = JSON.parse(msg.content[0].text.trim());
    return { allowed: !!parsed.allowed, reason: parsed.reason || "approved" };
  } catch (err) {
    console.error("Moderation error:", err.message);
    return { allowed: true, reason: "moderation check failed, allowed" };
  }
}

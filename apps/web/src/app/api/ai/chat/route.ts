import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Resolve the Anthropic API key.
 *
 * Claude Code sets ANTHROPIC_API_KEY="" in its shell environment, which
 * prevents Next.js / dotenv from overriding it with the value in .env.local.
 * As a fallback we parse .env.local directly.
 */
function resolveApiKey(): string {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return fromEnv;

  // Fallback: read .env.local directly
  try {
    const envPath = join(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("ANTHROPIC_API_KEY=")) {
        const val = trimmed.slice("ANTHROPIC_API_KEY=".length).trim();
        if (val) return val;
      }
    }
  } catch {
    // .env.local not found — fall through to error
  }

  throw new Error("ANTHROPIC_API_KEY not set");
}

let _cachedKey: string | null = null;

function getClient(): Anthropic {
  if (!_cachedKey) _cachedKey = resolveApiKey();
  return new Anthropic({ apiKey: _cachedKey });
}

const DEFAULT_SYSTEM_PROMPT = `You are Foundation AI — a trading assistant for Metal Concentrators SA, a precious metals trading and hedging company based in South Africa.

Your role:
- Help traders analyze precious metals markets (Gold XAU, Silver XAG, Platinum XPT, Palladium XPD)
- Assist with FX analysis, particularly USD/ZAR
- Discuss and evaluate trading strategies, hedging approaches, and risk management
- Analyze charts when screenshots are provided (identify patterns, support/resistance, indicators)
- Help with backtesting strategy ideas and interpreting results
- Provide market research and commentary

Guidelines:
- Be concise and actionable — traders want clear signals, not essays
- Use proper trading terminology
- When analyzing charts, identify specific patterns, levels, and potential trade setups
- Always caveat that you are an AI assistant and not providing financial advice
- Format numbers clearly (e.g., $3,042.15/oz, R18.45)
- When discussing strategies, be specific about entry/exit criteria, stop losses, and position sizing`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Base64-encoded JPEG screenshot (no data:... prefix) */
  imageBase64?: string;
}

/**
 * POST /api/ai/chat
 *
 * Streaming chat endpoint for the AI Trading Assistant.
 * Accepts messages array and optional systemPrompt override.
 * Returns Server-Sent Events with streamed text.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      systemPrompt,
      model = "claude-sonnet-4-20250514",
    } = body as {
      messages: ChatMessage[];
      systemPrompt?: string;
      model?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate image sizes (reject > 4MB base64 ≈ 3MB binary)
    for (const m of messages) {
      if (m.imageBase64 && m.imageBase64.length > 4_000_000) {
        return new Response(
          JSON.stringify({ error: "Image too large. Maximum size is ~3MB." }),
          { status: 413, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const anthropic = getClient();

    // Build the system prompt: default + user customizations
    const fullSystemPrompt = systemPrompt
      ? `${DEFAULT_SYSTEM_PROMPT}\n\n--- Additional Instructions ---\n${systemPrompt}`
      : DEFAULT_SYSTEM_PROMPT;

    // Create streaming response
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 4096,
      system: fullSystemPrompt,
      messages: messages.map((m): MessageParam => {
        // If the message has an attached screenshot, build a vision content array
        if (m.imageBase64 && m.role === "user") {
          return {
            role: m.role,
            content: [
              {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  data: m.imageBase64,
                  media_type: "image/jpeg" as const,
                },
              },
              {
                type: "text" as const,
                text: m.content,
              },
            ],
          };
        }
        // Plain text message
        return { role: m.role, content: m.content };
      }),
    });

    // Convert SDK stream to SSE ReadableStream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Get final message for usage stats
          const finalMessage = await stream.finalMessage();
          const usage = {
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
          };
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, usage })}\n\n`,
            ),
          );
          controller.close();
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errorMsg })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("AI chat error:", error);
    const message =
      error?.status === 401
        ? "Invalid Anthropic API key"
        : error?.status === 429
          ? "Rate limited — please try again shortly"
          : error instanceof Error
            ? error.message
            : "Chat failed";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: error?.status || 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

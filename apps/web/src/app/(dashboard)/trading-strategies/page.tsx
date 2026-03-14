"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  BarChart3,
  Loader2,
  Settings2,
  X,
  Trash2,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";

// ── Types ──

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  hasData?: boolean;
}

interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
}

// ── Constants ──

const DEFAULT_INSTRUCTIONS = `Focus on precious metals (XAU, XAG, XPT, XPD) and USD/ZAR FX markets.
When analyzing charts, identify key support/resistance levels, trend direction, and any notable patterns.
Consider the South African market context and trading hours.
Provide clear entry/exit levels and risk parameters when discussing trade ideas.`;

const SYMBOL_OPTIONS = [
  { value: "OANDA:XAUUSD", label: "XAU/USD (Gold)" },
  { value: "OANDA:XAGUSD", label: "XAG/USD (Silver)" },
  { value: "OANDA:XPTUSD", label: "XPT/USD (Platinum)" },
  { value: "OANDA:XPDUSD", label: "XPD/USD (Palladium)" },
  { value: "FX:USDZAR", label: "USD/ZAR" },
  { value: "FX:ZARUSD", label: "ZAR/USD" },
  { value: "TVC:DXY", label: "DXY (Dollar Index)" },
  { value: "COMEX:GC1!", label: "Gold Futures" },
  { value: "COMEX:SI1!", label: "Silver Futures" },
];

const MODEL_OPTIONS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-sonnet-4-6-20250828", label: "Claude Sonnet 4.6" },
];

const SETTINGS_KEY = "foundation-ai-settings";

interface AISettings {
  instructions: string;
  model: string;
}

function loadSettings(): AISettings {
  if (typeof window === "undefined") {
    return { instructions: DEFAULT_INSTRUCTIONS, model: MODEL_OPTIONS[0].value };
  }
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { instructions: DEFAULT_INSTRUCTIONS, model: MODEL_OPTIONS[0].value };
}

function saveSettings(settings: AISettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

// ── TradingView Widget ──

function TradingViewWidget({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: "D",
      timezone: "Africa/Johannesburg",
      theme: "light",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      hide_volume: false,
      studies: ["STD;RSI", "STD;MACD"],
    });

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";

    containerRef.current.appendChild(widgetDiv);
    containerRef.current.appendChild(script);
  }, [symbol]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: "100%", width: "100%" }}
    />
  );
}

// ── Markdown-lite renderer ──

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">$1</code>')
    .replace(/\n/g, "<br />");
}

// ── Page Component ──

export default function TradingStrategiesPage() {
  // Chart state
  const [selectedSymbol, setSelectedSymbol] = useState(SYMBOL_OPTIONS[0].value);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastUsage, setLastUsage] = useState<UsageInfo | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AISettings>(loadSettings);
  const [settingsDraft, setSettingsDraft] = useState<AISettings>(settings);

  // Chat panel state
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Send message with streaming.
  // Optional `direct` param lets callers bypass the input field (used by analyzeChart).
  const sendMessage = useCallback(
    async (direct?: { displayText: string; apiText: string; hasData?: boolean }) => {
      const displayText = direct?.displayText || input.trim();
      const apiText = direct?.apiText || displayText;
      if (!apiText || isStreaming) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: displayText,
        timestamp: new Date(),
        hasData: direct?.hasData,
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      if (!direct) setInput("");
      setIsStreaming(true);
      setLastUsage(null);

      // Build messages for API — use apiText for the current message
      const apiMessages = [...messages, { role: "user" as const, content: apiText }].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const resp = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            systemPrompt: settings.instructions || undefined,
            model: settings.model,
          }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Request failed" }));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: `Error: ${err.error || "Request failed"}` }
                : m,
            ),
          );
          setIsStreaming(false);
          return;
        }

        const reader = resp.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);

            try {
              const data = JSON.parse(jsonStr);

              if (data.error) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content + `\n\nError: ${data.error}` }
                      : m,
                  ),
                );
              } else if (data.done) {
                if (data.usage) setLastUsage(data.usage);
              } else if (data.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content + data.text }
                      : m,
                  ),
                );
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content || `Error: ${err.message}` }
                : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [input, isStreaming, messages, settings],
  );

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Fetch live market data and auto-send to the AI for analysis
  const analyzeChart = useCallback(async () => {
    if (isStreaming || isFetchingData) return;
    setIsFetchingData(true);

    try {
      const resp = await fetch(
        `/api/market-data?symbol=${encodeURIComponent(selectedSymbol)}`,
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed to fetch market data" }));
        throw new Error(err.error);
      }

      const data = await resp.json();

      const symbolLabel =
        SYMBOL_OPTIONS.find((s) => s.value === selectedSymbol)?.label ||
        selectedSymbol;

      // Build the detailed prompt with market data for the API
      const apiPrompt = [
        `Analyze the following live market data for ${symbolLabel}:`,
        ``,
        `**Current Price:** ${data.current.price} (${data.current.changePct >= 0 ? "+" : ""}${data.current.changePct}%)`,
        `**Today:** Open ${data.current.open} | High ${data.current.high} | Low ${data.current.low} | Close ${data.current.close}`,
        `**Volume:** ${data.current.volume?.toLocaleString() || "N/A"}`,
        ``,
        `**Technical Indicators:**`,
        `- RSI(14): ${data.indicators.rsi14}`,
        `- MACD Line: ${data.indicators.macd.line}`,
        `- MACD Signal: ${data.indicators.macd.signal}`,
        `- MACD Histogram: ${data.indicators.macd.histogram}`,
        `- SMA(20): ${data.indicators.sma20 ?? "N/A"}`,
        `- SMA(50): ${data.indicators.sma50 ?? "N/A"}`,
        data.indicators.sma200 != null ? `- SMA(200): ${data.indicators.sma200}` : null,
        ``,
        `**Key Levels:**`,
        `- 20-Day High: ${data.keyLevels.high20Day}`,
        `- 20-Day Low: ${data.keyLevels.low20Day}`,
        `- 6-Month High: ${data.keyLevels.high6Month}`,
        `- 6-Month Low: ${data.keyLevels.low6Month}`,
        ``,
        `**Last 10 Trading Days:**`,
        ...data.recentBars.map(
          (b: { date: string; open: number; high: number; low: number; close: number; volume: number }) =>
            `${b.date}: O=${b.open} H=${b.high} L=${b.low} C=${b.close} V=${b.volume}`,
        ),
        ``,
        `Data source: ${data.dataSource}`,
        `Total bars available: ${data.totalBars} (6 months daily)`,
        ``,
        `Based on this data, provide:`,
        `1. Current trend direction and strength`,
        `2. Key support and resistance levels`,
        `3. RSI and MACD signal interpretation`,
        `4. Notable patterns or setups`,
        `5. Trading outlook with specific entry/exit levels`,
        `6. Risk considerations and stop-loss suggestions`,
      ]
        .filter((line) => line !== null)
        .join("\n");

      // Short display text shown in the chat bubble
      const displayText = `Analyze ${symbolLabel} with live market data`;

      // Auto-send the analysis request
      setIsFetchingData(false);
      sendMessage({ displayText, apiText: apiPrompt, hasData: true });
    } catch (err: any) {
      setIsFetchingData(false);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Failed to fetch market data: ${err.message}. You can describe the chart manually or try again.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isStreaming, isFetchingData, selectedSymbol, sendMessage]);

  // Save settings
  const handleSaveSettings = () => {
    setSettings(settingsDraft);
    saveSettings(settingsDraft);
    setShowSettings(false);
  };

  // Reset settings
  const handleResetSettings = () => {
    const defaults = {
      instructions: DEFAULT_INSTRUCTIONS,
      model: MODEL_OPTIONS[0].value,
    };
    setSettingsDraft(defaults);
  };

  // Clear chat
  const clearChat = () => {
    setMessages([]);
    setLastUsage(null);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-0 -mt-6 -mx-6">
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Trading Strategies
          </h1>
          <span className="h-4 w-px bg-[var(--color-border)]" />
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1 text-xs font-medium text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
          >
            {SYMBOL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={analyzeChart}
            disabled={isStreaming || isFetchingData}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            title="Fetch live market data and generate AI analysis"
          >
            {isFetchingData ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <BarChart3 size={13} />
            )}
            {isFetchingData ? "Fetching Data..." : "Analyze Chart"}
          </button>
          <button
            onClick={() => {
              setSettingsDraft(settings);
              setShowSettings(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
          >
            <Settings2 size={13} />
            AI Settings
          </button>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TradingView Chart */}
        <div
          className="relative border-b border-[var(--color-border)]"
          style={{ height: chatCollapsed ? "calc(100% - 40px)" : "55%" }}
        >
          <TradingViewWidget symbol={selectedSymbol} />
        </div>

        {/* Chat Panel */}
        <div
          className="flex flex-col bg-[var(--color-surface)]"
          style={{ height: chatCollapsed ? "40px" : "45%" }}
        >
          {/* Chat header */}
          <div
            className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 cursor-pointer select-none"
            onClick={() => setChatCollapsed(!chatCollapsed)}
          >
            <div className="flex items-center gap-2">
              <Bot size={14} className="text-[var(--color-primary)]" />
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                AI Trading Assistant
              </span>
              {lastUsage && (
                <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                  ({lastUsage.inputTokens.toLocaleString()} in / {lastUsage.outputTokens.toLocaleString()} out tokens)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearChat();
                  }}
                  className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
                  title="Clear chat"
                >
                  <Trash2 size={12} />
                </button>
              )}
              {chatCollapsed ? (
                <ChevronUp size={14} className="text-[var(--color-text-muted)]" />
              ) : (
                <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
              )}
            </div>
          </div>

          {/* Chat messages */}
          {!chatCollapsed && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <Bot size={32} className="mx-auto mb-2 text-[var(--color-text-muted)]" />
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Ask me about trading strategies, market analysis, or chart patterns.
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        Try: &quot;What&apos;s the outlook for gold this week?&quot; or &quot;Suggest a hedging strategy for XAU/ZAR&quot;
                      </p>
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
                        <Bot size={12} className="text-[var(--color-primary)]" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-[var(--color-hover)] text-[var(--color-text-primary)]"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: renderMarkdown(msg.content || "..."),
                          }}
                        />
                      ) : (
                        <div>
                          {msg.hasData && (
                            <div className="mb-1 flex items-center gap-1 text-white/70">
                              <BarChart3 size={10} />
                              <span className="text-[10px]">
                                Live market data attached
                              </span>
                            </div>
                          )}
                          <span className="whitespace-pre-wrap">
                            {msg.content}
                          </span>
                        </div>
                      )}
                      {msg.role === "assistant" &&
                        isStreaming &&
                        msg.id === messages[messages.length - 1]?.id && (
                          <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-[var(--color-text-muted)]" />
                        )}
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-text-secondary)]/10">
                        <User size={12} className="text-[var(--color-text-secondary)]" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input bar */}
              <div className="border-t border-[var(--color-border)] px-4 py-2.5">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about strategies, markets, or chart analysis..."
                    rows={1}
                    className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none"
                    disabled={isStreaming}
                  />
                  <button
                    onClick={isStreaming ? () => abortRef.current?.abort() : () => sendMessage()}
                    disabled={!isStreaming && !input.trim()}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
                      isStreaming
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90"
                    }`}
                  >
                    {isStreaming ? (
                      <X size={16} />
                    ) : (
                      <Send size={14} />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                  Press Enter to send, Shift+Enter for new line. AI responses are not financial advice.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-[var(--color-text-secondary)]" />
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  AI Assistant Settings
                </h2>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="space-y-5 px-5 py-4">
              {/* Model selection */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
                  AI Model
                </label>
                <select
                  value={settingsDraft.model}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, model: e.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                  Sonnet 4 is recommended for fast, cost-effective responses. Sonnet 4.6 for deeper analysis.
                </p>
              </div>

              {/* Default instructions */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
                  Default Instructions
                </label>
                <textarea
                  value={settingsDraft.instructions}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      instructions: e.target.value,
                    })
                  }
                  rows={8}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none font-mono"
                  placeholder="Enter custom instructions for the AI assistant..."
                />
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                  These instructions are sent with every query to guide the AI&apos;s responses.
                  Use this to set trading rules, risk parameters, or preferred analysis frameworks.
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3">
              <button
                onClick={handleResetSettings}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
              >
                <RotateCcw size={12} />
                Reset to Defaults
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg px-4 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

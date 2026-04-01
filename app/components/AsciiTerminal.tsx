"use client";

import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  KeyboardEvent,
} from "react";

type HistoryEntry =
  | { type: "command"; text: string }
  | { type: "response"; lines: string[]; flow?: boolean };

type AiTurn = { role: "user" | "assistant"; content: string };

/** Taller viewport so wrapped paragraphs need less scrolling (~7 lines) */
const OUTPUT_MAX_H = "max-h-[7.25rem]";

function RuleLine({ className }: { className?: string }) {
  return (
    <div
      className={`px-2 font-mono text-[9px] sm:text-[10px] text-[#c8ffc8]/40 leading-none overflow-x-auto overflow-y-hidden sm:overflow-x-hidden [-webkit-overflow-scrolling:touch] ${className ?? ""}`}
    >
      <span className="md:hidden whitespace-pre">{`#${"=".repeat(34)}#`}</span>
      <span className="hidden md:inline whitespace-pre">{`#${"=".repeat(100)}#`}</span>
    </div>
  );
}

const INPUT_TEXT_CLASS =
  "font-mono text-[11px] sm:text-xs leading-snug text-white";
const T = "text-[#c8ffc8]";

const HELP_RESPONSE = [
  "┌─────────────────────────────────────────────┐",
  "│           AVAILABLE MODULES                 │",
  "├─────────────────────────────────────────────┤",
  "│  courtvision  → AI-powered basketball HUD   │",
  "│  polymolt     → Multiplayer game engine     │",
  "│  beavertrails → Trail navigation platform   │",
  "│  experience   → Work & education history    │",
  "│  contact      → Reach Jeffrey Wong          │",
  "│  clear        → Clear the console           │",
  "└─────────────────────────────────────────────┘",
];

const PROJECT_RESPONSES: Record<string, string[]> = {
  courtvision: [
    "> Loading module: COURTVISION",
    "  Real-time AI overlay for basketball analytics.",
    "  Stack: Python · OpenCV · React · WebSockets",
    "  Status: [████████░░] 80% complete",
  ],
  polymolt: [
    "> Loading module: POLYMOLT",
    "  High-performance multiplayer game engine.",
    "  Stack: Rust · WebAssembly · Three.js",
    "  Status: [██████████] Live",
  ],
  beavertrails: [
    "> Loading module: BEAVERTRAILS",
    "  Crowdsourced trail conditions & navigation app.",
    "  Stack: Next.js · Supabase · Mapbox GL",
    "  Status: [████████░░] Beta",
  ],
  experience: [
    "> Loading module: EXPERIENCE",
    "  ─────────────────────────────────",
    "  Software Engineer  |  2024–Present",
    "  Full Stack Developer  |  2022–2024",
    "  B.S. Computer Science  |  2022",
    "  ─────────────────────────────────",
  ],
  contact: [
    "> Loading module: CONTACT",
    "  Email  :  jeffrey@example.com",
    "  GitHub :  github.com/jeffreywong",
    "  LinkedIn:  linkedin.com/in/jeffreywong",
  ],
};

function localCommandLines(raw: string): string[] | null {
  const cmd = raw.trim().toLowerCase();
  if (cmd === "help") return HELP_RESPONSE;
  if (PROJECT_RESPONSES[cmd]) return PROJECT_RESPONSES[cmd];
  return null;
}

/** Collapse model “staircase” newlines into paragraphs; each string wraps in the panel. */
function flowAssistantReply(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  return t
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/[ \t]*\r?\n[ \t]*/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export default function AsciiTerminal() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [aiTurns, setAiTurns] = useState<AiTurn[]>([]);
  const [bootLinesVisible, setBootLinesVisible] = useState(true);
  const [pendingReply, setPendingReply] = useState(false);
  const [blink, setBlink] = useState(true);
  const [caretPx, setCaretPx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const syncCaret = useCallback(() => {
    const el = inputRef.current;
    const span = measureRef.current;
    if (!el || !span) return;
    const pos = Math.min(
      el.selectionStart ?? 0,
      el.value.length
    );
    const slice = el.value.slice(0, pos);
    span.textContent = slice.replace(/ /g, "\u00a0") || "\u200b";
    setCaretPx(span.offsetWidth);
  }, []);

  useLayoutEffect(() => {
    syncCaret();
  }, [input, syncCaret]);

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 530);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, pendingReply]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      inputRef.current?.focus();
    }
  }, []);

  const focusInput = () => inputRef.current?.focus();

  const submitRemoteReply = async (raw: string) => {
    setPendingReply(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: raw,
          history: aiTurns.slice(-12),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        const msg = data.error || `Request failed (${res.status})`;
        setHistory((prev) => [
          ...prev,
          { type: "response", lines: ["> Error", `  ${msg}`] },
        ]);
        return;
      }
      const reply = data.reply || "";
      const blocks = flowAssistantReply(reply);
      const lines = blocks.length > 0 ? blocks : ["(empty response)"];
      setHistory((prev) => [
        ...prev,
        {
          type: "response",
          lines: lines.map((l) => `  ${l}`),
          flow: true,
        },
      ]);
      setAiTurns((prev) => [
        ...prev,
        { role: "user", content: raw },
        { role: "assistant", content: reply },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setHistory((prev) => [
        ...prev,
        { type: "response", lines: ["> Error", `  ${msg}`] },
      ]);
    } finally {
      setPendingReply(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const raw = input.trim();
    if (!raw) return;
    e.preventDefault();

    if (raw.toLowerCase() === "clear") {
      setHistory([]);
      setAiTurns([]);
      setInput("");
      return;
    }

    setBootLinesVisible(false);

    const local = localCommandLines(raw);
    setHistory((prev) => [...prev, { type: "command", text: raw }]);
    setInput("");

    if (local) {
      setHistory((prev) => [...prev, { type: "response", lines: local }]);
      return;
    }

    void submitRemoteReply(raw);
  };

  return (
    <div
      className={`w-full flex-1 font-mono ${T} flex flex-col items-center justify-end px-2 sm:px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1 sm:pt-2 cursor-text select-none min-h-0`}
      onClick={focusInput}
    >
      <div className="w-full max-w-6xl flex flex-col border border-[#c8ffc8]/30 min-w-0">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2 px-2 py-1 sm:py-0.5 border-b border-[#c8ffc8]/30 bg-[#c8ffc8]/5 text-[9px] sm:text-[10px] text-[#c8ffc8]/60 tracking-wide sm:tracking-widest uppercase">
          <span className="truncate min-w-0 text-left">
            JEFFREY-WONG.DEV — v1.0
          </span>
          <span className="shrink-0 normal-case tracking-normal text-[#c8ffc8]/40 self-start sm:self-auto">
            [TTY0]
          </span>
        </div>

        <RuleLine className="py-1" />

        {bootLinesVisible && (
          <div className="px-2 pb-1 text-[11px] sm:text-xs leading-snug text-[#c8ffc8]/80 space-y-0.5 break-words">
            <p>
              <span className="text-[#c8ffc8]/40">[ SYS ] </span>
              system initiated. welcome to jeffrey wong&apos;s portfolio
            </p>
            <p>
              <span className="text-[#c8ffc8]/40">[ SYS ] </span>
              type &apos;help&apos; for commands; anything else gets a reply
              here.
            </p>
          </div>
        )}

        {history.length > 0 && (
          <div
            className={`px-2 py-1 ${OUTPUT_MAX_H} overflow-y-auto overflow-x-hidden space-y-1.5 text-[11px] sm:text-xs leading-relaxed border-t border-[#c8ffc8]/15 min-h-0 overscroll-y-contain [-webkit-overflow-scrolling:touch]`}
          >
            {history.map((entry, i) =>
              entry.type === "command" ? (
                <p key={i} className={`${T} pt-1 first:pt-0`}>
                  <span className="text-[#c8ffc8]/50">&gt; </span>
                  {entry.text}
                </p>
              ) : (
                entry.lines.map((line, j) => (
                  <p
                    key={`${i}-${j}`}
                    className={
                      entry.flow
                        ? "text-[#c8ffc8]/80 pl-1 break-words [word-break:break-word]"
                        : "text-[#c8ffc8]/80 pl-1 whitespace-pre-wrap"
                    }
                  >
                    {line}
                  </p>
                ))
              )
            )}
            {pendingReply && (
              <p className="text-[#c8ffc8]/55 pl-1">…</p>
            )}
            <div ref={consoleEndRef} />
          </div>
        )}
        {history.length === 0 && (
          <div ref={consoleEndRef} className="hidden" aria-hidden />
        )}

        <RuleLine className="py-0.5" />

        <div className="px-2 py-1.5 sm:py-1 flex flex-nowrap items-baseline gap-x-1.5 text-[11px] sm:text-xs w-full min-w-0 overflow-x-auto touch-pan-x [-webkit-overflow-scrolling:touch]">
          <span className="text-[#c8ffc8]/60 shrink-0">&gt;</span>
          <div className="relative flex-1 min-w-0 min-h-[1.2em]">
            <span
              ref={measureRef}
              className={`invisible absolute left-0 top-0 whitespace-pre pointer-events-none select-none ${INPUT_TEXT_CLASS}`}
              aria-hidden
            />
            <input
              ref={inputRef}
              type="text"
              value={input}
              disabled={pendingReply}
              onChange={(e) => {
                setInput(e.target.value);
                requestAnimationFrame(() => syncCaret());
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={syncCaret}
              onClick={syncCaret}
              onSelect={syncCaret}
              enterKeyHint="send"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              aria-label="Command input"
              className={`relative z-10 m-0 w-full bg-transparent p-0 border-none outline-none caret-transparent ${INPUT_TEXT_CLASS}`}
            />
            <span
              className="pointer-events-none absolute z-20 top-[0.12em] w-[6px] h-[0.9em] bg-white"
              style={{
                left: caretPx,
                opacity: blink && !pendingReply ? 1 : 0,
                transition: "opacity 0.05s",
              }}
              aria-hidden
            />
          </div>
        </div>

        <RuleLine className="pb-1" />
      </div>
    </div>
  );
}

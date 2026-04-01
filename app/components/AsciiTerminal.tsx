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
  | { type: "response"; lines: string[] };

type AiTurn = { role: "user" | "assistant"; content: string };

const W = 48;
const rule = "#" + "=".repeat(W) + "#";

/** User typing only — rest of terminal uses mint green palette */
const INPUT_TEXT_CLASS =
  "font-mono text-xs leading-tight text-white";
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

function splitReplyLines(text: string): string[] {
  return text.split(/\r?\n/).filter((l, i, a) => l.length > 0 || i < a.length - 1);
}

export default function AsciiTerminal() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [aiTurns, setAiTurns] = useState<AiTurn[]>([]);
  const [groqPending, setGroqPending] = useState(false);
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
  }, [history, groqPending]);

  const focusInput = () => inputRef.current?.focus();

  const submitGroq = async (raw: string) => {
    setGroqPending(true);
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
          { type: "response", lines: ["> [ GROQ ] Error", `  ${msg}`] },
        ]);
        return;
      }
      const reply = data.reply || "";
      const linesRaw = splitReplyLines(reply);
      const lines = linesRaw.length > 0 ? linesRaw : ["(empty response)"];
      setHistory((prev) => [
        ...prev,
        { type: "response", lines: ["> [ GROQ ]", ...lines.map((l) => `  ${l}`)] },
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
        { type: "response", lines: ["> [ GROQ ] Error", `  ${msg}`] },
      ]);
    } finally {
      setGroqPending(false);
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

    const local = localCommandLines(raw);
    setHistory((prev) => [...prev, { type: "command", text: raw }]);
    setInput("");

    if (local) {
      setHistory((prev) => [...prev, { type: "response", lines: local }]);
      return;
    }

    void submitGroq(raw);
  };

  return (
    <div
      className={`min-h-screen w-full bg-black font-mono ${T} flex flex-col items-center justify-end px-3 pb-6 pt-2 cursor-text select-none`}
      onClick={focusInput}
    >
      <div className="w-full max-w-xl flex flex-col border border-[#c8ffc8]/30">
        <div className="flex items-center justify-between gap-2 px-2 py-0.5 border-b border-[#c8ffc8]/30 bg-[#c8ffc8]/5 text-[10px] text-[#c8ffc8]/60 tracking-widest uppercase">
          <span className="truncate">JEFFREY-WONG.DEV — PORTFOLIO v1.0</span>
          <span className="shrink-0 normal-case tracking-normal text-[#c8ffc8]/40">
            [TTY0]
          </span>
        </div>

        <div className="px-2 text-[10px] text-[#c8ffc8]/40 leading-none py-1">
          {rule}
        </div>

        <div className="px-2 pb-1 text-xs leading-snug text-[#c8ffc8]/80 space-y-0.5">
          <p>
            <span className="text-[#c8ffc8]/40">[ SYS ] </span>
            system initiated. welcome to jeffrey wong&apos;s portfolio
          </p>
          <p>
            <span className="text-[#c8ffc8]/40">[ SYS ] </span>
            type &apos;help&apos; for commands; other input goes to groq.
          </p>
        </div>

        {history.length > 0 && (
          <div className="px-2 py-1 max-h-[120px] overflow-y-auto space-y-0.5 text-xs leading-snug border-t border-[#c8ffc8]/15">
            {history.map((entry, i) =>
              entry.type === "command" ? (
                <p key={i} className={`${T} pt-1 first:pt-0`}>
                  <span className="text-[#c8ffc8]/50">&gt; </span>
                  {entry.text}
                </p>
              ) : (
                entry.lines.map((line, j) => (
                  <p key={`${i}-${j}`} className="text-[#c8ffc8]/80 pl-1">
                    {line}
                  </p>
                ))
              )
            )}
            {groqPending && (
              <p className="text-[#c8ffc8]/55 pl-1">[ GROQ ] …</p>
            )}
            <div ref={consoleEndRef} />
          </div>
        )}
        {history.length === 0 && (
          <div ref={consoleEndRef} className="hidden" aria-hidden />
        )}

        <div className="px-2 text-[10px] text-[#c8ffc8]/40 leading-none py-0.5">
          {rule}
        </div>

        <div className="px-2 py-1 flex flex-nowrap items-baseline gap-x-1.5 text-xs w-full min-w-0 overflow-x-auto">
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
              disabled={groqPending}
              onChange={(e) => {
                setInput(e.target.value);
                requestAnimationFrame(() => syncCaret());
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={syncCaret}
              onClick={syncCaret}
              onSelect={syncCaret}
              autoFocus
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
                opacity: blink && !groqPending ? 1 : 0,
                transition: "opacity 0.05s",
              }}
              aria-hidden
            />
          </div>
        </div>

        <div className="px-2 text-[10px] text-[#c8ffc8]/40 leading-none pb-1">
          {rule}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";

type HistoryEntry =
  | { type: "command"; text: string }
  | { type: "response"; lines: string[] };

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

function resolveCommand(raw: string): string[] {
  const cmd = raw.trim().toLowerCase();
  if (cmd === "help") return HELP_RESPONSE;
  if (cmd === "clear") return [];
  if (PROJECT_RESPONSES[cmd]) return PROJECT_RESPONSES[cmd];
  return [
    `> ERROR: Command "${raw.trim()}" not recognized.`,
    "  Type 'help' to view available modules.",
  ];
}

export default function AsciiTerminal() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [blink, setBlink] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Blinking cursor
  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 530);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll console to bottom
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Click anywhere on terminal → focus input
  const focusInput = () => inputRef.current?.focus();

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const raw = input.trim();
    if (!raw) return;

    if (raw.toLowerCase() === "clear") {
      setHistory([]);
      setInput("");
      return;
    }

    const responseLines = resolveCommand(raw);
    setHistory((prev) => [
      ...prev,
      { type: "command", text: raw },
      { type: "response", lines: responseLines },
    ]);
    setInput("");
  };

  return (
    <div
      className="min-h-screen w-full bg-black font-mono text-[#c8ffc8] flex flex-col items-center justify-end px-4 pb-8 pt-4 cursor-text select-none"
      onClick={focusInput}
    >
      {/* ── Scanline overlay ── */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
        }}
      />

      {/* ── Outer terminal frame ── */}
      <div className="w-full max-w-2xl flex flex-col gap-0 border border-[#c8ffc8]/30">
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-1 border-b border-[#c8ffc8]/30 bg-[#c8ffc8]/5">
          <span className="text-[10px] tracking-widest text-[#c8ffc8]/60 uppercase">
            JEFFREY-WONG.DEV — PORTFOLIO v1.0
          </span>
          <span className="text-[10px] text-[#c8ffc8]/40">
            [TTY0] [CONNECTED]
          </span>
        </div>

        {/* ── Divider ── */}
        <div className="px-4 text-[#c8ffc8]/40 text-xs">
          {"#" + "=".repeat(56) + "#"}
        </div>

        {/* ── Boot lines ── */}
        <div className="px-4 pt-3 pb-2 text-[11px] sm:text-xs space-y-1 text-[#c8ffc8]/80">
          <p>
            <span className="text-[#c8ffc8]/40">[ SYS ] </span>
            system initiated. welcome to jeffrey wong&apos;s portfolio
          </p>
          <p>
            <span className="text-[#c8ffc8]/40">[ SYS ] </span>
            Type{" "}
            <span className="text-[#c8ffc8] brightness-150">&apos;help&apos;</span> to
            view available modules.
          </p>
        </div>

        {/* ── Output console (only when there is history — no dead vertical gap) ── */}
        {history.length > 0 && (
          <div className="px-4 pb-2 max-h-[260px] overflow-y-auto space-y-1 text-[11px] sm:text-xs border-t border-[#c8ffc8]/15">
            {history.map((entry, i) =>
              entry.type === "command" ? (
                <p key={i} className="text-[#c8ffc8] pt-2 first:pt-1">
                  <span className="text-[#c8ffc8]/50">&gt; </span>
                  {entry.text}
                </p>
              ) : (
                entry.lines.map((line, j) => (
                  <p key={`${i}-${j}`} className="text-[#c8ffc8]/80 pl-2">
                    {line}
                  </p>
                ))
              )
            )}
            <div ref={consoleEndRef} />
          </div>
        )}
        {history.length === 0 && <div ref={consoleEndRef} className="hidden" aria-hidden />}

        {/* ── Input divider ── */}
        <div className="px-4 text-[#c8ffc8]/40 text-xs">
          {"#" + "=".repeat(56) + "#"}
        </div>

        {/* ── Interactive input box (framed so the typing lane is obvious) ── */}
        <div className="px-4 py-2 pb-3">
          <p className="text-[10px] text-[#c8ffc8]/35 tracking-widest uppercase mb-1.5">
            [ input — type below, press enter ]
          </p>
          <div className="rounded-sm border border-[#c8ffc8]/25 bg-[#c8ffc8]/[0.06] px-2 py-2 ring-1 ring-inset ring-[#c8ffc8]/10">
            <div className="w-full min-w-0 overflow-x-auto">
              <div className="flex flex-nowrap items-center gap-x-2 text-[11px] sm:text-xs">
              <span className="text-[#c8ffc8]/70 shrink-0">
                &gt; ASK JEFFREY A QUESTION:
              </span>
              <div className="inline-flex shrink-0 items-center border-b border-dotted border-[#c8ffc8]/35 pb-px">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  aria-label="Command input"
                  className="bg-transparent border-none outline-none text-[#c8ffc8] caret-transparent min-w-0 shrink-0 select-text font-mono text-[11px] sm:text-xs"
                  style={{
                    textShadow: "0 0 6px rgba(200,255,200,0.5)",
                    width: `min(${Math.max(input.length + 1, 4)}ch, 100%)`,
                  }}
                />
                <span
                  className="shrink-0 inline-block w-[7px] h-[13px] bg-[#c8ffc8] ml-[1px]"
                  style={{
                    opacity: blink ? 1 : 0,
                    boxShadow: "0 0 6px rgba(200,255,200,0.8)",
                    transition: "opacity 0.05s",
                  }}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom border ── */}
        <div className="px-4 pb-3 text-[#c8ffc8]/40 text-xs">
          {"#" + "=".repeat(56) + "#"}
        </div>
      </div>

      {/* ── Footer hint ── */}
      <p className="mt-2 text-[10px] text-[#c8ffc8]/25 tracking-widest uppercase">
        [↑] scroll console &nbsp;·&nbsp; [enter] submit &nbsp;·&nbsp; clear to
        reset
      </p>
    </div>
  );
}

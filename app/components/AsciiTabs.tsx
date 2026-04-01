"use client";

/** Fits "EXPERIENCE" (10) + padding on small phones */
const FIELD_W = 12;

const TABS = [
  { id: "about", label: "About me" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

function padCenter(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  const pad = width - s.length;
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + s + " ".repeat(pad - left);
}

function AsciiTabBox({ label, active }: { label: string; active: boolean }) {
  const text = label.toUpperCase();
  const row = padCenter(text, FIELD_W);
  const top = "┌" + "─".repeat(FIELD_W) + "┐";
  const mid = "│" + row + "│";
  const bot = "└" + "─".repeat(FIELD_W) + "┘";

  return (
    <pre
      className={`text-[8px] sm:text-[10px] leading-[1.15] whitespace-pre font-mono m-0 ${
        active ? "text-[#c8ffc8]" : "text-[#c8ffc8]/50"
      }`}
    >
      {`${top}\n${mid}\n${bot}`}
    </pre>
  );
}

interface Props {
  active: TabId;
  onTabChange: (id: TabId) => void;
}

export default function AsciiTabs({ active, onTabChange }: Props) {
  return (
    <nav
      className="w-full max-w-full shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1 sm:pb-2 px-0"
      aria-label="Portfolio sections"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Mobile: horizontal swipe row; sm+: centered wrap */}
      <div className="w-full overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:thin] [-webkit-overflow-scrolling:touch] sm:overflow-x-visible">
        <div className="flex flex-nowrap sm:flex-wrap justify-start sm:justify-center gap-3 sm:gap-x-5 sm:gap-y-4 min-w-0 pl-3 pr-8 sm:px-4 sm:pr-4 max-w-6xl sm:mx-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center bg-transparent border-none py-2 px-2 sm:min-h-0 sm:min-w-0 sm:p-0 cursor-pointer touch-manipulation active:opacity-80 hover:text-[#c8ffc8] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#c8ffc8]/50 focus-visible:outline-offset-2 rounded-sm"
              aria-current={active === tab.id ? "page" : undefined}
            >
              <AsciiTabBox label={tab.label} active={active === tab.id} />
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

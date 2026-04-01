"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import AsciiTabs, { type TabId } from "./components/AsciiTabs";
import AsciiTerminal from "./components/AsciiTerminal";

// No SSR — Three.js requires browser APIs
const AsciiBasketball = dynamic(
  () => import("./components/AsciiBasketball"),
  { ssr: false }
);

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("about");

  return (
    <div className="min-h-[100dvh] min-h-screen bg-black flex flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <AsciiTabs active={activeTab} onTabChange={setActiveTab} />

      {/* Tab content — only "about" shows basketball */}
      {activeTab === "about" && (
        <div className="shrink-0">
          <AsciiBasketball />
        </div>
      )}

      {/* Terminal always visible at bottom */}
      <div className="flex-1 flex flex-col justify-end min-h-0">
        <AsciiTerminal />
      </div>
    </div>
  );
}

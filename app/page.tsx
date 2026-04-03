"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import AsciiTabs, { type TabId } from "./components/AsciiTabs";
import AsciiTerminal from "./components/AsciiTerminal";

// No SSR — both use Three.js which requires browser APIs
const AsciiBasketball = dynamic(
  () => import("./components/AsciiBasketball"),
  { ssr: false }
);
const LoadingScreen = dynamic(
  () => import("./components/LoadingScreen"),
  { ssr: false }
);

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("about");
  const [loading, setLoading] = useState(true);

  return (
    <>
      {/* Portfolio always rendered underneath so it's ready when loading screen fades */}
      <div className="min-h-[100dvh] min-h-screen bg-black flex flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <AsciiTabs active={activeTab} onTabChange={setActiveTab} />

        {/* Fills space between tabs and terminal; basketball centered in viewport */}
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === "about" ? (
            <div className="flex-1 flex items-center justify-center min-h-0 px-2 py-4">
              <AsciiBasketball />
            </div>
          ) : (
            <div className="flex-1 min-h-0" aria-hidden />
          )}
        </div>

        <div className="shrink-0 w-full">
          <AsciiTerminal />
        </div>
      </div>

      {/* Loading overlay — sits on top until animation completes */}
      {loading && <LoadingScreen onDone={() => setLoading(false)} />}
    </>
  );
}

"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type DescriptionLanguage = "en" | "nl";

const STORAGE_KEY = "whiskey-stack:description-language";

interface LanguageContextValue {
  language: DescriptionLanguage;
  setLanguage: (lang: DescriptionLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Wraps the authenticated app (see app/(app)/layout.tsx) so the nav's language
 * toggle and any bottle card can share one preference. Deliberately scoped to
 * ONE thing: which language a bottle's `descriptionEn`/`descriptionNl`
 * tooltip shows (see BottleCard). The rest of the UI has no Dutch copy and
 * stays English regardless of this setting.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<DescriptionLanguage>("en");

  // Read the saved preference client-side only, after mount. The server (and
  // first client render) always assumes "en", so this can't cause a hydration
  // mismatch. localStorage can throw in private/locked-down browsing modes;
  // fall back to the default rather than breaking the page.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "nl") setLanguageState(saved);
    } catch {
      // ignore, stay on the default
    }
  }, []);

  function setLanguage(lang: DescriptionLanguage) {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore, preference just won't persist this session
    }
  }

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

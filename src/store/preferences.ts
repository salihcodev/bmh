import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { detectLanguage, i18n, type Language } from '@/localization';
import { applyLayoutDirection } from '@/localization/direction';
import { zustandMMKVStorage } from '@/services/storage/mmkv';

export type ThemePreference = 'system' | 'light' | 'dark';

// Device-level preferences only. Anything tied to an account (last workspace,
// drafts, read markers) lives under the uid-scoped keys in services/storage/user-scope.
type PreferencesState = {
  theme: ThemePreference;
  language: Language | null;
  /** False until the stored language is applied (and no direction reload is pending). */
  bootstrapped: boolean;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  finishBootstrap: (language: Language, ready: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: null,
      bootstrapped: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => {
        set({ language });
        void i18n.changeLanguage(language);
        applyLayoutDirection(language);
      },
      finishBootstrap: (language, ready) => set({ language, bootstrapped: ready }),
    }),
    {
      name: 'preferences.v1',
      version: 2,
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: ({ theme, language }) => ({ theme, language }),
      // v1 stored a device-wide lastWorkspaceId that leaked between accounts: drop it.
      migrate: (persisted) => {
        const { theme, language } = (persisted ?? {}) as { theme?: ThemePreference; language?: Language | null };
        return { theme: theme ?? 'system', language: language ?? null } as PreferencesState;
      },
      // MMKV is synchronous, so this runs during create(); use the state's own action.
      onRehydrateStorage: () => (state) => {
        const language = state?.language ?? detectLanguage();
        void i18n.changeLanguage(language);
        const reloading = applyLayoutDirection(language);
        state?.finishBootstrap(language, !reloading);
      },
    },
  ),
);

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { detectLanguage, i18n, type Language } from '@/localization';
import { applyLayoutDirection } from '@/localization/direction';
import { zustandMMKVStorage } from '@/services/storage/mmkv';

export type ThemePreference = 'system' | 'light' | 'dark';

type PreferencesState = {
  theme: ThemePreference;
  language: Language | null;
  lastWorkspaceId: string | null;
  /** False until the stored language is applied (and no direction reload is pending). */
  bootstrapped: boolean;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  setLastWorkspaceId: (workspaceId: string | null) => void;
  finishBootstrap: (language: Language, ready: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: null,
      lastWorkspaceId: null,
      bootstrapped: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => {
        set({ language });
        void i18n.changeLanguage(language);
        applyLayoutDirection(language);
      },
      setLastWorkspaceId: (lastWorkspaceId) => set({ lastWorkspaceId }),
      finishBootstrap: (language, ready) => set({ language, bootstrapped: ready }),
    }),
    {
      name: 'preferences.v1',
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: ({ theme, language, lastWorkspaceId }) => ({ theme, language, lastWorkspaceId }),
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

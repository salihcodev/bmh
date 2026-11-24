import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { RowDensity } from '@/domain/audit-log';
import { detectLanguage, i18n, type Language } from '@/localization';
import { applyLayoutDirection } from '@/localization/direction';
import { zustandMMKVStorage } from '@/services/storage/mmkv';

export type ThemePreference = 'system' | 'light' | 'dark';
export type StoreLayout = 'cards' | 'list';

// Device-level preferences only. Anything tied to an account (last workspace,
// drafts, read markers) lives under the uid-scoped keys in services/storage/user-scope.
type PreferencesState = {
  theme: ThemePreference;
  language: Language | null;
  /** Admin log rows: one line each, or with target, change and device (LOG-02). */
  auditDensity: RowDensity;
  /** Store item layout preference. */
  storeLayout: StoreLayout;
  /** False until the stored language is applied (and no direction reload is pending). */
  bootstrapped: boolean;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  setAuditDensity: (density: RowDensity) => void;
  setStoreLayout: (layout: StoreLayout) => void;
  finishBootstrap: (language: Language, ready: boolean) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: null,
      auditDensity: 'compact',
      storeLayout: 'cards',
      bootstrapped: false,
      setTheme: (theme) => set({ theme }),
      setAuditDensity: (auditDensity) => set({ auditDensity }),
      setStoreLayout: (storeLayout) => set({ storeLayout }),
      setLanguage: (language) => {
        set({ language });
        void i18n.changeLanguage(language);
        applyLayoutDirection(language);
      },
      finishBootstrap: (language, ready) => set({ language, bootstrapped: ready }),
    }),
    {
      name: 'preferences.v1',
      version: 3,
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: ({ theme, language, auditDensity, storeLayout }) => ({ theme, language, auditDensity, storeLayout }),
      // v1 stored a device-wide lastWorkspaceId that leaked between accounts: drop it.
      migrate: (persisted) => {
        const { theme, language, auditDensity } = (persisted ?? {}) as {
          theme?: ThemePreference;
          language?: Language | null;
          auditDensity?: RowDensity;
        };
        const { storeLayout } = (persisted ?? {}) as { storeLayout?: StoreLayout };
        return {
          theme: theme ?? 'system',
          language: language ?? null,
          auditDensity: auditDensity === 'detailed' ? 'detailed' : 'compact',
          storeLayout: storeLayout === 'list' ? 'list' : 'cards',
        } as PreferencesState;
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

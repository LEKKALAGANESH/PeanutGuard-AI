import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPreferences } from '@/types';

interface UserState extends UserPreferences {
  setLanguage: (language: string) => void;
  setRegion: (region: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      language: 'en',
      region: 'IN',
      theme: 'system',

      setLanguage: (language) => set({ language }),
      setRegion: (region) => set({ region }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'peanutguard-user-preferences',
    },
  ),
);

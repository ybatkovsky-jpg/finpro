import { create } from 'zustand'

export type View = 'dashboard' | 'transactions' | 'projects' | 'reports' | 'import' | 'categories' | 'counterparties' | 'sync' | 'budgets' | 'cashflow' | 'notifications' | 'audit' | 'users'

interface AppState {
  currentView: View
  sidebarOpen: boolean
  setView: (view: View) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  sidebarOpen: false,
  setView: (view) => set({ currentView: view, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))

import type { AppConfig, Category } from '../../main/core/ConfigManager';

export interface ElectronAPI {
  getConfig: () => Promise<any>;
  getCategory: (categoryId: string) => Promise<Category>;
  getSettings: () => Promise<any>;
  updateSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  launchApp: (appConfig: AppConfig) => Promise<boolean>;
  stopApp: (appName: string) => Promise<{ success: boolean }>;
  addApp: (newApp: AppConfig) => Promise<boolean>;
  updateApp: (updatedApp: AppConfig) => Promise<boolean>;
  deleteApp: (categoryId: string, appId: string) => Promise<boolean>;
  selectDirectory: () => Promise<{ filePath: string } | null>;
  selectIcon: () => Promise<{ filePath: string } | null>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  addCategory: (category: Category) => Promise<boolean>;
  updateCategory: (category: Category) => Promise<boolean>;
  deleteCategory: (categoryId: string) => Promise<boolean>;
  clearCache: () => Promise<{ success: boolean; error?: string }>;
  getCacheSize: () => Promise<{ size: number }>;
  on: (channel: string, callback: Function) => void;
  removeListener: (channel: string, callback: Function) => void;
  getExeIcon: (path: string) => Promise<string | null>;
  downloadApp: (url: string, appName: string, category: string) => Promise<boolean>;
  checkAppDownloaded: (appPath: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export { }; 
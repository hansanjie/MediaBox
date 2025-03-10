import { contextBridge, ipcRenderer, shell } from 'electron';
import type { AppConfig, Category } from '../main/core/ConfigManager';
import type { ElectronAPI } from '../renderer/types/shims-electron';

// 定义允许的IPC通道
const validChannels = [
  'get-config',
  'get-category',
  'launch-app',
  'stop-app',
  'get-settings',
  'update-settings',
  'config-updated',
  'select-directory',
  'select-icon',
  'minimize-window',
  'maximize-window',
  'close-window',
  'addApp',
  'updateApp',
  'deleteApp',
  'addCategory',
  'updateCategory',
  'deleteCategory',
  'clear-cache',
  'get-cache-size',
  'get-exe-icon',
  'download-app',
  'check-app-downloaded',
  'download-progress'
];

// 暴露给渲染进程的API
const api: ElectronAPI = {
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  getCategory: (categoryId: string) => ipcRenderer.invoke('get-category', categoryId),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),
  
  // 应用管理
  launchApp: (appConfig: AppConfig) => ipcRenderer.invoke('launch-app', appConfig),
  stopApp: (appName: string) => ipcRenderer.invoke('stop-app', appName),
  addApp: (newApp: AppConfig) => ipcRenderer.invoke('addApp', newApp),
  updateApp: (updatedApp: AppConfig) => ipcRenderer.invoke('updateApp', updatedApp),
  deleteApp: (categoryId: string, appId: string) => ipcRenderer.invoke('deleteApp', categoryId, appId),
  
  // 分类管理
  addCategory: (category: Category) => ipcRenderer.invoke('addCategory', category),
  updateCategory: (category: Category) => ipcRenderer.invoke('updateCategory', category),
  deleteCategory: (categoryId: string) => ipcRenderer.invoke('deleteCategory', categoryId),
  
  // 文件选择
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectIcon: () => ipcRenderer.invoke('select-icon'),
  
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // 事件监听器
  on: (channel: string, callback: Function) => {
    if (validChannels.includes(channel)) {
      const subscription = (_event: any, data: any) => {
        if (data && typeof data === 'object') {
          callback(data);
        }
      };
      ipcRenderer.on(channel, subscription);
      return subscription;
    }
  },

  removeListener: (channel: string, callback: any) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },

  // 特殊方法
  openExternal: async (url: string) => await shell.openExternal(url),

  // 缓存管理
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  getCacheSize: () => ipcRenderer.invoke('get-cache-size'),

  // 新添加的 API
  getExeIcon: (path: string) => ipcRenderer.invoke('get-exe-icon', path),
  
  // 下载管理
  downloadApp: (url: string, appName: string, category: string) => 
    ipcRenderer.invoke('download-app', url, appName, category),
  checkAppDownloaded: (appPath: string) => 
    ipcRenderer.invoke('check-app-downloaded', appPath),

  // 添加查找最匹配的 exe 文件的方法
  findClosestExe: (directory: string, appName: string) => {
    return ipcRenderer.invoke('find-closest-exe', directory, appName);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api); 
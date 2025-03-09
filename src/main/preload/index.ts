import { contextBridge, ipcRenderer } from 'electron';

// 定义暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 应该保留现有的API方法
  // ...

  // 添加新的下载应用相关方法
  downloadApp: (url: string, appName: string, category: string) => {
    return ipcRenderer.invoke('download-app', url, appName, category);
  },
  
  checkAppDownloaded: (appPath: string) => {
    return ipcRenderer.invoke('check-app-downloaded', appPath);
  }
}); 
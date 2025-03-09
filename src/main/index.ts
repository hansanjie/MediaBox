// ... 其他导入
import { ipcMain } from 'electron';
import { extractExeIcon } from './core/icon-extractor';

// ... 其他代码

// 在 createWindow 函数中或适当的位置添加
ipcMain.handle('getExeIcon', async (_, exePath: string) => {
  try {
    return await extractExeIcon(exePath);
  } catch (error) {
    console.error('Error getting exe icon:', error);
    return null;
  }
});

// ... 其他代码
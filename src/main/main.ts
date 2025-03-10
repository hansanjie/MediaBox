import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem, nativeImage } from 'electron';
import { join } from 'path';
import path from 'path';
import { watch } from 'chokidar';
import Store from 'electron-store';
import { initialize, enable } from '@electron/remote/main';
import { configManager } from './core/ConfigManager';
import { appManager } from './core/AppManager';
import { initializeApp } from './core/init';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { shell } from 'electron';
import extract from 'extract-zip';
import { pipeline } from 'stream';
import { promisify as utilPromisify } from 'util';
import fetch from 'node-fetch';

const streamPipeline = utilPromisify(pipeline);

// 初始化@electron/remote
initialize();

// 配置存储
const store = new Store({
  name: 'settings',
  defaults: {
    theme: 'light',
    language: 'zh-CN',
    autoScan: true,
    scanInterval: 5000,
    appsDirectory: app.getPath('userData')
  }
});

let mainWindow: BrowserWindow | null = null;

// 初始化应用
const appPaths = initializeApp();

const execAsync = promisify(exec);

// 添加查找启动文件的函数
async function findExecutableFile(folderPath: string): Promise<string | null> {
  try {
    // 定义可执行文件的优先级列表
    const executablePriority = [
      'obs64.exe',
      'portable.exe',
      'launcher.exe',
      'start.exe'
    ];

    // 递归遍历文件夹
    async function searchInFolder(dir: string): Promise<string | null> {
      const files = await fs.promises.readdir(dir);
      
      // 首先检查优先级列表中的文件
      for (const priorityFile of executablePriority) {
        const foundFiles = files.filter(file => file.toLowerCase() === priorityFile.toLowerCase());
        if (foundFiles.length > 0) {
          return path.join(dir, foundFiles[0]);
        }
      }

      // 如果没有找到优先级文件，查找其他 .exe 文件
      const exeFiles = files.filter(file => file.toLowerCase().endsWith('.exe'));
      if (exeFiles.length > 0) {
        return path.join(dir, exeFiles[0]);
      }

      // 递归搜索子文件夹
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.promises.stat(filePath);
        if (stats.isDirectory()) {
          const result = await searchInFolder(filePath);
          if (result) return result;
        }
      }

      return null;
    }

    return await searchInFolder(folderPath);
  } catch (error) {
    console.error('查找可执行文件失败:', error);
    return null;
  }
}

// 在 findExecutableFile 函数后添加
function getWorkingDirectory(executablePath: string): string {
  // 如果是 OBS，返回其根目录
  if (executablePath.toLowerCase().includes('obs64.exe')) {
    return path.dirname(path.dirname(executablePath)); // 上两级目录，因为 obs64.exe 在 bin/64bit 下
  }
  // 其他程序返回其所在目录
  return path.dirname(executablePath);
}

// 注册 IPC 处理器
function registerIpcHandlers() {
  ipcMain.handle('get-settings', () => {
    try {
      // 直接返回整个 store 的内容
      return store.store;
    } catch (error) {
      console.error('Failed to get settings:', error);
      // 返回默认设置
      return {
        theme: 'light',
        language: 'zh-CN',
        autoScan: true,
        scanInterval: 5000,
        appsDirectory: app.getPath('userData')
      };
    }
  });

  ipcMain.handle('update-settings', (_, settings: any) => {
    try {
      // 直接更新整个 store
      store.store = settings;
      return { success: true };
    } catch (error) {
      console.error('Failed to update settings:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('get-config', () => {
    return configManager.getConfig();
  });

  ipcMain.handle('get-category', (_, categoryId: string) => {
    return configManager.getCategory(categoryId);
  });

  ipcMain.handle('launch-app', async (event, appConfig) => {
    try {
      console.log('启动应用:', appConfig.path, '工作目录:', appConfig.workingDirectory);
      
      // 使用 AppManager 启动应用
      await appManager.launchApp(appConfig);
      return true;
    } catch (error) {
      console.error('启动应用失败:', error);
      throw error;
    }
  });

  ipcMain.handle('stop-app', (_, appName: string) => {
    appManager.stopApp(appName);
    return { success: true };
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: '选择软件',
      buttonLabel: '选择此文件',
      filters: [
        { name: '可执行文件', extensions: ['exe', 'bat', 'cmd'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return { filePath: result.filePaths[0] };
    }
    return null;
  });

  ipcMain.handle('select-icon', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: '选择图标',
      buttonLabel: '选择此文件',
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'ico'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return { filePath: result.filePaths[0] };
    }
    return null;
  });

  // 窗口控制
  ipcMain.handle('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('close-window', () => {
    mainWindow?.close();
  });

  ipcMain.handle('addApp', async (_, newApp: any) => {
    try {
      configManager.addApp(newApp);
      return true;
    } catch (error) {
      console.error('添加应用失败:', error);
      throw error;
    }
  });

  ipcMain.handle('updateApp', async (_, updatedApp: any) => {
    try {
      configManager.updateApp(updatedApp);
      return true;
    } catch (error) {
      console.error('更新应用失败:', error);
      throw error;
    }
  });

  ipcMain.handle('deleteApp', async (_, categoryId: string, appId: string) => {
    try {
      configManager.deleteApp(categoryId, appId);
      return true;
    } catch (error) {
      console.error('删除应用失败:', error);
      throw error;
    }
  });

  // 分类管理
  ipcMain.handle('addCategory', async (_, category: any) => {
    try {
      configManager.addCategory(category);
      return true;
    } catch (error) {
      console.error('添加分类失败:', error);
      throw error;
    }
  });

  ipcMain.handle('updateCategory', async (_, category: any) => {
    try {
      configManager.updateCategory(category);
      return true;
    } catch (error) {
      console.error('更新分类失败:', error);
      throw error;
    }
  });

  ipcMain.handle('deleteCategory', async (_, categoryId: string) => {
    try {
      configManager.deleteCategory(categoryId);
      return true;
    } catch (error) {
      console.error('删除分类失败:', error);
      throw error;
    }
  });

  // 清理缓存
  ipcMain.handle('clear-cache', async () => {
    try {
      if (mainWindow) {
        // 清理所有类型的缓存数据
        await mainWindow.webContents.session.clearCache();
        // 清理存储数据
        await mainWindow.webContents.session.clearStorageData({
          storages: [
            'cookies',
            'filesystem',
            'indexdb',
            'localstorage',
            'shadercache',
            'websql',
            'serviceworkers',
            'cachestorage'
          ]
        });
        return { success: true };
      }
      return { success: false, error: '窗口未初始化' };
    } catch (error) {
      console.error('清理缓存失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 获取缓存大小
  ipcMain.handle('get-cache-size', async () => {
    try {
      if (mainWindow) {
        const size = await mainWindow.webContents.session.getCacheSize();
        return { size: size };
      }
      return { size: 0 };
    } catch (error) {
      console.error('获取缓存大小失败:', error);
      return { size: 0 };
    }
  });

  // 修改获取 exe 图标的 IPC 处理程序
  ipcMain.handle('get-exe-icon', async (event, filePath: string) => {
    try {
      const { extractExeIcon } = require('./core/icon-extractor');
      return await extractExeIcon(filePath);
    } catch (error) {
      console.error('图标提取失败:', error);
      return null;
    }
  });

  // 检查应用是否已下载
  ipcMain.handle('check-app-downloaded', async (_event, appPath: string) => {
    // 处理相对路径
    if (appPath.startsWith('./')) {
      appPath = path.join(app.getAppPath(), appPath.substring(2));
    }
    
    try {
      const stats = await fs.promises.stat(appPath);
      return stats.isFile();
    } catch (error) {
      return false;
    }
  });

  // 下载应用
  ipcMain.handle('download-app', async (_event, url: string, appName: string, category: string) => {
    try {
      // 1. 获取临时目录和目标目录
      const tempDir = app.getPath('temp');
      const config = await configManager.getConfig();
      const builtinAppsFolder = (config as any).builtinAppsFolder || './apps';
      const appCategoryFolder = path.join(app.getAppPath(), builtinAppsFolder, category);
      const appFolder = path.join(appCategoryFolder, appName.toLowerCase().replace(/\s+/g, '-'));
      
      // 2. 创建临时文件名和目标目录
      const tempFile = path.join(tempDir, `${Date.now()}-${path.basename(url)}`);
      await fs.promises.mkdir(appFolder, { recursive: true });
      
      // 3. 下载文件
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('下载失败: 没有响应内容');
      }

      // 获取文件大小
      const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
      let downloadedSize = 0;

      // 创建可写流
      const fileStream = fs.createWriteStream(tempFile);

      // 处理下载进度
      response.body.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = totalSize ? (downloadedSize / totalSize) * 100 : 0;
        console.log('Sending download progress:', { appName, progress });
        mainWindow?.webContents.send('download-progress', { 
          appName, 
          progress: parseFloat(progress.toFixed(1))
        });
      });
      
      // 4. 保存到临时文件
      await streamPipeline(response.body, fileStream);
      
      // 5. 处理文件
      try {
        console.log('Sending extracting status:', { appName, progress: 100, status: 'processing' });
        mainWindow?.webContents.send('download-progress', { 
          appName, 
          progress: 100, 
          status: 'processing' 
        });

        // 确保目标文件夹存在
        await fs.promises.mkdir(appFolder, { recursive: true });

        // 判断文件类型
        const fileName = path.basename(url).toLowerCase();
        const isExeFile = fileName.endsWith('.exe');
        let executablePath: string | null = null;

        if (isExeFile) {
          // 如果是exe文件，直接复制到目标目录
          const targetExePath = path.join(appFolder, path.basename(url));
          await fs.promises.copyFile(tempFile, targetExePath);
          executablePath = targetExePath;
        } else {
          // 如果是压缩文件，进行解压
          await extract(tempFile, { dir: appFolder });
          // 查找可执行文件
          executablePath = await findExecutableFile(appFolder);
        }

        console.log('处理完成，可执行文件路径:', executablePath);
        
        // 6. 删除临时文件
        await fs.promises.unlink(tempFile);
        
        // 7. 更新应用状态
        const existingApp = configManager.getApp(category, appName);
        if (existingApp) {
          const finalExecutablePath = executablePath || path.join(appFolder, 'portable.exe');
          const workingDirectory = getWorkingDirectory(finalExecutablePath);
          
          const updatedApp = {
            ...existingApp,
            isDownloaded: true,
            path: finalExecutablePath,
            workingDirectory: workingDirectory
          };
          await configManager.updateApp(updatedApp);
          
          // 通知渲染进程配置已更新
          mainWindow?.webContents.send('config-updated', configManager.getConfig());
          
          console.log('Sending completed status:', { 
            appName, 
            progress: 100, 
            status: 'completed',
            path: updatedApp.path,
            workingDirectory: updatedApp.workingDirectory 
          });
          mainWindow?.webContents.send('download-progress', { 
            appName, 
            progress: 100, 
            status: 'completed',
            path: updatedApp.path,
            workingDirectory: updatedApp.workingDirectory
          });
        }

        return true;
      } catch (error) {
        console.error('文件处理失败:', error);
        // 清理临时文件
        if (fs.existsSync(tempFile)) {
          await fs.promises.unlink(tempFile);
        }
        console.log('Sending error status:', { appName, progress: 0, status: 'error' });
        mainWindow?.webContents.send('download-progress', { 
          appName, 
          progress: 0, 
          status: 'error' 
        });
        throw error;
      }
    } catch (error) {
      console.error('下载应用失败:', error);
      console.log('Sending error status:', { appName, progress: 0, status: 'error' });
      mainWindow?.webContents.send('download-progress', { 
        appName, 
        progress: 0, 
        status: 'error' 
      });
      return false;
    }
  });

  // 添加查找最匹配的 exe 文件的处理程序
  ipcMain.handle('find-closest-exe', async (_event, directory: string, appName: string) => {
    try {
      return await appManager.findClosestExe(directory, appName);
    } catch (error) {
      console.error('查找最匹配的 exe 文件失败:', error);
      throw error;
    }
  });
}

app.whenReady().then(() => {
  // 先注册所有IPC 处理器
  registerIpcHandlers();
  
  // 延迟创建窗口，确保所有IPC 处理器都已注册
  setTimeout(() => {
    createWindow();
  }, 100);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 配置变更通知
configManager.on('config-changed', (newConfig) => {
  mainWindow?.webContents.send('config-updated', newConfig);
});

// 监听外部应用目录变化
const appsWatcher = watch(appPaths.appsPath, {
  persistent: true,
  ignoreInitial: true
});

appsWatcher
  .on('add', path => updateAppConfig())
  .on('unlink', path => updateAppConfig())
  .on('error', error => console.error('Watcher error:', error));

async function updateAppConfig() {
  // TODO: 实现自动扫描和配置更新逻辑
  console.log('Detected changes in apps directory');
}

// 创建应用菜单
function createAppMenu() {
  const isMac = process.platform === 'darwin';
  const template: any = [
    {
      label: '文件',
      submenu: [
        {
          label: '升级配置文件',
          click: async () => {
            try {
              await updateAppConfig();
              dialog.showMessageBox({
                type: 'info',
                title: '成功',
                message: '配置文件已成功升级'
              });
            } catch (error) {
              dialog.showErrorBox('错误', '升级配置文件失败: ' + error);
            }
          }
        },
        {
          label: '导入配置清单',
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ['openFile'],
              filters: [
                { name: '配置文件', extensions: ['json'] }
              ],
              title: '选择配置文件'
            });

            if (!result.canceled && result.filePaths.length > 0) {
              try {
                const configPath = result.filePaths[0];
                const configData = await fs.promises.readFile(configPath, 'utf-8');
                const newConfig = JSON.parse(configData);
                
                // 更新配置
                await configManager.importConfig(newConfig);
                
                dialog.showMessageBox({
                  type: 'info',
                  title: '成功',
                  message: '配置文件导入成功'
                });
              } catch (error) {
                dialog.showErrorBox('错误', '导入配置文件失败: ' + error);
              }
            }
          }
        },
        {
          label: '导出配置清单',
          click: async () => {
            const result = await dialog.showSaveDialog({
              filters: [
                { name: '配置文件', extensions: ['json'] }
              ],
              title: '导出配置文件'
            });

            if (!result.canceled && result.filePath) {
              try {
                const config = configManager.getConfig();
                await fs.promises.writeFile(result.filePath, JSON.stringify(config, null, 2), 'utf-8');
                
                dialog.showMessageBox({
                  type: 'info',
                  title: '成功',
                  message: '配置文件导出成功'
                });
              } catch (error) {
                dialog.showErrorBox('错误', '导出配置文件失败: ' + error);
              }
            }
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { 
          role: 'togglefullscreen',
          label: '全屏',
          accelerator: 'F11'
        },
        {
          label: '退出全屏',
          accelerator: 'Esc',
          click: () => {
            if (mainWindow?.isFullScreen()) {
              mainWindow.setFullScreen(false);
            }
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: async () => {
            dialog.showMessageBox({
              type: 'info',
              title: '关于',
              message: 'MediaTools\n版本: ' + app.getVersion(),
              detail: '一个用于管理和启动媒体工具的应用程序'
            });
          }
        },
        {
          label: '帮助文档',
          click: async () => {
            await shell.openExternal('https://github.com/yourusername/MediaTools/wiki');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

const createWindow = () => {
  console.log('Creating main window...');
  console.log('User Data Path:', app.getPath('userData'));
  console.log('Current working directory:', process.cwd());
  console.log('App Path:', app.getAppPath());
  console.log('__dirname:', __dirname);
  console.log('Resources Path:', process.resourcesPath);

  // 在创建窗口之前设置菜单为 null
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    transparent: false,
    icon: app.isPackaged 
      ? join(process.resourcesPath, 'build/icon.ico')
      : join(process.cwd(), 'public/images/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: join(__dirname, '../preload/index.js'),
      webSecurity: true, // 恢复 webSecurity
      devTools: !app.isPackaged // 只在开发环境启用开发者工具
    }
  });

  // 启用@electron/remote
  enable(mainWindow.webContents);

  // 创建应用菜单
  createAppMenu();

  // 根据环境设置开发者工具
  if (!app.isPackaged) {
    // 开发环境：添加开发者工具菜单项
    const devToolsMenuItem = {
      label: '开发者工具',
      submenu: [
        {
          label: '打开开发者工具',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Alt+Shift+I',
          click: () => mainWindow?.webContents.openDevTools()
        }
      ]
    };
    const menu = Menu.getApplicationMenu();
    if (menu) {
      menu.append(new MenuItem(devToolsMenuItem));
      Menu.setApplicationMenu(menu);
    }
  } else {
    // 生产环境：禁用开发者工具快捷键
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // 阻止 Ctrl+Shift+I 和 F12
      if ((input.control && input.shift && input.key.toLowerCase() === 'i') ||
          (input.key === 'F12')) {
        event.preventDefault();
      }
    });
  }

  const loadIndexFile = (indexPath: string) => {
    if (!mainWindow) return;
    console.log('Attempting to load file:', indexPath);
    console.log('File exists:', require('fs').existsSync(indexPath));
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
      
      // 尝试多个备用路径
      const backupPaths = [
        join(process.resourcesPath, 'renderer/index.html'),
        join(process.resourcesPath, 'dist/renderer/index.html'),
        join(__dirname, '../renderer/index.html'),
        join(__dirname, '../../dist/renderer/index.html')
      ];

      console.log('Trying backup paths:', backupPaths);
      
      // 依次尝试所有备用路径
      for (const backupPath of backupPaths) {
        console.log('Checking backup path:', backupPath);
        console.log('Backup path exists:', require('fs').existsSync(backupPath));
      }

      // 尝试第一个存在的备用路径
      const existingPath = backupPaths.find(path => require('fs').existsSync(path));
      if (existingPath) {
        console.log('Loading existing backup path:', existingPath);
        mainWindow?.loadFile(existingPath).catch(backupErr => {
          console.error('Failed to load backup path:', backupErr);
        });
      } else {
        console.error('No valid backup paths found');
      }
    });
  };

  // 开发模式下加载 Vite 开发服务器
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('Loading development URL:', process.env.VITE_DEV_SERVER_URL);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch(err => {
      console.error('Failed to load dev server:', err);
      // 如果加载失败，尝试加载本地文件
      if (mainWindow) {
        const indexPath = join(process.cwd(), 'dist/renderer/index.html');
        console.log('Fallback to local file:', indexPath);
        loadIndexFile(indexPath);
      }
    });

    // 在开发模式下打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境下，尝试加载打包后的路径
    const indexPath = join(process.cwd(), 'dist/renderer/index.html');
    loadIndexFile(indexPath);
  }

  // 监听加载错误
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    if (!mainWindow) return;
    console.error('Page failed to load:', {
      errorCode,
      errorDescription,
      currentURL: mainWindow.webContents.getURL()
    });
  });

  // 监听页面加载完成
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading');
  });

  // 监听 DOM 内容加载完成
  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM is ready');
  });
};

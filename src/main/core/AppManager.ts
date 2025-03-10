import { spawn, ChildProcess } from 'child_process';
import { join, dirname, basename } from 'path';
import { app } from 'electron';
import { AppConfig } from './ConfigManager';
import { access, constants } from 'fs/promises';
import { readdirSync, statSync } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './ConfigManager';

// 声明全局 process
declare const process: NodeJS.Process;

class AppManager {
  private runningApps: Map<string, ChildProcess> = new Map();
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  // 计算两个字符串的相似度（使用 Levenshtein 距离）
  private calculateSimilarity(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          );
        }
      }
    }

    // 返回相似度得分（0-1之间，1表示完全匹配）
    return 1 - dp[m][n] / Math.max(m, n);
  }

  // 递归搜索目录下的所有 exe 文件
  private findExeFiles(directory: string): string[] {
    const results: string[] = [];
    
    try {
      const files = fs.readdirSync(directory);
      
      for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // 递归搜索子目录
          results.push(...this.findExeFiles(fullPath));
        } else if (file.toLowerCase().endsWith('.exe')) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`搜索目录失败: ${directory}`, error);
    }
    
    return results;
  }

  // 查找最匹配的 exe 文件
  async findClosestExe(directory: string, appName: string): Promise<string> {
    try {
      console.log(`开始查找启动文件 - 目录: ${directory}, 应用名称: ${appName}`);

      // 如果传入的是文件路径而不是目录，获取其所在目录
      let searchDir = directory;
      if (directory.toLowerCase().endsWith('.exe')) {
        searchDir = path.dirname(directory);
        console.log(`传入的是exe文件路径，将在其所在目录搜索: ${searchDir}`);
      }

      // 检查目录是否存在
      if (!fs.existsSync(searchDir)) {
        throw new Error(`目录不存在: ${searchDir}`);
      }

      // 递归查找所有 exe 文件
      const exeFiles = this.findExeFiles(searchDir);
      console.log(`找到的 exe 文件列表:`, exeFiles);

      if (exeFiles.length === 0) {
        throw new Error(`在目录 ${searchDir} 中未找到任何 exe 文件`);
      }

      // 优先级列表
      const priorityNames = [
        'portable.exe',
        'launcher.exe',
        'start.exe',
        `${appName.toLowerCase()}.exe`
      ];

      // 首先检查是否有完全匹配的文件名
      const normalizedAppName = appName.toLowerCase().trim();
      for (const exePath of exeFiles) {
        const fileName = path.basename(exePath).toLowerCase();
        // 检查是否是优先级文件名
        if (priorityNames.includes(fileName)) {
          console.log(`找到优先级文件: ${exePath}`);
          return exePath;
        }
        // 检查是否完全匹配应用名称（忽略大小写）
        if (fileName === `${normalizedAppName}.exe`) {
          console.log(`找到完全匹配的文件: ${exePath}`);
          return exePath;
        }
      }

      // 如果没有完全匹配，查找包含应用名称的文件
      const containsAppName = exeFiles.find(exePath => 
        path.basename(exePath).toLowerCase().includes(normalizedAppName)
      );
      if (containsAppName) {
        console.log(`找到包含应用名称的文件: ${containsAppName}`);
        return containsAppName;
      }

      // 如果仍然没有找到，返回第一个 exe 文件
      console.log(`未找到匹配的文件，使用第一个exe文件: ${exeFiles[0]}`);
      return exeFiles[0];

    } catch (error: any) {
      const errorMessage = `查找启动文件失败 - 目录: ${directory}, 应用名称: ${appName}, 错误: ${error.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  public async launchApp(appConfig: AppConfig, inputFile?: string): Promise<void> {
    try {
      const appPath = this.resolveAppPath(appConfig.path);
      
      // 检查文件是否存在且可执行
      try {
        await access(appPath, constants.F_OK | constants.X_OK);
      } catch (error) {
        console.error(`无法访问应用程序 ${appPath}:`, error);
        throw new Error(`无法访问应用程序: ${appPath}`);
      }

      const params = this.parseParams(appConfig.params || '', inputFile);
      
      // 设置启动选项
      const options: any = {
        stdio: 'pipe',
        shell: false,
        detached: true
      };
      
      // 设置工作目录
      if (appConfig.workingDirectory) {
        options.cwd = appConfig.workingDirectory;
      }

      let childProcess;
      let cmdLine = '';
      
      if (appPath.toLowerCase().includes('obs64.exe')) {
        // 对于 OBS，使用特殊配置
        const obsExeDir = dirname(appPath); // 获取 64bit 目录
        const obsBaseDir = dirname(dirname(obsExeDir)); // 获取 ffmpeg工具 目录
        const obsDataDir = join(obsBaseDir, 'data', 'obs-studio');
        const obsPluginsDir = join(obsBaseDir, 'obs-plugins', '64bit');
        
        const env = {
          ...process.env,
          OBS_DATA_PATH: obsDataDir,
          OBS_PLUGINS_PATH: obsPluginsDir,
          LANG: 'zh-CN',
          LC_ALL: 'zh-CN'
        };

        // 构建完整的命令行
        cmdLine = `cd "${obsExeDir}" && set OBS_DATA_PATH="${obsDataDir}" && set OBS_PLUGINS_PATH="${obsPluginsDir}" && set LANG=zh-CN && set LC_ALL=zh-CN && "${appPath}"`;
        console.log('完整命令行:', cmdLine);
        
        childProcess = spawn(cmdLine, [], {
          cwd: obsExeDir,
          env,
          detached: true,
          stdio: 'ignore',
          shell: true
        });

        childProcess.unref();
      } else {
        // 对于其他应用，使用引号包裹路径
        const quotedPath = `"${appPath}"`;
        const quotedParams = params.map(param => `"${param}"`).join(' ');
        
        // 构建完整的命令行
        if (appConfig.workingDirectory) {
          cmdLine = `cd "${appConfig.workingDirectory}" && ${quotedPath} ${quotedParams}`;
        } else {
          const appDir = dirname(appPath);
          cmdLine = `cd "${appDir}" && ${quotedPath} ${quotedParams}`;
        }
        console.log('完整命令行:', cmdLine);
        
        childProcess = spawn(cmdLine, [], {
          ...options,
          shell: true
        });
        
        childProcess.stdout?.on('data', (data) => {
          console.log(`[${appConfig.name}] stdout: ${data}`);
        });

        childProcess.stderr?.on('data', (data) => {
          console.error(`[${appConfig.name}] stderr: ${data}`);
        });

        childProcess.on('error', (error) => {
          console.error(`[${appConfig.name}] 进程错误:`, error);
          this.runningApps.delete(appConfig.name);
        });

        childProcess.on('close', (code) => {
          console.log(`[${appConfig.name}] 进程退出，退出码: ${code}`);
          this.runningApps.delete(appConfig.name);
        });
      }

      this.runningApps.set(appConfig.name, childProcess);

    } catch (error) {
      console.error(`启动应用 ${appConfig.name} 失败:`, error);
      throw error;
    }
  }

  private resolveAppPath(path: string): string {
    if (path.startsWith('./')) {
      return join(app.getPath('userData'), path);
    }
    return path;
  }

  private parseParams(paramsTemplate: string, inputFile?: string): string[] {
    if (!paramsTemplate) {
      return [];
    }
    let params = paramsTemplate;
    if (inputFile) {
      params = params.replace('{input}', inputFile);
    }
    return params.split(' ').filter(Boolean);
  }

  public stopApp(appName: string): void {
    const process = this.runningApps.get(appName);
    if (process) {
      process.kill();
      this.runningApps.delete(appName);
    }
  }

  public stopAllApps(): void {
    for (const [appName] of this.runningApps) {
      this.stopApp(appName);
    }
  }
}

// 创建单例实例
const appManager = new AppManager(new ConfigManager());

export { appManager, AppManager }; 
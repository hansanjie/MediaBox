import { spawn, ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { app } from 'electron';
import { AppConfig } from './ConfigManager';
import { access, constants } from 'fs/promises';

// 声明全局 process
declare const process: NodeJS.Process;

class AppManager {
  private runningApps: Map<string, ChildProcess> = new Map();

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

export const appManager = new AppManager(); 
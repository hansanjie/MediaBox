import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'fs';

const defaultConfig = {
  categories: [
    {
      id: "video_edit",
      name: "视频编辑",
      apps: [
        {
          name: "FFmpeg工具",
          path: "./apps/ffmpeg/portable.exe",
          icon: "video",
          params: "-i {input}",
          category: "video_edit",
          description: "强大的视频处理工具"
        }
      ]
    },
    {
      id: "audio_edit",
      name: "音频编辑",
      apps: [
        {
          name: "音频转换器",
          path: "./apps/audio/converter.exe",
          icon: "audio",
          params: "-i {input} -o {output}",
          category: "audio_edit",
          description: "音频格式转换工具"
        }
      ]
    }
  ]
};

export function initializeApp() {
  const userDataPath = app.getPath('userData');
  const configsPath = join(userDataPath, 'configs');
  const appsPath = join(userDataPath, 'apps');
  const configFile = join(configsPath, 'config.json');

  // 创建必要的目录
  [configsPath, appsPath].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  // 如果配置文件不存在，创建默认配置
  if (!existsSync(configFile)) {
    writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  }

  // 创建应用子目录
  ['ffmpeg', 'audio'].forEach(appDir => {
    const dir = join(appsPath, appDir);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  return {
    userDataPath,
    configsPath,
    appsPath,
    configFile
  };
} 
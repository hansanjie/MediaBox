/// <reference types="vite/client" />
import type { ElectronAPI } from './shims-electron';

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.svg?component' {
  import { FunctionalComponent, SVGAttributes } from 'vue';
  const component: FunctionalComponent<SVGAttributes>;
  export default component;
}

interface Window {
  electronAPI: ElectronAPI;
}

interface ExtendedAppConfig extends AppConfig {
  downloadUrl?: string;
  isDownloaded?: boolean;
  path: string;
  iconPath?: string;
  params?: string;
  workingDirectory?: string;
  type: 'builtin' | 'external';
} 
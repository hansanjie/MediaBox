<template>
  <a-card hoverable class="app-card">
    <template #cover>
      <div class="app-icon">
        <img 
          v-if="iconBase64" 
          :src="iconBase64" 
          class="custom-icon" 
          @error="handleIconError"
        />
        <component v-else :is="getAppIcon" class="icon" />
      </div>
    </template>
    
    <a-card-meta :title="app.name">
      <template #description>
        <p>{{ app.description }}</p>
        <p v-if="isBuiltinApp && !isDownloaded" class="download-info">
          <DownloadOutlined /> 需要下载
        </p>
      </template>
    </a-card-meta>

    <div class="action-buttons">
      <div class="main-actions">
        <a-button v-if="isBuiltinApp && !isDownloaded" type="primary" @click="downloadApp" :loading="isDownloading">
          {{ downloadStatus === 'extracting' ? '解压中' : '下载' }}
        </a-button>
        <a-button v-else type="primary" @click="handleLaunch">
          启动
        </a-button>
        <a-button 
          v-if="app.website || app.downloadUrl"
          type="link" 
          @click="openWebsite"
        >
          官网
        </a-button>
      </div>
      <div class="more-actions">
        <a-dropdown :trigger="['click']" @click.stop placement="topLeft">
          <MoreOutlined class="more-icon" />
          <template #overlay>
            <a-menu>
              <a-menu-item key="details" @click="showDrawer">
                <InfoCircleOutlined />
                <span>详情</span>
              </a-menu-item>
              <a-menu-item key="delete" @click="handleDelete">
                <DeleteOutlined />
                <span>删除</span>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>

    <div class="download-progress" :class="{ visible: downloadStatus && downloadStatus !== 'completed' }">
      <a-progress 
        :percent="downloadProgress" 
        :status="downloadStatus === 'error' ? 'exception' : downloadStatus === 'completed' ? 'success' : 'active'"
        :format="(percent: number) => downloadStatus === 'extracting' ? '解压中...' : `${percent.toFixed(1)}%`"
      />
    </div>
  </a-card>

  <a-drawer
    v-model:visible="drawerVisible"
    title="应用详情"
    placement="right"
    width="500"
    :closable="true"
    @after-visible-change="afterVisibleChange"
  >
    <a-form
      :model="formState"
      layout="vertical"
      ref="formRef"
    >
      <a-form-item label="软件名称" name="name" :rules="[{ required: true, message: '请输入软件名称' }]">
        <a-input v-model:value="formState.name" />
      </a-form-item>

      <a-form-item label="软件分类" name="category" :rules="[{ required: true, message: '请选择软件分类' }]">
        <a-input v-model:value="formState.category" disabled />
      </a-form-item>

      <a-form-item label="软件类型" name="type">
        <a-input v-model:value="formState.type" disabled />
      </a-form-item>

      <a-form-item label="软件路径" name="path" :rules="[{ required: true, message: '请选择软件路径' }]">
        <a-input-group compact>
          <a-input
            v-model:value="formState.path"
            style="width: calc(100% - 50px)"
            :readonly="isBuiltinApp"
          />
          <a-button type="primary" @click="selectFile" :disabled="isBuiltinApp">
            <FileOutlined />
          </a-button>
        </a-input-group>
      </a-form-item>

      <a-form-item label="工作目录" name="workingDirectory">
        <a-input-group compact>
          <a-input
            v-model:value="formState.workingDirectory"
            style="width: calc(100% - 50px)"
            placeholder="不设置则使用软件所在目录"
            :readonly="isBuiltinApp"
          />
          <a-button type="primary" @click="selectWorkingDirectory" :disabled="isBuiltinApp">
            <FolderOutlined />
          </a-button>
        </a-input-group>
      </a-form-item>

      <a-form-item label="启动参数" name="params">
        <a-input v-model:value="formState.params" placeholder="请输入启动参数，例如: -i {input}" />
      </a-form-item>

      <a-form-item label="软件描述" name="description" :rules="[{ required: true, message: '请输入软件描述' }]">
        <a-textarea v-model:value="formState.description" :rows="3" />
      </a-form-item>

      <a-form-item label="官网地址" name="website">
        <a-input v-model:value="formState.website" placeholder="请输入官网地址（可选）" />
      </a-form-item>

      <a-form-item v-if="isBuiltinApp" label="下载地址" name="downloadUrl">
        <a-input v-model:value="formState.downloadUrl" />
      </a-form-item>

      <a-form-item label="软件图标" name="iconPath">
        <a-input-group compact>
          <a-input
            v-model:value="formState.iconPath"
            style="width: calc(100% - 50px)"
            placeholder="可选，不设置则使用默认图标"
            readonly
          />
          <a-button type="primary" @click="selectIcon">
            <FileImageOutlined />
          </a-button>
        </a-input-group>
      </a-form-item>
    </a-form>

    <template #footer>
      <div style="text-align: right">
        <a-space>
          <a-button @click="closeDrawer">取消</a-button>
          <a-button type="primary" @click="handleSave">保存</a-button>
        </a-space>
      </div>
    </template>
  </a-drawer>
</template>

<script lang="ts" setup>
import { computed, ref, reactive, onMounted, watch, onUnmounted } from 'vue';
import VideoCameraOutlined from '@ant-design/icons-vue/lib/icons/VideoCameraOutlined';
import AudioOutlined from '@ant-design/icons-vue/lib/icons/AudioOutlined';
import AppstoreOutlined from '@ant-design/icons-vue/lib/icons/AppstoreOutlined';
import MoreOutlined from '@ant-design/icons-vue/lib/icons/MoreOutlined';
import DeleteOutlined from '@ant-design/icons-vue/lib/icons/DeleteOutlined';
import InfoCircleOutlined from '@ant-design/icons-vue/lib/icons/InfoCircleOutlined';
import FileOutlined from '@ant-design/icons-vue/lib/icons/FileOutlined';
import FileImageOutlined from '@ant-design/icons-vue/lib/icons/FileImageOutlined';
import CloudDownloadOutlined from '@ant-design/icons-vue/lib/icons/CloudDownloadOutlined';
import PlaySquareOutlined from '@ant-design/icons-vue/lib/icons/PlaySquareOutlined';
import FundViewOutlined from '@ant-design/icons-vue/lib/icons/FundViewOutlined';
import PlayCircleOutlined from '@ant-design/icons-vue/lib/icons/PlayCircleOutlined';
import DownloadOutlined from '@ant-design/icons-vue/lib/icons/DownloadOutlined';
import FolderOutlined from '@ant-design/icons-vue/lib/icons/FolderOutlined';
import { message, Progress } from 'ant-design-vue/es';
import { Modal } from 'ant-design-vue/es';
import type { FormInstance } from 'ant-design-vue/es/form';
import type { AppConfig } from '../../main/core/ConfigManager';
import { getIconPath } from '../config/icons';

// 扩展AppConfig类型，只增加downloadUrl和isDownloaded字段
interface ExtendedAppConfig extends AppConfig {
  // 不再重新定义type属性，继承AppConfig中的必需type属性
  downloadUrl?: string;
  isDownloaded?: boolean;
  workingDirectory?: string;
}

declare const window: Window & {
  electronAPI: {
    selectDirectory: () => Promise<{ filePath: string } | null>;
    selectIcon: () => Promise<{ filePath: string } | null>;
    openExternal: (url: string) => Promise<void>;
    getExeIcon: (path: string) => Promise<string>;
    downloadApp: (url: string, appName: string, category: string) => Promise<boolean>;
    checkAppDownloaded: (appPath: string) => Promise<boolean>;
    on: (channel: string, callback: Function) => void;
    removeListener: (channel: string, callback: Function) => void;
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
    findClosestExe: (directory: string, appName: string) => Promise<string>;
  }
};

const props = defineProps<{
  app: ExtendedAppConfig;
}>();

const emit = defineEmits<{
  (e: 'launch', app: ExtendedAppConfig & { workingDirectory?: string }): void;
  (e: 'delete', app: ExtendedAppConfig): void;
  (e: 'update', app: ExtendedAppConfig): void;
  (e: 'download-complete', app: ExtendedAppConfig): void;
}>();

const drawerVisible = ref(false);
const formRef = ref<FormInstance>();
const formState = reactive<ExtendedAppConfig>({
  id: props.app.id,
  name: props.app.name,
  path: props.app.path || '',
  icon: props.app.icon,
  category: props.app.category,
  description: props.app.description,
  type: props.app.type || 'external',
  workingDirectory: props.app.workingDirectory,
  params: props.app.params,
  website: props.app.website,
  downloadUrl: props.app.downloadUrl,
  iconPath: props.app.iconPath,
  isDownloaded: props.app.isDownloaded
});
const iconBase64 = ref<string | null>(null);
const isDownloading = ref(false);
const downloadProgress = ref(0);
const downloadStatus = ref<'downloading' | 'extracting' | 'completed' | 'error' | null>(null);

// 计算属性：判断是否为内置应用
const isBuiltinApp = computed(() => {
  return props.app.type === 'builtin';
});

// 计算属性：判断内置应用是否已下载
const isDownloaded = computed(() => {
  return !isBuiltinApp.value || props.app.isDownloaded;
});

const getAppIcon = computed(() => {
  // 如果有自定义图标但加载失败了，也使用分类默认图标
  switch (props.app.category) {
    case 'video_process':
    case 'video_convert':
      return VideoCameraOutlined;
    case 'audio_process':
    case 'audio_convert':
      return AudioOutlined;
    case 'media_download':
      return CloudDownloadOutlined;
    case 'media_record':
      return PlaySquareOutlined;
    case 'media_stream':
      return FundViewOutlined;
    case 'media_player':
      return PlayCircleOutlined;
    default:
      return AppstoreOutlined;
  }
});

const openWebsite = () => {
  const url = props.app.website || props.app.downloadUrl;
  if (url) {
    window.electronAPI.openExternal(url);
  }
};

// 下载应用
const downloadApp = async () => {
  if (!isBuiltinApp.value || !props.app.downloadUrl) {
    message.error('应用下载地址不存在');
    return;
  }

  try {
    isDownloading.value = true;
    downloadProgress.value = 0;
    downloadStatus.value = 'downloading';
    
    // 调用Electron API下载应用
    const success = await window.electronAPI.downloadApp(
      props.app.downloadUrl,
      props.app.name,
      props.app.category
    );
    
    if (success) {
      message.success('下载成功!');
      // 更新应用状态
      const updatedApp = {
        ...props.app,
        isDownloaded: true
      };
      emit('update', updatedApp);
      emit('download-complete', updatedApp);
      
      // 重置下载状态
      setTimeout(() => {
        downloadStatus.value = null;
        downloadProgress.value = 0;
      }, 1500);
    } else {
      downloadStatus.value = 'error';
      message.error('下载失败，请检查网络或手动下载');
    }
  } catch (error) {
    console.error('下载应用失败:', error);
    downloadStatus.value = 'error';
    message.error('下载过程中发生错误');
  } finally {
    isDownloading.value = false;
  }
};

// 检查应用是否已下载
const checkAppDownloaded = async () => {
  if (isBuiltinApp.value && props.app.path) {
    try {
      const downloaded = await window.electronAPI.checkAppDownloaded(props.app.path);
      // 如果状态与配置不一致，需要更新应用状态
      if (downloaded !== props.app.isDownloaded) {
        const updatedApp = {
          ...props.app,
          isDownloaded: downloaded
        };
        emit('update', updatedApp);
      }
    } catch (error) {
      console.error('检查应用下载状态失败:', error);
    }
  }
};

const showDrawer = (e: Event) => {
  e.stopPropagation();
  Object.assign(formState, props.app);
  drawerVisible.value = true;
};

const closeDrawer = () => {
  drawerVisible.value = false;
  formRef.value?.resetFields();
};

const afterVisibleChange = (visible: boolean) => {
  if (visible) {
    // 打开抽屉时重置表单数据
    Object.assign(formState, props.app);
  }
};

const handleSave = () => {
  formRef.value?.validate().then(() => {
    // 确保更新时包含所有必要属性，包括原有的属性
    const updatedApp = {
      ...formState,
      icon: props.app.icon // 保留原有的 icon
    };
    emit('update', updatedApp);
    message.success('保存成功');
    drawerVisible.value = false;
  }).catch(() => {
    message.error('请填写必填项');
  });
};

const selectFile = async () => {
  // 内置应用不允许修改路径
  if (isBuiltinApp.value) return;
  
  try {
    const result = await window.electronAPI.selectDirectory();
    if (result && result.filePath) {
      formState.path = result.filePath;
    }
  } catch (error) {
    message.error('选择文件失败');
    console.error('选择文件失败:', error);
  }
};

const selectIcon = async () => {
  try {
    const result = await window.electronAPI.selectIcon();
    if (result && result.filePath) {
      formState.iconPath = result.filePath;
    }
  } catch (error) {
    message.error('选择图标失败');
    console.error('选择图标失败:', error);
  }
};

const selectWorkingDirectory = async () => {
  try {
    const result = await window.electronAPI.selectDirectory();
    if (result && result.filePath) {
      formState.workingDirectory = result.filePath;
    }
  } catch (error) {
    message.error('选择工作目录失败');
    console.error('选择工作目录失败:', error);
  }
};

const handleDelete = (e: Event) => {
  e.stopPropagation();
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除 ${props.app.name} 吗？`,
    okText: '确定',
    cancelText: '取消',
    okType: 'danger',
    onOk: () => {
      emit('delete', props.app);
      message.success('删除成功');
    }
  });
};

const handleIconError = () => {
  iconBase64.value = null;
};

const loadExeIcon = async () => {
  try {
    // 首先尝试从预定义图标中获取
    const predefinedIcon = getIconPath(props.app.name);
    if (predefinedIcon) {
      iconBase64.value = `${window.location.origin}${predefinedIcon}`;
      return;
    }

    if (props.app.path && props.app.path.toLowerCase().endsWith('.exe')) {
      // 检查是否是 Electron 应用
      const isElectronApp = props.app.path.toLowerCase().includes('\\resources\\') || 
                           props.app.path.toLowerCase().includes('/resources/');

      // Electron 应用直接使用分类图标
      if (isElectronApp) {
        iconBase64.value = null;
        return;
      }

      // 对于普通应用，尝试获取图标
      const base64Icon = await window.electronAPI.getExeIcon(props.app.path);
      
      // 如果成功获取到图标，直接使用
      if (base64Icon) {
        iconBase64.value = base64Icon;
        return;
      }
      
      // 如果获取失败，尝试使用自定义图标
      if (props.app.iconPath) {
        // 使用绝对路径
        const iconPath = props.app.iconPath.startsWith('./') 
          ? `${window.location.origin}${props.app.iconPath.substring(1)}`
          : props.app.iconPath;
        iconBase64.value = iconPath;
        return;
      }
      
      // 如果都没有，使用默认图标
      iconBase64.value = null;
    } else {
      // 非 exe 文件使用自定义图标
      if (props.app.iconPath) {
        // 使用绝对路径
        const iconPath = props.app.iconPath.startsWith('./') 
          ? `${window.location.origin}${props.app.iconPath.substring(1)}`
          : props.app.iconPath;
        iconBase64.value = iconPath;
      } else {
        iconBase64.value = null;
      }
    }
  } catch (error) {
    console.error('获取图标失败:', error);
    // 发生错误时使用默认图标
    iconBase64.value = null;
  }
};

// 监听下载进度
const handleDownloadProgress = async (data: { appName: string; progress: number; status?: string; path?: string; workingDirectory?: string }) => {
  console.log('Download progress:', data);
  if (data && data.appName === props.app.name) {
    downloadProgress.value = parseFloat(data.progress.toFixed(1));
    if (data.status) {
      downloadStatus.value = data.status as any;
      if (data.status === 'completed' && data.path) {
        try {
          // 搜索最匹配的 exe 文件
          const exePath = await window.electronAPI.findClosestExe(data.path, props.app.name);
          
          const updatedApp: ExtendedAppConfig = {
            id: props.app.id,
            name: props.app.name,
            path: exePath || data.path, // 如果找到匹配的 exe 则使用它，否则使用原路径
            icon: props.app.icon,
            category: props.app.category,
            description: props.app.description,
            type: props.app.type,
            workingDirectory: data.workingDirectory,
            params: props.app.params,
            website: props.app.website,
            downloadUrl: props.app.downloadUrl,
            iconPath: props.app.iconPath,
            isDownloaded: true
          };
          emit('update', updatedApp);
          emit('download-complete', updatedApp);
          
          setTimeout(() => {
            downloadStatus.value = null;
            downloadProgress.value = 0;
          }, 1500);
        } catch (error) {
          console.error('查找启动文件失败:', error);
          message.error('查找启动文件失败');
        }
      }
    }
  }
};

const handleLaunch = async () => {
  if (props.app.path) {
    try {
      // 如果没有设置工作目录，则使用应用程序所在目录
      let workingDirectory = props.app.workingDirectory;
      if (!workingDirectory) {
        // 获取应用程序所在目录
        const appDir = props.app.path.substring(0, props.app.path.lastIndexOf('\\'));
        
        // 对于 OBS，需要设置工作目录为 bin/64bit 的上两级目录
        if (props.app.path.toLowerCase().includes('obs64.exe')) {
          // 检查是否是我们的应用中的 OBS
          if (props.app.path.includes('AITools\\MediaToolsJs\\apps\\video_edit\\ffmpeg工具')) {
            const parentDir = appDir.substring(0, appDir.lastIndexOf('\\'));
            workingDirectory = parentDir.substring(0, parentDir.lastIndexOf('\\'));
          } else {
            workingDirectory = appDir;
          }
        } else {
          workingDirectory = appDir;
        }
      }
      
      console.log('启动应用:', props.app.path, '工作目录:', workingDirectory);
      
      // 使用 emit 事件来启动应用
      emit('launch', {
        ...props.app,
        workingDirectory
      });
    } catch (error) {
      console.error('启动应用失败:', error);
      message.error('启动应用失败');
    }
  }
};

onMounted(() => {
  loadExeIcon();
  checkAppDownloaded();
  window.electronAPI.on('download-progress', handleDownloadProgress);
});

onUnmounted(() => {
  window.electronAPI.removeListener('download-progress', handleDownloadProgress);
});

watch(() => props.app, () => {
  loadExeIcon();
  // 当应用数据变化时重新检查下载状态
  checkAppDownloaded();
}, { deep: true });
</script>

<style lang="scss" scoped>
.app-card {
  height: 280px;
  width: 240px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid #f0f0f0;
  transition: all 0.3s ease;
  flex: 0 0 auto;
  position: relative;
  
  :deep(.ant-card-body) {
    padding: 16px;
    height: 160px;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  
  .app-icon {
    height: 120px;
    padding: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%);
    transition: all 0.3s ease;
    margin: 0;
    border-radius: 8px 8px 0 0;
    
    .icon {
      font-size: 48px;
      color: #1890ff;
      transition: all 0.3s ease;
      opacity: 0.8;
    }

    .custom-icon {
      width: 48px;
      height: 48px;
      object-fit: contain;
      transition: all 0.3s ease;
      image-rendering: -webkit-optimize-contrast;
    }
  }

  :deep(.ant-card-meta) {
    flex: 1;
    min-height: 0;
    
    .ant-card-meta-title {
      color: #262626;
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .ant-card-meta-description {
      color: #595959;
      line-height: 1.5;
      font-size: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .action-buttons {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 4px;
    
    .main-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    :deep(.ant-btn) {
      padding: 0 8px;
      height: 24px;
      font-size: 12px;
      line-height: 22px;
    }
  }

  .download-progress {
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;

    &.visible {
      opacity: 1;
    }

    :deep(.ant-progress) {
      line-height: 1;
      margin-bottom: 0;

      .ant-progress-inner {
        background-color: rgba(0, 0, 0, 0.04);
      }

      .ant-progress-bg {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .ant-progress-text {
        font-size: 12px;
      }
    }
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    border-color: #e6f7ff;
    
    .app-icon {
      background: linear-gradient(135deg, #bae7ff 0%, #d6e4ff 100%);
      
      .icon {
        transform: scale(1.1);
        color: #096dd9;
        opacity: 1;
      }

      .custom-icon {
        transform: scale(1.1);
      }
    }
  }
}

.drawer-footer {
  position: absolute;
  bottom: 0;
  width: 100%;
  border-top: 1px solid #e8e8e8;
  padding: 10px 16px;
  text-align: right;
  left: 0;
  background: #fff;
}

.download-info {
  color: #1890ff;
  margin-top: 8px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}

:root[theme='dark'] {
  .app-card {
    background: #1f1f1f;
    border-color: #303030;

    .app-icon {
      background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
      
      .icon {
        color: #177ddc;
        opacity: 0.8;
      }
    }

    .more-icon {
      color: rgba(255, 255, 255, 0.45);
      
      &:hover {
        color: #40a9ff;
      }
    }

    :deep(.ant-card-meta) {
      .ant-card-meta-title {
        color: rgba(255, 255, 255, 0.85);
      }
      
      .ant-card-meta-description {
        color: rgba(255, 255, 255, 0.65);
      }
    }

    :deep(.ant-card-actions),
    .card-actions {
      background: #141414;
      border-top-color: #303030;
    }

    &:hover {
      border-color: #177ddc;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
      
      .app-icon {
        background: linear-gradient(135deg, #112a45 0%, #15395b 100%);
        
        .icon {
          color: #40a9ff;
          opacity: 1;
        }
      }
    }

    .action-buttons {
      background: #1f1f1f;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    }

    &:hover .action-buttons {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
    }

    .download-progress {
      :deep(.ant-progress) {
        .ant-progress-inner {
          background-color: rgba(255, 255, 255, 0.04);
        }

        .ant-progress-text {
          color: rgba(255, 255, 255, 0.85);
        }
      }
    }
  }

  .drawer-footer {
    background: #1f1f1f;
    border-top-color: #303030;
  }

  .download-info {
    color: #40a9ff;
  }
}
</style> 
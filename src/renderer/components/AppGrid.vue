<template>
  <div class="app-grid">
    <div class="grid-container">
      <app-card 
        v-for="app in apps" 
        :key="app.name"
        :app="app" 
        @launch="launchApp"
        @update="handleUpdateApp"
        @delete="handleDeleteApp"
      />
      <add-app-card :categories="categoryOptions" @add="handleAddApp" />
    </div>

    <!-- 应用详情抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :title="selectedApp?.name"
      placement="right"
      width="400"
    >
      <template v-if="selectedApp">
        <div class="app-info">
          <div class="info-item">
            <div class="label">类型</div>
            <div class="value">{{ selectedApp.category }}</div>
          </div>
          <div class="info-item">
            <div class="label">路径</div>
            <div class="value">{{ selectedApp.path }}</div>
          </div>
          <div class="info-item">
            <div class="label">参数</div>
            <div class="value">{{ selectedApp.params }}</div>
          </div>
          <div class="info-item">
            <div class="label">描述</div>
            <div class="value">{{ selectedApp.description }}</div>
          </div>
        </div>
      </template>
    </a-drawer>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { message } from 'ant-design-vue/es';
import AppCard from './AppCard.vue';
import AddAppCard from './AddAppCard.vue';
import type { AppConfig } from '../../main/core/ConfigManager';

// 确保 electronAPI 类型正确
declare const window: Window & {
  electronAPI: {
    getConfig: () => Promise<any>;
    getCategory: (categoryId: string) => Promise<any>;
    getSettings: () => Promise<any>;
    updateSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
    launchApp: (appConfig: AppConfig) => Promise<void>;
    stopApp: (appName: string) => Promise<{ success: boolean }>;
    addApp: (newApp: AppConfig) => Promise<boolean>;
    updateApp: (updatedApp: AppConfig) => Promise<boolean>;
    deleteApp: (categoryId: string, appName: string) => Promise<boolean>;
    selectDirectory: () => Promise<{ filePath: string } | null>;
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    openExternal: (url: string) => Promise<void>;
    on: (channel: string, callback: (...args: any[]) => void) => () => void;
  }
};

const props = defineProps<{
  apps: AppConfig[];
  currentCategory: {
    id: string;
    name: string;
  };
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const drawerVisible = ref(false);
const selectedApp = ref<AppConfig | null>(null);

// 转换分类选项为下拉框格式
const categoryOptions = computed(() => {
  return [{
    label: props.currentCategory.name,
    value: props.currentCategory.id
  }];
});

const launchApp = async (app: AppConfig) => {
  try {
    // 只传递必要的属性
    const appData: AppConfig = {
      id: app.id,
      name: app.name,
      path: app.path,
      params: app.params,
      category: app.category,
      description: app.description,
      icon: app.icon,
      type: app.type,
      workingDirectory: app.workingDirectory
    };
    
    try {
      await window.electronAPI.launchApp(appData);
      message.success(`启动 ${app.name} 成功`);
    } catch {
      message.error(`启动 ${app.name} 失败`);
    }
  } catch (error) {
    message.error(`启动失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const handleAddApp = async (newApp: AppConfig) => {
  try {
    await window.electronAPI.addApp(newApp);
    message.success('添加成功');
    emit('refresh');
  } catch (error) {
    message.error(`添加失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const handleUpdateApp = async (updatedApp: AppConfig) => {
  try {
    await window.electronAPI.updateApp(updatedApp);
    message.success('更新成功');
    emit('refresh');
  } catch (error) {
    message.error(`更新失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const handleDeleteApp = async (app: AppConfig) => {
  try {
    await window.electronAPI.deleteApp(app.category, app.id);
    message.success('删除成功');
    emit('refresh');
  } catch (error) {
    message.error(`删除失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 添加配置更新监听
onMounted(() => {
  // 监听配置更新
  const cleanup = window.electronAPI.on('config-updated', () => {
    emit('refresh');
  });

  // 组件卸载时取消监听
  onUnmounted(cleanup);
});
</script>

<style lang="scss" scoped>
.app-grid {
  padding: 24px;
  width: 100%;
  
  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, 240px); // 使用卡片宽度作为基准
    gap: 24px; // 设置间距
    justify-content: center; // 居中对齐
    width: 100%;
  }
}

.app-card {
  transition: all 0.3s;
  border-radius: 8px;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .app-icon {
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1890ff 0%, #722ed1 100%);
    transition: all 0.3s;

    &.dark {
      background: linear-gradient(135deg, #177ddc 0%, #531dab 100%);
    }

    .icon {
      font-size: 64px;
      color: white;
    }
  }

  :deep(.ant-card-meta) {
    margin: 16px 0;

    .ant-card-meta-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .ant-card-meta-description {
      color: rgba(0, 0, 0, 0.45);
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
    }
  }

  .card-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
}

.app-info {
  .info-item {
    margin-bottom: 24px;

    .label {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.45);
      margin-bottom: 8px;
    }

    .value {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.85);
      word-break: break-all;
    }
  }
}

:root[theme='dark'] {
  .app-card {
    background: #1f1f1f;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    }

    :deep(.ant-card-meta) {
      .ant-card-meta-title {
        color: rgba(255, 255, 255, 0.85);
      }

      .ant-card-meta-description {
        color: rgba(255, 255, 255, 0.45);
      }
    }
  }

  .app-info {
    .info-item {
      .label {
        color: rgba(255, 255, 255, 0.45);
      }

      .value {
        color: rgba(255, 255, 255, 0.85);
      }
    }
  }
}
</style> 
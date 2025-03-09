<template>
  <a-config-provider :locale="zhCN">
    <a-layout class="layout">
      <!-- 侧边栏 -->
      <a-layout-sider
        v-model:collapsed="collapsed"
        :theme="theme"
        collapsible
        class="app-sider"
        width="240"
        :style="{ background: theme === 'dark' ? '#141414' : '#fff' }"
      >
        <div class="logo">
          <img src="/logo.svg" alt="Logo" class="logo-icon" v-if="!collapsed" />
          <span v-if="!collapsed">Anysonus MCDM Media Box</span>
        </div>
        
        <a-menu
          v-model:selectedKeys="selectedKeys"
          :theme="theme"
          mode="inline"
          class="side-menu"
        >
          <a-menu-item
            v-for="category in categories"
            :key="category.id"
            class="menu-item"
          >
            <template #icon>
              <component 
                :is="getIconComponent(category.id)" 
                class="menu-icon" 
                :style="{ 
                  fontSize: collapsed ? '14px' : '18px',
                  width: collapsed ? '14px' : '18px',
                  height: collapsed ? '14px' : '18px'
                }" 
              />
            </template>
            <span>{{ category.name }}</span>
          </a-menu-item>
        </a-menu>

        <!-- 添加分类按钮 -->
        <div class="add-category-btn">
          <a-button 
            type="dashed" 
            block 
            @click="showAddCategory = true"
            :style="{ margin: '12px 8px', opacity: collapsed ? 0 : 1 }"
          >
            <span v-if="!collapsed">添加分类</span>
          </a-button>
        </div>
      </a-layout-sider>

      <!-- 主内容区 -->
      <a-layout :style="{ marginLeft: collapsed ? '80px' : '240px', transition: 'all 0.2s' }">
        <a-layout-content class="app-content">
          <!-- 鍔熻兘鎸夐挳 -->
          <div class="action-buttons">
            <a-space>
              <a-button
                type="text"
                class="theme-btn"
                @click="toggleTheme"
              >
                <template #icon>
                  <SoundOutlined v-if="theme === 'dark'" />
                  <BulbOutlined v-else />
                </template>
              </a-button>
              <a-button type="text" class="setting-btn" @click="showSettings = true">
                <template #icon><SettingOutlined /></template>
              </a-button>
            </a-space>
          </div>

          <!-- 应用卡片列表 -->
          <template v-if="currentCategory">
            <app-grid 
              :apps="currentCategory.apps || []"
              :current-category="{
                id: currentCategory.id,
                name: currentCategory.name
              }"
              @refresh="refreshCategory"
            />
          </template>
          <template v-else>
            <div class="welcome">
              <img src="/welcome.svg" alt="Welcome" class="welcome-image" />
              <h1>Media Tools</h1>
              <p>强大的音视频处理工具</p>
              <a-button type="primary" size="large" @click="selectedKeys = categories?.[0]?.id ? [categories[0].id] : []">
                <template #icon><PlayCircleOutlined /></template>
                开始使用
              </a-button>
            </div>
          </template>
        </a-layout-content>
      </a-layout>

      <!-- 璁剧疆鎶藉眽 -->
      <settings-drawer
        v-model:visible="showSettings"
        :settings="settings"
        @update="handleUpdateSettings"
      />

      <!-- 添加分类弹出框 -->
      <a-modal
        v-model:visible="showAddCategory"
        title="添加新分类"
        @ok="handleAddCategory"
        @cancel="handleCancelAddCategory"
        :confirmLoading="addCategoryLoading"
      >
        <a-form
          :model="categoryForm"
          :rules="categoryRules"
          ref="categoryFormRef"
          layout="vertical"
        >
          <a-form-item label="分类名称" name="name">
            <a-input v-model:value="categoryForm.name" placeholder="请输入分类名称" />
          </a-form-item>
          <a-form-item label="分类标识" name="id">
            <div class="icon-grid">
              <div
                v-for="(icon, id) in categoryIcons"
                :key="id"
                class="icon-item"
                :class="{ 'icon-selected': categoryForm.id === id }"
                @click="selectIcon(id)"
              >
                <component :is="icon" class="category-icon" />
                <span class="icon-label">{{ getCategoryLabel(id) }}</span>
              </div>
            </div>
          </a-form-item>
        </a-form>
      </a-modal>
    </a-layout>
  </a-config-provider>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue/es';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import AppGrid from './components/AppGrid.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import { type Config, type Category } from '../main/core/ConfigManager';
import {
  SoundOutlined,
  BulbOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  RetweetOutlined,
  SwapOutlined,
  CloudDownloadOutlined,
  PlaySquareOutlined,
  FundViewOutlined,
  PlusOutlined,
  PictureOutlined,
  FileTextOutlined,
  ToolOutlined,
  GlobalOutlined,
  AppstoreOutlined
} from '@vicons/antd';
import type { FormInstance } from 'ant-design-vue/es/form';

// 定义 settings 的类型
interface AppSettings {
  theme?: string;
  language?: string;
  autoScan?: boolean;
  scanInterval?: number;
}

// 折叠菜单
const collapsed = ref(false);
const theme = ref('dark');
const config = ref<Config>({ categories: [] });
const selectedKeys = ref<string[]>([]);
const settings = ref<AppSettings>({});
const showSettings = ref(false);

// 添加分类相关
const showAddCategory = ref(false);
const addCategoryLoading = ref(false);
const categoryFormRef = ref<FormInstance>();
const categoryForm = ref({
  name: '',
  id: ''
});

const categoryRules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  id: [
    { required: true, message: '请输入分类标识', trigger: 'blur' },
    { pattern: /^[a-z_]+$/, message: '分类标识只能包含小写字母和下划线', trigger: 'blur' }
  ]
};

// 计算分类
const categories = computed(() => config.value.categories || []);
const currentCategory = computed(() => {
  const category = categories.value.find(c => c.id === selectedKeys.value[0]);
  console.log('Current category:', category); // 添加日志
  return category;
});

// 切换主题
const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('theme', theme.value);
};

const handleUpdateSettings = async (newSettings: any) => {
  try {
    await window.electronAPI.updateSettings(newSettings);
    settings.value = newSettings;
    message.success('设置已更新');
  } catch (error) {
    message.error(`更新设置失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
};

// 添加刷新分类方法
const refreshCategory = async () => {
  try {
    if (currentCategory.value?.id) {
      const updatedCategory = await window.electronAPI.getCategory(currentCategory.value.id);
      const categoryIndex = config.value.categories.findIndex(c => c.id === currentCategory.value?.id);
      if (categoryIndex !== -1) {
        config.value.categories[categoryIndex] = updatedCategory;
      }
    }
  } catch (error) {
    message.error(`刷新分类失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
};

// 添加刷新配置方法
const refreshConfig = async () => {
  try {
    const newConfig = await window.electronAPI.getConfig();
    config.value = newConfig;
  } catch (error) {
    message.error(`刷新配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
};

// 添加分类相关
const handleAddCategory = () => {
  categoryFormRef.value?.validate().then(async () => {
    try {
      addCategoryLoading.value = true;
      const category: Category = {
        id: categoryForm.value.id,
        name: categoryForm.value.name,
        apps: []
      };
      await window.electronAPI.addCategory(category);
      message.success('添加分类成功');
      showAddCategory.value = false;
      categoryFormRef.value?.resetFields();
      // 刷新配置
      await refreshConfig();
    } catch (error) {
      message.error(`添加分类失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      addCategoryLoading.value = false;
    }
  });
};

const handleCancelAddCategory = () => {
  categoryFormRef.value?.resetFields();
  showAddCategory.value = false;
};

// 实时获取配置
onMounted(async () => {
  try {
    // 实时获取配置
    const newConfig = await window.electronAPI.getConfig();
    config.value = newConfig;
    console.log('Loaded config:', newConfig); // 添加日志
    
    if (newConfig.categories && newConfig.categories.length > 0) {
      selectedKeys.value = [newConfig.categories[0].id];
      console.log('Selected category:', selectedKeys.value[0]); // 添加日志
    }
    
    // 实时获取设置
    settings.value = await window.electronAPI.getSettings();
    
    // 实时更新主题
    theme.value = settings.value.theme || 'light';
    document.documentElement.setAttribute('theme', theme.value);

    // 实时更新配置
    window.electronAPI.on('config-updated', (newConfig: Config) => {
      config.value = newConfig;
      console.log('Config updated:', newConfig); // 添加日志
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    message.error(`获取配置失败: ${errorMessage}`);
    
    // 使用默认设置
    settings.value = {
      theme: 'light',
      language: 'zh-CN',
      autoScan: true,
      scanInterval: 5
    };
  }
});

// 更新预定义的分类图标映射
const categoryIcons = {
  video_process: VideoCameraOutlined,
  audio_process: AudioOutlined,
  video_convert: RetweetOutlined,
  audio_convert: SwapOutlined,
  media_download: CloudDownloadOutlined,
  media_record: PlaySquareOutlined,
  media_stream: FundViewOutlined,
  media_player: PlayCircleOutlined
} as const;

// 在 setup 中添加
const getIconComponent = (categoryId: string) => {
  return categoryIcons[categoryId as keyof typeof categoryIcons] || AppstoreOutlined;
};

// 分类标识映射表
const categoryLabels = {
  video_process: '视频处理',
  audio_process: '音频处理',
  video_convert: '视频转换',
  audio_convert: '音频转换',
  media_download: '媒体下载',
  media_record: '媒体录制',
  media_stream: '流媒体',
  media_player: '播放器'
} as const;

// 选择图标的方法
const selectIcon = (id: string) => {
  categoryForm.value.id = id;
};

// 获取分类标签的方法
const getCategoryLabel = (id: string) => {
  return categoryLabels[id as keyof typeof categoryLabels] || id;
};
</script>

<style lang="scss">
.layout {
  min-height: 100vh;
  background: #f0f2f5;
  
  .app-sider {
    overflow: auto;
    height: 100vh;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.06);

    .logo {
      display: none;
    }

    .side-menu {
      border-right: none;

      .menu-item {
        margin: 2px 6px;
        padding: 0 12px;
        border-radius: 4px;
        height: 36px;
        line-height: 36px;

        :deep(.ant-menu-title-content) {
          font-size: 14px;
        }

        :deep(.menu-icon) {
          font-size: 14px !important;
          width: 14px !important;
          height: 14px !important;
          vertical-align: -0.125em;
        }

        :deep(.ant-menu-item-icon) {
          font-size: 14px !important;
          width: 14px !important;
          height: 14px !important;
        }

        &:hover {
          background-color: rgba(0, 0, 0, 0.04);
        }

        &.ant-menu-item-selected {
          background-color: #1890ff;
          color: white;
        }
      }
    }

    // 折叠菜单时隐藏图标
    &.ant-layout-sider-collapsed {
      .menu-item {
        :deep(.ant-menu-item-icon) {
          font-size: 14px !important;
          width: 14px !important;
          height: 14px !important;
          
          svg {
            width: 14px !important;
            height: 14px !important;
          }
        }
        
        :deep(.menu-icon) {
          font-size: 14px !important;
          width: 14px !important;
          height: 14px !important;
          
          svg {
            width: 14px !important;
            height: 14px !important;
          }
        }
      }
    }

    :deep(.ant-layout-sider-trigger) {
      height: 28px;
      line-height: 28px;
      
      .anticon {
        font-size: 12px;
        vertical-align: middle;
      }
    }
  }
  
  .app-content {
    padding: 24px;
    background: #f5f5f5;
    min-height: 100vh;
    position: relative;

    .action-buttons {
      position: absolute;
      top: 24px;
      right: 24px;
      z-index: 1;

      .theme-btn,
      .setting-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.3s;

        :deep(.anticon) {
          font-size: 16px;
        }

        &:hover {
          background-color: rgba(0, 0, 0, 0.04);
        }
      }
    }
    
    .welcome {
      text-align: center;
      padding: 48px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      
      .welcome-image {
        width: 240px;
        margin-bottom: 32px;
      }

      h1 {
        font-size: 32px;
        margin-bottom: 16px;
        color: #1f1f1f;
        background: linear-gradient(45deg, #1890ff, #722ed1);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      
      p {
        font-size: 16px;
        color: #666;
        margin-bottom: 32px;
      }
    }
  }
}

// 暗黑主题样式
:root[theme='dark'] {
  .app-sider {
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.12);
    background: #1f1f1f !important;

    .logo span {
      color: rgba(255, 255, 255, 0.85);
    }

    .side-menu {
      background: #1f1f1f;
      
      .menu-item {
        &:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }

        &.ant-menu-item-selected {
          background-color: #177ddc;
        }
      }
    }
  }

  .app-content {
    background: #141414;

    .action-buttons {
      .theme-btn,
      .setting-btn {
        color: rgba(255, 255, 255, 0.75);
        
        &:hover {
          background-color: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.95);
        }
      }
    }

    .welcome {
      background: #1f1f1f;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);

      h1 {
        color: #fff;
        background: linear-gradient(45deg, #40a9ff, #722ed1);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      p {
        color: rgba(255, 255, 255, 0.75);
      }
    }

    .empty-category {
      :deep(.ant-empty) {
        .ant-empty-image {
          opacity: 0.75;
        }
        .ant-empty-description {
          color: rgba(255, 255, 255, 0.65);
        }
      }
    }
  }

  .add-category-btn {
    .ant-btn {
      border-color: rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.65);
      
      &:hover {
        border-color: #177ddc;
        color: #177ddc;
      }
    }
  }
}

.add-category-btn {
  transition: all 0.3s;
  padding: 0 4px;
  
  .ant-btn {
    transition: all 0.3s;

    :deep(.anticon) {
      font-size: 14px !important;
      width: 14px !important;
      height: 14px !important;
      vertical-align: -0.125em;

      svg {
        width: 14px !important;
        height: 14px !important;
      }
    }

    &:hover {
      border-color: #177ddc;
      color: #177ddc;
    }
  }
}

// 添加分类图标样式
.category-icon {
  font-size: 14px;
  margin-right: 8px;
  vertical-align: -0.125em;
}

// 调整下拉选项的样式
:deep(.ant-select-item-option-content) {
  display: flex;
  align-items: center;
  font-size: 14px;
  
  .anticon {
    font-size: 14px;
    margin-right: 8px;
  }
}

// 调整选中值的样式
:deep(.ant-select-selection-item) {
  display: flex;
  align-items: center;
  font-size: 14px;
  
  .anticon {
    font-size: 14px;
    margin-right: 8px;
  }
}

// 图标网格样式
.icon-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 8px;
  
  .icon-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s;
    border: 1px solid #f0f0f0;
    
    &:hover {
      background-color: #f5f5f5;
      border-color: #d9d9d9;
    }
    
    &.icon-selected {
      background-color: #e6f7ff;
      border-color: #1890ff;
      
      .category-icon {
        color: #1890ff;
      }
      
      .icon-label {
        color: #1890ff;
      }
    }
    
    .category-icon {
      font-size: 24px;
      margin-bottom: 8px;
      color: #595959;
    }
    
    .icon-label {
      font-size: 12px;
      color: #8c8c8c;
      text-align: center;
      line-height: 1.2;
    }
  }
}

// 暗黑主题下的图标网格样式
:root[theme='dark'] {
  .icon-grid {
    .icon-item {
      border-color: #303030;
      
      &:hover {
        background-color: #1f1f1f;
        border-color: #434343;
      }
      
      &.icon-selected {
        background-color: #111d2c;
        border-color: #177ddc;
        
        .category-icon {
          color: #177ddc;
        }
        
        .icon-label {
          color: #177ddc;
        }
      }
      
      .category-icon {
        color: rgba(255, 255, 255, 0.65);
      }
      
      .icon-label {
        color: rgba(255, 255, 255, 0.45);
      }
    }
  }
}
</style>

<template>
  <a-drawer
    title="设置"
    placement="right"
    :visible="visible"
    @close="$emit('update:visible', false)"
    width="400"
  >
    <a-form :model="formState" layout="vertical">
      <!-- 主题设置 -->
      <a-form-item label="主题">
        <a-select v-model:value="formState.theme">
          <a-select-option value="light">浅色</a-select-option>
          <a-select-option value="dark">深色</a-select-option>
        </a-select>
      </a-form-item>

      <!-- 语言设置 -->
      <a-form-item label="语言">
        <a-select v-model:value="formState.language">
          <a-select-option value="zh-CN">简体中文</a-select-option>
          <a-select-option value="en-US">English</a-select-option>
        </a-select>
      </a-form-item>

      <!-- 自动扫描设置 -->
      <a-form-item>
        <a-switch
          v-model:checked="formState.autoScan"
          checked-children="自动扫描已开启"
          un-checked-children="自动扫描已关闭"
        />
      </a-form-item>

      <!-- 扫描间隔设置 -->
      <a-form-item 
        label="扫描间隔 (毫秒)" 
        v-if="formState.autoScan"
      >
        <a-input-number
          v-model:value="formState.scanInterval"
          :min="1000"
          :max="60000"
          :step="1000"
        />
      </a-form-item>

      <!-- 应用目录设置 -->
      <a-form-item label="应用目录">
        <a-input
          v-model:value="formState.appsDirectory"
          placeholder="请选择应用目录"
          readonly
        >
          <template #addonAfter>
            <a-button type="link" @click="selectDirectory">
              浏览
            </a-button>
          </template>
        </a-input>
      </a-form-item>
    </a-form>

    <!-- 操作按钮 -->
    <template #footer>
      <a-space>
        <a-button @click="$emit('update:visible', false)">
          取消
        </a-button>
        <a-button type="primary" @click="handleSave">
          保存
        </a-button>
      </a-space>
    </template>
  </a-drawer>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  settings: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'update', settings: Record<string, any>): void;
}>();

// 表单状态
const formState = ref({ ...props.settings });

// 监听设置变化
watch(
  () => props.settings,
  (newSettings) => {
    formState.value = { ...newSettings };
  },
  { deep: true }
);

// 选择目录
const selectDirectory = async () => {
  try {
    const result = await window.electronAPI.selectDirectory();
    if (result && result.filePath) {
      formState.value.appsDirectory = result.filePath;
    }
  } catch (error) {
    console.error('选择目录失败:', error);
  }
};

// 保存设置
const handleSave = () => {
  emit('update', { ...formState.value });
  emit('update:visible', false);
};
</script>

<style lang="scss" scoped>
.ant-form {
  padding: 24px 0;
}
</style> 
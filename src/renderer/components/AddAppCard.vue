<template>
  <a-card hoverable class="add-app-card" @click="showModal">
    <div class="add-icon">
      <PlusOutlined class="icon" />
      <p>添加新软件</p>
    </div>
  </a-card>

  <a-modal
    v-model:visible="modalVisible"
    title="添加新软件"
    @ok="handleOk"
    @cancel="handleCancel"
    :confirmLoading="confirmLoading"
    width="600px"
  >
    <a-form
      :model="formState"
      :rules="rules"
      ref="formRef"
      layout="vertical"
    >
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="软件名称" name="name">
            <a-input v-model:value="formState.name" placeholder="请输入软件名称" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="软件分类" name="category">
            <a-select
              v-model:value="formState.category"
              placeholder="请选择软件分类"
              :options="categories"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="软件路径" name="path">
        <a-input-group compact>
          <a-input
            v-model:value="formState.path"
            placeholder="请选择软件可执行文件"
            style="width: calc(100% - 50px)"
            readonly
          />
          <a-button type="primary" @click="selectFile">
            <FileOutlined />
          </a-button>
        </a-input-group>
      </a-form-item>

      <a-form-item label="启动参数" name="params">
        <a-input v-model:value="formState.params" placeholder="请输入启动参数，例如: -i {input}" />
      </a-form-item>

      <a-form-item label="软件描述" name="description">
        <a-textarea
          v-model:value="formState.description"
          :rows="3"
          placeholder="请输入软件描述"
        />
      </a-form-item>

      <a-form-item label="官网地址" name="website">
        <a-input v-model:value="formState.website" placeholder="请输入官网地址（可选）" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script lang="ts" setup>
import { ref, reactive } from 'vue';
import { message } from 'ant-design-vue/es';
import PlusOutlined from '@ant-design/icons-vue/lib/icons/PlusOutlined';
import FileOutlined from '@ant-design/icons-vue/lib/icons/FileOutlined';
import type { FormInstance } from 'ant-design-vue/es/form';

const props = defineProps<{
  categories: { label: string; value: string }[];
}>();

const emit = defineEmits<{
  (e: 'add', app: any): void;
}>();

const modalVisible = ref(false);
const confirmLoading = ref(false);
const formRef = ref<FormInstance>();

const formState = reactive({
  name: '',
  category: props.categories[0]?.value,
  path: '',
  params: '',
  description: '',
  website: ''
});

const rules = {
  name: [{ required: true, message: '请输入软件名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择软件分类', trigger: 'change' }],
  path: [{ required: true, message: '请选择软件可执行文件', trigger: 'change' }],
  description: [{ required: true, message: '请输入软件描述', trigger: 'blur' }]
};

const showModal = () => {
  modalVisible.value = true;
};

const handleOk = () => {
  formRef.value?.validate().then(() => {
    confirmLoading.value = true;
    
    // 构造新的应用配置，确保所有值都是基本类型，并添加 type: "external"
    const newApp = {
      name: String(formState.name),
      category: String(formState.category),
      path: String(formState.path),
      params: String(formState.params),
      description: String(formState.description),
      website: formState.website ? String(formState.website) : undefined,
      icon: String(formState.category), // 使用分类作为默认图标
      type: "external" // 设置为外部应用
    };

    // 发送添加事件
    emit('add', newApp);
    
    // 重置表单
    formRef.value?.resetFields();
    modalVisible.value = false;
    confirmLoading.value = false;
  }).catch((error) => {
    // 表单验证失败
    console.error('表单验证失败:', error);
    message.error('请填写所有必填项');
  });
};

const handleCancel = () => {
  formRef.value?.resetFields();
  modalVisible.value = false;
};

const selectFile = async () => {
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
</script>

<style lang="scss" scoped>
.add-app-card {
  height: 280px;
  width: 240px;
  cursor: pointer;
  border: 2px dashed #d9d9d9;
  transition: all 0.3s ease;
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  
  .add-icon {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: #999;
    padding: 24px;
    padding-bottom: 60px; /* 为底部留出空间 */
    
    .icon {
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
      transition: all 0.3s ease;

      :deep(svg) {
        width: 100%;
        height: 100%;
      }
    }
    
    p {
      font-size: 14px;
      margin: 0;
      color: #666;
    }
  }
  
  &:hover {
    border-color: #40a9ff;
    transform: translateY(-4px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    
    .add-icon {
      color: #40a9ff;
      
      .icon {
        transform: scale(1.1);
      }

      p {
        color: #40a9ff;
      }
    }
  }
}

:root[theme='dark'] {
  .add-app-card {
    background: #1f1f1f;
    border-color: #303030;

    .add-icon {
      color: rgba(255, 255, 255, 0.45);

      p {
        color: rgba(255, 255, 255, 0.45);
      }
    }

    &:hover {
      border-color: #40a9ff;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
      
      .add-icon {
        color: #40a9ff;

        p {
          color: #40a9ff;
        }
      }
    }
  }
}
</style> 
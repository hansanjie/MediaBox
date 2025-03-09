import { watch } from 'chokidar';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';

export interface AppConfig {
  id: string;
  name: string;
  path: string;
  icon: string;
  iconPath?: string;
  params?: string;
  category: string;
  description: string;
  website?: string;
  type: 'builtin' | 'external';
  downloadUrl?: string;
  isDownloaded?: boolean;
  workingDirectory?: string;
}

export interface Category {
  id: string;
  name: string;
  apps: AppConfig[];
}

export interface Config {
  categories: Category[];
  builtinAppsFolder?: string;
}

export class ConfigManager extends EventEmitter {
  private config: Config = { categories: [] };
  private builtinConfigPath: string;
  private externalConfigPath: string;
  private watchers: any[] = [];

  constructor() {
    super();
    this.builtinConfigPath = join(app.getAppPath(), 'configs', 'builtin-apps.json');
    this.externalConfigPath = join(app.getAppPath(), 'configs', 'external-apps.json');
    
    // 加载配置
    this.loadConfig();
    
    // 监听配置文件变化
    this.watchConfig();
  }

  private loadConfig() {
    try {
      // 初始化为空配置
      this.config = { categories: [] };
      
      // 首先加载内部应用
      if (existsSync(this.builtinConfigPath)) {
        const builtinConfigData = readFileSync(this.builtinConfigPath, 'utf-8');
        // 移除BOM头
        const cleanBuiltinData = builtinConfigData.replace(/^\uFEFF/, '');
        const builtinConfig = JSON.parse(cleanBuiltinData);
        
        // 处理内部应用特有的字段
        if (builtinConfig.builtinAppsFolder) {
          this.config.builtinAppsFolder = builtinConfig.builtinAppsFolder;
        }
        
        // 将内部应用分类添加到配置
        this.mergeCategories(builtinConfig.categories);
      }
      
      // 然后加载外部应用
      if (existsSync(this.externalConfigPath)) {
        const externalConfigData = readFileSync(this.externalConfigPath, 'utf-8');
        // 移除BOM头
        const cleanExternalData = externalConfigData.replace(/^\uFEFF/, '');
        const externalConfig = JSON.parse(cleanExternalData);
        
        // 将外部应用分类添加到配置
        this.mergeCategories(externalConfig.categories);
      }
      
      this.emit('config-loaded', this.config);
    } catch (error) {
      console.error('加载配置文件失败:', error);
      this.config = { categories: [] };
    }
  }
  
  // 合并分类及应用
  private mergeCategories(categories: Category[]) {
    if (!categories || !Array.isArray(categories)) return;
    
    for (const newCategory of categories) {
      // 查找是否已存在相同ID的分类
      const existingCategoryIndex = this.config.categories.findIndex(
        (cat: Category) => cat.id === newCategory.id
      );
      
      if (existingCategoryIndex === -1) {
        // 如果分类不存在，直接添加
        this.config.categories.push({ ...newCategory });
      } else {
        // 如果分类存在，合并应用列表
        const existingCategory = this.config.categories[existingCategoryIndex];
        
        // 确保应用列表存在
        if (!existingCategory.apps) existingCategory.apps = [];
        
        // 添加新应用，避免重复
        for (const app of newCategory.apps || []) {
          if (!existingCategory.apps.some((existingApp: AppConfig) => existingApp.id === app.id)) {
            existingCategory.apps.push(app);
          }
        }
      }
    }
  }

  private watchConfig() {
    // 清除旧的监听器
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    
    // 监听内部应用配置
    const builtinWatcher = watch(this.builtinConfigPath, {
      persistent: true
    }).on('change', () => {
      this.loadConfig();
      this.emit('config-changed', this.config);
    });
    this.watchers.push(builtinWatcher);
    
    // 监听外部应用配置
    const externalWatcher = watch(this.externalConfigPath, {
      persistent: true
    }).on('change', () => {
      this.loadConfig();
      this.emit('config-changed', this.config);
    });
    this.watchers.push(externalWatcher);
  }

  public getConfig(): Config {
    return this.config;
  }

  public getCategory(id: string): Category | undefined {
    return this.config.categories.find((cat: Category) => cat.id === id);
  }

  public getApps(categoryId: string): AppConfig[] {
    const category = this.getCategory(categoryId);
    return category ? category.apps : [];
  }

  public addApp(newApp: AppConfig): void {
    // 只允许将新应用添加到外部应用配置
    if (newApp.type !== 'external') {
      throw new Error('通过此方法只能添加外部应用');
    }
    
    // 读取当前外部应用配置
    let externalConfig: Config = { categories: [] };
    try {
      if (existsSync(this.externalConfigPath)) {
        const externalConfigData = readFileSync(this.externalConfigPath, 'utf-8');
        const cleanExternalData = externalConfigData.replace(/^\uFEFF/, '');
        externalConfig = JSON.parse(cleanExternalData);
      }
    } catch (error) {
      console.error('读取外部应用配置失败:', error);
      externalConfig = { categories: [] };
    }
    
    // 找到对应的分类
    let category = externalConfig.categories.find((cat: Category) => cat.id === newApp.category);
    
    if (!category) {
      // 如果外部配置中不存在该分类，从主配置中获取分类信息
      const mainCategory = this.getCategory(newApp.category);
      if (!mainCategory) {
        throw new Error('分类不存在');
      }
      
      // 创建新分类
      category = {
        id: mainCategory.id,
        name: mainCategory.name,
        apps: []
      };
      externalConfig.categories.push(category);
    }

    // 生成唯一ID
    newApp.id = `${newApp.category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 检查应用名称是否重复
    if (category.apps.some((app: AppConfig) => app.name === newApp.name)) {
      throw new Error('该分类下已存在同名应用');
    }

    // 添加新应用
    category.apps.push(newApp);

    // 保存外部配置
    this.saveExternalConfig(externalConfig);

    // 重新加载合并配置
    this.loadConfig();
    
    // 触发配置更新事件
    this.emit('config-changed', this.config);
  }

  public updateApp(updatedApp: AppConfig): void {
    // 分别针对内部和外部应用处理更新
    if (updatedApp.type === 'builtin') {
      this.updateBuiltinApp(updatedApp);
    } else {
      this.updateExternalApp(updatedApp);
    }
    
    // 重新加载合并配置
    this.loadConfig();
    
    // 触发配置更新事件
    this.emit('config-changed', this.config);
  }
  
  private updateBuiltinApp(updatedApp: AppConfig): void {
    try {
      if (existsSync(this.builtinConfigPath)) {
        const builtinConfigData = readFileSync(this.builtinConfigPath, 'utf-8');
        const cleanBuiltinData = builtinConfigData.replace(/^\uFEFF/, '');
        const builtinConfig = JSON.parse(cleanBuiltinData);
        
        // 找到对应的分类
        const category = builtinConfig.categories.find((cat: Category) => cat.id === updatedApp.category);
        if (!category) {
          throw new Error('内部应用分类不存在');
        }
        
        // 找到要更新的应用索引
        const appIndex = category.apps.findIndex((app: AppConfig) => app.id === updatedApp.id);
        if (appIndex === -1) {
          throw new Error('内部应用不存在');
        }
        
        // 更新应用
        category.apps[appIndex] = updatedApp;
        
        // 保存内部配置
        this.saveBuiltinConfig(builtinConfig);
      }
    } catch (error) {
      console.error('更新内部应用失败:', error);
      throw error;
    }
  }
  
  private updateExternalApp(updatedApp: AppConfig): void {
    try {
      if (existsSync(this.externalConfigPath)) {
        const externalConfigData = readFileSync(this.externalConfigPath, 'utf-8');
        const cleanExternalData = externalConfigData.replace(/^\uFEFF/, '');
        const externalConfig = JSON.parse(cleanExternalData);
        
        // 找到对应的分类
        const category = externalConfig.categories.find((cat: Category) => cat.id === updatedApp.category);
        if (!category) {
          throw new Error('外部应用分类不存在');
        }
        
        // 找到要更新的应用索引
        const appIndex = category.apps.findIndex((app: AppConfig) => app.id === updatedApp.id);
        if (appIndex === -1) {
          throw new Error('外部应用不存在');
        }
        
        // 更新应用
        category.apps[appIndex] = updatedApp;
        
        // 保存外部配置
        this.saveExternalConfig(externalConfig);
      }
    } catch (error) {
      console.error('更新外部应用失败:', error);
      throw error;
    }
  }

  public deleteApp(categoryId: string, appId: string): void {
    // 首先检查是内部应用还是外部应用
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error('分类不存在');
    }
    
    const app = category.apps.find(app => app.id === appId);
    if (!app) {
      throw new Error('应用不存在');
    }
    
    if (app.type === 'builtin') {
      this.deleteBuiltinApp(categoryId, appId);
    } else {
      this.deleteExternalApp(categoryId, appId);
    }
    
    // 重新加载合并配置
    this.loadConfig();
    
    // 触发配置更新事件
    this.emit('config-changed', this.config);
  }
  
  private deleteBuiltinApp(categoryId: string, appId: string): void {
    try {
      if (existsSync(this.builtinConfigPath)) {
        const builtinConfigData = readFileSync(this.builtinConfigPath, 'utf-8');
        const cleanBuiltinData = builtinConfigData.replace(/^\uFEFF/, '');
        const builtinConfig = JSON.parse(cleanBuiltinData);
        
        // 找到对应的分类
        const category = builtinConfig.categories.find((cat: Category) => cat.id === categoryId);
        if (!category) {
          throw new Error('内部应用分类不存在');
        }
        
        // 找到要删除的应用索引
        const appIndex = category.apps.findIndex((app: AppConfig) => app.id === appId);
        if (appIndex === -1) {
          throw new Error('内部应用不存在');
        }
        
        // 删除应用
        category.apps.splice(appIndex, 1);
        
        // 保存内部配置
        this.saveBuiltinConfig(builtinConfig);
      }
    } catch (error) {
      console.error('删除内部应用失败:', error);
      throw error;
    }
  }
  
  private deleteExternalApp(categoryId: string, appId: string): void {
    try {
      if (existsSync(this.externalConfigPath)) {
        const externalConfigData = readFileSync(this.externalConfigPath, 'utf-8');
        const cleanExternalData = externalConfigData.replace(/^\uFEFF/, '');
        const externalConfig = JSON.parse(cleanExternalData);
        
        // 找到对应的分类
        const category = externalConfig.categories.find((cat: Category) => cat.id === categoryId);
        if (!category) {
          throw new Error('外部应用分类不存在');
        }
        
        // 找到要删除的应用索引
        const appIndex = category.apps.findIndex((app: AppConfig) => app.id === appId);
        if (appIndex === -1) {
          throw new Error('外部应用不存在');
        }
        
        // 删除应用
        category.apps.splice(appIndex, 1);
        
        // 保存外部配置
        this.saveExternalConfig(externalConfig);
      }
    } catch (error) {
      console.error('删除外部应用失败:', error);
      throw error;
    }
  }

  public addCategory(category: Category): void {
    // 添加分类到两个配置文件中
    try {
      // 添加到内部配置
      let builtinConfig: Config = { categories: [] };
      if (existsSync(this.builtinConfigPath)) {
        const builtinConfigData = readFileSync(this.builtinConfigPath, 'utf-8');
        const cleanBuiltinData = builtinConfigData.replace(/^\uFEFF/, '');
        builtinConfig = JSON.parse(cleanBuiltinData);
      }
      
      if (builtinConfig.categories.some((cat: Category) => cat.id === category.id)) {
        throw new Error('分类标识已存在于内部配置');
      }
      
      // 添加到外部配置
      let externalConfig: Config = { categories: [] };
      if (existsSync(this.externalConfigPath)) {
        const externalConfigData = readFileSync(this.externalConfigPath, 'utf-8');
        const cleanExternalData = externalConfigData.replace(/^\uFEFF/, '');
        externalConfig = JSON.parse(cleanExternalData);
      }
      
      if (externalConfig.categories.some((cat: Category) => cat.id === category.id)) {
        throw new Error('分类标识已存在于外部配置');
      }
      
      // 在两个配置中添加空的分类
      const emptyCategory = {
        id: category.id,
        name: category.name,
        apps: []
      };
      
      builtinConfig.categories.push(emptyCategory);
      externalConfig.categories.push(emptyCategory);
      
      // 保存配置
      this.saveBuiltinConfig(builtinConfig);
      this.saveExternalConfig(externalConfig);
      
      // 重新加载合并配置
      this.loadConfig();
      
      // 触发配置更新事件
      this.emit('config-changed', this.config);
    } catch (error) {
      console.error('添加分类失败:', error);
      throw error;
    }
  }

  public updateCategory(category: Category): void {
    try {
      // 更新内部配置中的分类
      if (existsSync(this.builtinConfigPath)) {
        const builtinConfigData = readFileSync(this.builtinConfigPath, 'utf-8');
        const cleanBuiltinData = builtinConfigData.replace(/^\uFEFF/, '');
        const builtinConfig = JSON.parse(cleanBuiltinData);
        
        const builtinCategoryIndex = builtinConfig.categories.findIndex((cat: Category) => cat.id === category.id);
        if (builtinCategoryIndex !== -1) {
          builtinConfig.categories[builtinCategoryIndex].name = category.name;
          this.saveBuiltinConfig(builtinConfig);
        }
      }
      
      // 更新外部配置中的分类
      if (existsSync(this.externalConfigPath)) {
        const externalConfigData = readFileSync(this.externalConfigPath, 'utf-8');
        const cleanExternalData = externalConfigData.replace(/^\uFEFF/, '');
        const externalConfig = JSON.parse(cleanExternalData);
        
        const externalCategoryIndex = externalConfig.categories.findIndex((cat: Category) => cat.id === category.id);
        if (externalCategoryIndex !== -1) {
          externalConfig.categories[externalCategoryIndex].name = category.name;
          this.saveExternalConfig(externalConfig);
        }
      }
      
      // 重新加载合并配置
      this.loadConfig();
      
      // 触发配置更新事件
      this.emit('config-changed', this.config);
    } catch (error) {
      console.error('更新分类失败:', error);
      throw error;
    }
  }

  public deleteCategory(id: string): void {
    try {
      // 先检查内部和外部配置中是否有此分类下的应用
      const category = this.getCategory(id);
      if (category && category.apps.length > 0) {
        throw new Error('无法删除包含应用的分类');
      }
      
      // 从内部配置中删除分类
      if (existsSync(this.builtinConfigPath)) {
        const builtinConfigData = readFileSync(this.builtinConfigPath, 'utf-8');
        const cleanBuiltinData = builtinConfigData.replace(/^\uFEFF/, '');
        const builtinConfig = JSON.parse(cleanBuiltinData);
        
        const builtinCategoryIndex = builtinConfig.categories.findIndex((cat: Category) => cat.id === id);
        if (builtinCategoryIndex !== -1) {
          builtinConfig.categories.splice(builtinCategoryIndex, 1);
          this.saveBuiltinConfig(builtinConfig);
        }
      }
      
      // 从外部配置中删除分类
      if (existsSync(this.externalConfigPath)) {
        const externalConfigData = readFileSync(this.externalConfigPath, 'utf-8');
        const cleanExternalData = externalConfigData.replace(/^\uFEFF/, '');
        const externalConfig = JSON.parse(cleanExternalData);
        
        const externalCategoryIndex = externalConfig.categories.findIndex((cat: Category) => cat.id === id);
        if (externalCategoryIndex !== -1) {
          externalConfig.categories.splice(externalCategoryIndex, 1);
          this.saveExternalConfig(externalConfig);
        }
      }
      
      // 重新加载合并配置
      this.loadConfig();
      
      // 触发配置更新事件
      this.emit('config-changed', this.config);
    } catch (error) {
      console.error('删除分类失败:', error);
      throw error;
    }
  }

  private saveBuiltinConfig(config: Config): void {
    try {
      writeFileSync(this.builtinConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存内部应用配置文件失败:', error);
      throw error;
    }
  }
  
  private saveExternalConfig(config: Config): void {
    try {
      writeFileSync(this.externalConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存外部应用配置文件失败:', error);
      throw error;
    }
  }

  public importConfig(newConfig: Config): void {
    try {
      // 验证新配置的格式
      if (!newConfig.categories || !Array.isArray(newConfig.categories)) {
        throw new Error('无效的配置文件格式');
      }

      // 将新配置保存为外部配置
      this.saveExternalConfig(newConfig);

      // 重新加载配置
      this.loadConfig();

      // 触发配置更新事件
      this.emit('config-changed', this.config);
    } catch (error) {
      console.error('导入配置失败:', error);
      throw error;
    }
  }

  public dispose() {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }

  public getApp(categoryId: string, appName: string): AppConfig | null {
    const category = this.getCategory(categoryId);
    if (!category || !category.apps) {
      return null;
    }
    return category.apps.find(app => app.name === appName) || null;
  }
}

export const configManager = new ConfigManager();

declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'ant-design-vue/es/locale/zh_CN' {
  const zhCN: any;
  export default zhCN;
} 
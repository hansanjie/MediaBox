/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'ant-design-vue' {
  const Antd: any
  export default Antd
}

declare module 'ant-design-vue/es/locale/zh_CN' {
  const zhCN: any
  export default zhCN
}

declare module '@ant-design/icons-vue' {
  const IconComponent: any
  export default IconComponent
} 
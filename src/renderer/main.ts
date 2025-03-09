import { createApp } from 'vue'
import App from './App.vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

// 创建Vue应用
const app = createApp(App)

// 使用Ant Design Vue
app.use(Antd)

// 挂载应用
app.mount('#app')

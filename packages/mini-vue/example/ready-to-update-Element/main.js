/* main.js */
import App from './App.js'
import { createApp } from '../../dist/mini-zsm-vue.esm-bundler.js'
const rootContainer = document.querySelector('#app')
const app = createApp(App)
app.mount(rootContainer)

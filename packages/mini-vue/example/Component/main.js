/* main.js */
import { App } from './App.js'
const { createApp } = miniVue
const rootContainer = document.querySelector('#app')
const app = createApp(App)
app.mount(rootContainer)

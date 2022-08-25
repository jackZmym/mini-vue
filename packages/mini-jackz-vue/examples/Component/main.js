/* main.js */
import { App } from './App.js'
const { createApp } = miniJackzVue
const rootContainer = document.querySelector('#app')
const app = createApp(App)
app.mount(rootContainer)

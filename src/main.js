import { createApp } from 'vue'
import App from './App.vue'
import { Calendar, NavBar, Divider, Empty, Toast, Grid, GridItem } from 'vant'
import 'vant/lib/index.css'

const app = createApp(App)

// Register Vant components
app.use(Calendar)
app.use(NavBar)
app.use(Divider)
app.use(Empty)
app.use(Toast)
app.use(Grid)
app.use(GridItem)

app.mount('#app')

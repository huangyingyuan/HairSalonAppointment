import { createApp } from 'vue'
import App from './App.vue'
import { Calendar, NavBar, Divider, Empty, Grid, GridItem, Popup, Form, Field, CellGroup, RadioGroup, Radio, Button, showToast, NoticeBar, Dialog } from 'vant'
import 'vant/lib/index.css'

const app = createApp(App)

// Register Vant components
app.use(Calendar)
app.use(NavBar)
app.use(Divider)
app.use(Empty)
app.use(Grid)
app.use(GridItem)
app.use(Popup)
app.use(Form)
app.use(Field)
app.use(CellGroup)
app.use(RadioGroup)
app.use(Radio)
app.use(Button)
app.use(NoticeBar)
app.use(Dialog)
// showToast is a function, not a component to use, but we can attach it if needed or import directly

app.mount('#app')

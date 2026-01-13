import './style.css'
import { Router } from './router/Router.js'
import { homePage } from './pages/Home.js'
import { arPage } from './pages/AR/AR.js'
import { forLLMPage } from './pages/ForLLM/ForLLM.js'

// Define routes
const routes = [
  { path: '/', handler: homePage },
  { path: '/ar', handler: arPage },
  { path: '/forllm', handler: forLLMPage },
  { path: '*', handler: homePage }
]

// Initialize router
const router = new Router(routes)
Router.instance = router
router.init()

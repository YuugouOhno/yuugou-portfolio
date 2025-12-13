/**
 * Simple History API based router
 */
export class Router {
  constructor(routes) {
    this.routes = routes
    this.currentCleanup = null
    this.currentPath = null
  }

  init() {
    // Handle browser back/forward
    window.addEventListener('popstate', () => this.handleRoute())

    // Handle initial route
    this.handleRoute()
  }

  handleRoute() {
    const path = window.location.pathname

    // Skip if same path
    if (path === this.currentPath) return
    this.currentPath = path

    // Clean up previous route
    if (this.currentCleanup) {
      this.currentCleanup()
      this.currentCleanup = null
    }

    // Find matching route
    const route = this.routes.find(r => r.path === path)
      || this.routes.find(r => r.path === '*')

    if (route) {
      this.currentCleanup = route.handler()
    }
  }

  navigate(path) {
    if (path === this.currentPath) return
    window.history.pushState({}, '', path)
    this.handleRoute()
  }

  // Static method to get router instance
  static instance = null

  static getInstance() {
    return Router.instance
  }
}

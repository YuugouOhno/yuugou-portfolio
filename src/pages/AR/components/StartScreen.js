import { Router } from '../../../router/Router.js'

export function StartScreen({ onStart }) {
  const screen = document.createElement('div')
  screen.className = 'ar-start-screen'

  screen.innerHTML = `
    <a href="/" class="ar-back-link">
      <span>&larr;</span>
      <span>Back</span>
    </a>
    <div class="ar-start-content">
      <h1>AR Experience</h1>
      <p>Point your camera at my business card to see the magic!</p>
      <p class="ar-sub">Or watch the fish swim around you.</p>
      <button class="ar-start-btn">Start AR</button>
      <p class="ar-permission-note">Camera access required</p>
    </div>
  `

  // Handle back link
  const backLink = screen.querySelector('.ar-back-link')
  backLink.addEventListener('click', (e) => {
    e.preventDefault()
    const router = Router.getInstance()
    if (router) {
      router.navigate('/')
    } else {
      window.location.href = '/'
    }
  })

  // Handle start button
  const startBtn = screen.querySelector('.ar-start-btn')
  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true
    startBtn.textContent = 'Starting...'
    try {
      await onStart()
    } catch (error) {
      console.error('Failed to start AR:', error)
      startBtn.disabled = false
      startBtn.textContent = 'Start AR'
    }
  })

  return screen
}

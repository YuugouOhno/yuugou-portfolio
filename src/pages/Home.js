// Preserve the pre-existing global section styling used by ForLLM.
import '../components/App.css'
import './Home.css'
import { Router } from '../router/Router.js'

export function homePage() {
  const app = document.getElementById('app')
  document.documentElement.classList.add('home-active')
  app.innerHTML = `
    <div class="home-page">
      <div class="home-ocean" aria-hidden="true"></div>
      <header class="home-header">
        <a href="#home" aria-label="ページの先頭へ">YuugouOhno</a>
        <nav aria-label="メインナビゲーション"><a href="#profile">プロフィール</a></nav>
        <button type="button" class="motion-toggle" aria-pressed="false" hidden>魚の動きを止める</button>
      </header>
      <main>
        <section id="home" class="home-hero" aria-labelledby="home-name">
          <div class="home-intro">
            <h1 id="home-name">YuugouOhno</h1>
            <p>大野優剛</p>
          </div>
          <a class="home-scroll" href="#profile">プロフィールへ <span aria-hidden="true">↓</span></a>
        </section>
        <section id="profile" class="home-profile" aria-labelledby="profile-title" tabindex="-1">
          <div class="home-copy">
            <p class="home-label">Profile</p>
            <h2 id="profile-title">大野優剛</h2>
            <p>ソフトウェアエンジニア。</p>
            <p>このページは、名前を形作る魚たちと、ゆっくり読み進められるプロフィールの試作です。詳しい紹介は、これから整えていきます。</p>
            <div class="home-links">
              <a href="https://x.com/YuugouOhno" target="_blank" rel="noopener noreferrer">X / YuugouOhno ↗</a>
              <a href="/forllm" data-route>AI向けの構造化情報</a>
              <a href="/ar" data-route>ARを開く</a>
            </div>
          </div>
        </section>
      </main>
      <footer class="home-footer"><span>YuugouOhno</span><a href="#home">先頭へ ↑</a></footer>
    </div>`

  const page = app.querySelector('.home-page')
  const container = page.querySelector('.home-ocean')
  const hero = page.querySelector('.home-hero')
  const toggle = page.querySelector('.motion-toggle')
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  let scene = null
  let disposed = false
  let generation = 0
  let firstFrame = 0
  let secondFrame = 0
  // Preserve the release latch across motion preference changes within this visit.
  const visit = { released: false }
  const stop = () => {
    generation++
    cancelAnimationFrame(firstFrame)
    cancelAnimationFrame(secondFrame)
    scene?.dispose()
    scene = null
    page.classList.remove('has-fish', 'fish-paused')
    toggle.hidden = true
  }
  const start = () => {
    stop()
    if (disposed || media.matches) return
    const request = generation
    // Let ordinary HTML paint before loading and compiling the optional scene.
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(async () => {
        try {
          const { Scene } = await import('../webgl/Scene.js')
          if (disposed || request !== generation) return
          scene = new Scene(container, hero, visit, stop)
          scene.init()
          page.classList.add('has-fish')
          toggle.hidden = false
          toggle.setAttribute('aria-pressed', 'false')
          toggle.textContent = '魚の動きを止める'
        } catch (error) {
          if (request !== generation) return
          stop()
          console.warn('Home fish unavailable; HTML remains available.', error)
        }
      })
    })
  }
  const onToggle = () => {
    if (!scene) return
    const paused = scene.setPaused(!scene.paused)
    page.classList.toggle('fish-paused', paused)
    toggle.setAttribute('aria-pressed', String(paused))
    toggle.textContent = paused ? '魚の動きを再開する' : '魚の動きを止める'
  }
  const onClick = (event) => {
    const link = event.target.closest('a[data-route]')
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    Router.getInstance().navigate(link.getAttribute('href'))
  }
  page.addEventListener('click', onClick)
  toggle.addEventListener('click', onToggle)
  media.addEventListener('change', start)
  start()
  return () => {
    disposed = true
    stop()
    media.removeEventListener('change', start)
    page.removeEventListener('click', onClick)
    toggle.removeEventListener('click', onToggle)
    document.documentElement.classList.remove('home-active')
    page.remove()
  }
}

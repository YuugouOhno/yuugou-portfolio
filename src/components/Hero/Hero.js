import './Hero.css'

export function Hero({ onClose, onSummon } = {}) {
  const section = document.createElement('section')
  section.id = 'hero'

  section.innerHTML = `
    <div class="hero-card">
      <button class="hero-close" type="button" aria-label="閉じる">×</button>
      <div class="hero-icon">
        <img src="/icon.png" alt="YuugouOhno" />
      </div>
      <div class="hero-info">
        <h1 class="hero-name">Yuugou Ohno</h1>
        <p class="hero-affiliation">Software Engineer</p>
      </div>
    </div>
  `

  const card = section.querySelector('.hero-card')
  section.querySelector('.hero-close').addEventListener('click', (e) => {
    e.stopPropagation()
    onClose?.()
  })
  // While towed by a fish, clicking the card brings it back
  card.addEventListener('click', () => {
    if (card.classList.contains('is-towed')) onSummon?.()
  })

  return section
}

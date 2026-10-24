import './TagPanel.css'

// Title size in CSS px; the line box matches the ribbon texture (64px font in 84px)
export const TAG_TITLE_FONT = 28
export const TAG_TITLE_LINE = TAG_TITLE_FONT * (84 / 64)
export const TAG_PANEL_PAD = 28

// Panel that a towed tag unfolds into. The title sits where the ribbon text was.
export function TagPanel({ title, body, onClose }) {
  const panel = document.createElement('div')
  panel.className = 'tag-panel'
  panel.style.setProperty('--pad', `${TAG_PANEL_PAD}px`)
  panel.style.setProperty('--title-font', `${TAG_TITLE_FONT}px`)
  panel.style.setProperty('--title-line', `${TAG_TITLE_LINE}px`)
  panel.innerHTML = `
    <button class="tag-panel-close" type="button" aria-label="閉じる">×</button>
    <h2 class="tag-panel-title"></h2>
    <div class="tag-panel-body"></div>
  `
  panel.querySelector('.tag-panel-title').textContent = title
  panel.querySelector('.tag-panel-body').innerHTML = body ?? ''
  panel.querySelector('.tag-panel-close').addEventListener('click', (e) => {
    e.stopPropagation()
    onClose?.()
  })
  return panel
}

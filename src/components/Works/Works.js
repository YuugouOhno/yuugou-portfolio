import './Works.css'

export function Works() {
  const section = document.createElement('section')
  section.id = 'works'

  section.innerHTML = `
    <div class="works-content">
    </div>
  `

  return section
}

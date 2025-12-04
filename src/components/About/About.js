import './About.css'

export function About() {
  const section = document.createElement('section')
  section.id = 'about'

  section.innerHTML = `
    <div class="about-content">
    </div>
  `

  return section
}

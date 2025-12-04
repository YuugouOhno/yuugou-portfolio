import './Contact.css'

export function Contact() {
  const section = document.createElement('section')
  section.id = 'contact'

  section.innerHTML = `
    <div class="contact-content">
    </div>
  `

  return section
}

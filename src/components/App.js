import { Header } from './Header/Header.js'
import { Hero } from './Hero/Hero.js'
import { About } from './About/About.js'
import { Works } from './Works/Works.js'
import { Contact } from './Contact/Contact.js'
import './App.css'

export function App() {
  const container = document.createElement('div')
  container.id = 'app-content'

  container.appendChild(Header())
  container.appendChild(Hero())
  // container.appendChild(About())
  // container.appendChild(Works())
  // container.appendChild(Contact())

  return container
}

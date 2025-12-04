import './Header.css'

export function Header() {
  const header = document.createElement('header')
  header.id = 'header'

  header.innerHTML = `
    <div class="header-logo">YuugouOhno</div>
  `

  return header
}

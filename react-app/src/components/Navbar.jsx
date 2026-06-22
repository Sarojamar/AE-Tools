import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../styles/global-nav.css'

const TOOLS = [
  {
    label: 'Passport Photo Studio',
    desc: 'On-device AI · Remove background instantly',
    icon: 'ph ph-identification-badge',
    href: '/passport-photo'
  },
  {
    label: 'Image & File Toolkit',
    desc: 'Convert, resize & compress with KB targeting',
    icon: 'ph ph-file-arrow-up',
    href: '/file-converter'
  },
  {
    label: 'ID Card Layout Studio',
    desc: 'Print-ready A4 & PVC card layouts',
    icon: 'ph ph-printer',
    href: '/id-card-printer'
  },
]

export default function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('amrit-theme') || 'light')
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const triggerRef = useRef(null)
  const searchRef = useRef(null)

  // Apply theme to html element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('amrit-theme', theme)
  }, [theme])

  // Scroll shrink
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const filteredTools = searchQuery.trim()
    ? TOOLS.filter(t =>
        t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  return (
    <nav className={`global-navbar${scrolled ? ' scrolled' : ''}`} id="global-navbar">
      <div className="nav-left">
        <Link to="/" className="nav-logo">
          <div className="logo-icon">A</div>
          <span className="logo-text">Amrit <span>Enterprises</span></span>
        </Link>
      </div>

      <div className="nav-center">
        <div className="nav-search-wrapper" ref={searchRef}>
          <i className="ph ph-magnifying-glass search-icon"></i>
          <input
            type="text"
            className="nav-search"
            id="nav-search"
            placeholder="Search tools…"
            autoComplete="off"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
            onFocus={() => { if (searchQuery) setSearchOpen(true) }}
            onKeyDown={handleSearchKeyDown}
          />
          <div className={`search-results${searchOpen && searchQuery ? ' visible' : ''}`}>
            {filteredTools.length === 0 && searchQuery ? (
              <div className="search-empty">No tools found</div>
            ) : (
              filteredTools.map(t => (
                <Link
                  key={t.href}
                  to={t.href}
                  className="search-result-item"
                  onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                >
                  <i className={t.icon}></i>
                  <span>{t.label}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="nav-right">
        <button className="theme-toggle" id="theme-toggle" title="Toggle theme" onClick={toggleTheme}>
          <i className={`ph ${theme === 'dark' ? 'ph-sun' : 'ph-moon'}`} id="theme-icon"></i>
        </button>
        <button className="mobile-menu-btn" id="mobile-menu-btn" aria-label="Menu">
          <i className="ph ph-list"></i>
        </button>
      </div>
    </nav>
  )
}

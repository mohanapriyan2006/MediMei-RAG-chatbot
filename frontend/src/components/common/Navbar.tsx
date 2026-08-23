import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Menu,
  X,
  ArrowRight,
  LogOut,
  MessageSquare,
  FileText,
  BookOpen,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useSectionNavigation } from '../../hooks/useSectionNavigation'
import { ThemeToggle } from './ThemeToggle'

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const { navigateToSection } = useSectionNavigation()

  const navLinks = [
    { name: 'Home', path: '/home', isSection: false },
    { name: 'About', path: '/about', isSection: false },
    { name: 'Demo', path: '/demo', isSection: false },
    { name: 'How It Works', path: '/home#how-it-works', isSection: true },
    { name: 'FAQ', path: '/home#faq', isSection: true },
  ]

  const isActive = (path: string) => {
    if (path.startsWith('/#')) return false
    return location.pathname === path
  }

  const handleNavClick = (path: string, isSection: boolean) => {
    setMobileMenuOpen(false)
    if (isSection) {
      navigateToSection(path)
      return
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/92 backdrop-blur-xl theme-transition">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-subtle transition-all duration-200 group-hover:shadow-card">
            <img src="/logo.png" alt="MediMei" className="h-8 w-8 object-contain" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight text-primary">MediMei</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-accent opacity-80">Clinical AI</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {navLinks.map((link) =>
            link.isSection ? (
              <button
                key={link.name}
                type="button"
                onClick={() => navigateToSection(link.path)}
                className="rounded-pill px-3.5 py-2 text-sm font-medium text-fg-secondary transition-all duration-150 hover:bg-surface-highlight hover:text-fg"
              >
                {link.name}
              </button>
            ) : (
              <Link
                key={link.name}
                to={link.path}
                className={`rounded-pill px-3.5 py-2 text-sm font-medium transition-all duration-150 ${
                  isActive(link.path)
                    ? 'bg-surface-highlight font-semibold text-primary shadow-subtle'
                    : 'text-fg-secondary hover:bg-surface-highlight hover:text-fg'
                }`}
              >
                {link.name}
              </Link>
            ),
          )}
        </nav>

        {/* Desktop Right Actions */}
        <div className="hidden items-center gap-2.5 md:flex">
          <ThemeToggle size="md" />

          {user ? (
            <>
              <Link
                to="/documents"
                className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-xs font-semibold text-fg shadow-subtle transition-all duration-150 hover:border-primary/40 hover:text-primary hover:shadow-card"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Documents</span>
              </Link>

              <Link
                to="/chat"
                className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-card transition-all duration-150 hover:bg-primary-hover active:scale-[0.97]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Assistant</span>
                <ArrowRight className="h-3 w-3" />
              </Link>

              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-pill text-fg-muted transition-colors duration-150 hover:bg-surface-highlight hover:text-danger"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className="px-3 py-2 text-sm font-semibold text-fg-secondary transition-colors duration-150 hover:text-primary"
              >
                Sign In
              </Link>
              <Link
                to="/chat"
                className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-all duration-150 hover:bg-primary-hover active:scale-[0.97]"
              >
                <span>Ask AI</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile: Theme toggle + Hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle size="sm" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-2xl text-fg transition-colors hover:bg-surface-highlight"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="animate-fade-in border-b border-border bg-surface px-5 py-5 shadow-hover md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navLinks.map((link) =>
              link.isSection ? (
                <button
                  key={link.name}
                  type="button"
                  onClick={() => handleNavClick(link.path, true)}
                  className="rounded-pill px-3 py-2.5 text-left text-sm font-medium text-fg transition-colors hover:bg-surface-highlight"
                >
                  {link.name}
                </button>
              ) : (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-pill px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? 'bg-surface-highlight font-semibold text-primary'
                      : 'text-fg hover:bg-surface-highlight'
                  }`}
                >
                  {link.name}
                </Link>
              ),
            )}
          </nav>

          <div className="mt-4 flex flex-col gap-2.5 border-t border-border pt-4">
            {user ? (
              <>
                <Link
                  to="/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-pill bg-primary py-3 text-sm font-semibold text-white"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Open Chat Assistant</span>
                </Link>
                <Link
                  to="/documents"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-pill border border-border bg-surface py-2.5 text-sm font-semibold text-fg"
                >
                  <FileText className="h-4 w-4" />
                  <span>Manage Documents</span>
                </Link>
                <Link
                  to="/drugs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-pill border border-border bg-surface py-2.5 text-sm font-semibold text-fg"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Drug Library</span>
                </Link>
                <button
                  type="button"
                  onClick={() => { logout(); setMobileMenuOpen(false) }}
                  className="flex w-full items-center justify-center gap-2 rounded-pill py-2.5 text-sm font-semibold text-danger"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/signin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-pill border border-border bg-surface py-2.5 text-sm font-semibold text-fg"
                >
                  Sign In
                </Link>
                <Link
                  to="/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-pill bg-primary py-3 text-sm font-semibold text-white"
                >
                  <span>Ask AI</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default Navbar

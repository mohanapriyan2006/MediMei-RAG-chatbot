import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { parseSectionIdFromPath, scrollToSection, scrollToSectionWhenReady } from '../utils/scrollToSection'

export function useSectionNavigation() {
  const location = useLocation()
  const navigate = useNavigate()

  const navigateToSection = useCallback(
    (path: string) => {
      const sectionId = parseSectionIdFromPath(path)
      if (!sectionId) {
        navigate(path)
        return
      }

      const isHome = location.pathname === '/' || location.pathname === '/home'
      if (isHome) {
        window.history.replaceState(null, '', `/home#${sectionId}`)
        scrollToSection(sectionId)
        return
      }

      navigate(`/home#${sectionId}`)
    },
    [location.pathname, navigate],
  )

  return { navigateToSection, scrollToSectionWhenReady }
}

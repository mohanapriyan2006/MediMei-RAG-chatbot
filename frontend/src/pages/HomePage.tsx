import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Navbar } from '../components/common/Navbar'
import { Footer } from '../components/common/Footer'
import { useDocuments } from '../hooks/useDocuments'
import { scrollToSectionWhenReady } from '../utils/scrollToSection'
import { HeroSection } from '../components/home/HeroSection'
import { TrustSection } from '../components/home/TrustSection'
import { DrugCategoriesSection } from '../components/home/DrugCategoriesSection'
import { HowItWorksSection } from '../components/home/HowItWorksSection'
import { VerificationSection } from '../components/home/VerificationSection'
import { KnowledgeBaseSection } from '../components/home/KnowledgeBaseSection'
import { FaqSection } from '../components/home/FaqSection'
import { FinalCtaSection } from '../components/home/FinalCtaSection'

export default function HomePage() {
  const location = useLocation()
  const { documents } = useDocuments()
  const readyDocs = documents.filter((d) => d.status === 'ready')

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (!(location.pathname === '/' || location.pathname === '/home') || !hash) return
    scrollToSectionWhenReady(hash)
  }, [location.hash, location.pathname])

  return (
    <div className="min-h-screen flex flex-col bg-background text-fg">
      <Navbar />

      <main className="flex-1">
        <HeroSection />
        <TrustSection />
        <DrugCategoriesSection />
        <HowItWorksSection />
        <VerificationSection />
        <KnowledgeBaseSection readyCount={readyDocs.length} />
        <FaqSection />
        <FinalCtaSection />
      </main>

      <Footer />
    </div>
  )
}

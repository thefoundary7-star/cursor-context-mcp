import { HeroSection } from '@/components/landing/hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { PricingSection } from '@/components/landing/pricing-section'
import { TestimonialsSection } from '@/components/landing/testimonials-section'
import { DemoSection } from '@/components/landing/demo-section'
import { CTASection } from '@/components/landing/cta-section'
import { Footer } from '@/components/landing/footer'
import { LandingHeader } from '@/components/landing/header'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <DemoSection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}

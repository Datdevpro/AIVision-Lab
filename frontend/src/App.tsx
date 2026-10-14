import React, { useEffect, useState } from 'react'
import { Header } from '@/components/common/Header'
import { LessonModal } from '@/components/common/LessonModal'
import { OnboardingModal } from '@/components/common/OnboardingModal'
import { AnalyticsWorkspace } from '@/features/analytics/AnalyticsWorkspace'
import { DatasetStudio } from '@/features/dataset/DatasetStudio'
import { LiveInference } from '@/features/inference/LiveInference'
import { TrainingControl } from '@/features/training/TrainingControl'
import { useLabStore } from '@/store/useLabStore'

export const App: React.FC = () => {
  const { fetchSystem, loadProjects, checkActiveJob, setTheme } = useLabStore()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    fetchSystem()
    loadProjects()
    checkActiveJob()

    // Initialize theme from storage
    const savedTheme = (localStorage.getItem('visionlab_theme') as 'dark' | 'light') || 'dark'
    setTheme(savedTheme)

    // Show onboarding for first-time visitors
    const seen = localStorage.getItem('visionlab_onboarded')
    if (!seen) {
      setShowOnboarding(true)
      localStorage.setItem('visionlab_onboarded', 'true')
    }
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col bg-[#07090e] text-slate-100 overflow-hidden font-sans transition-colors duration-200">
      {/* Top Header */}
      <Header />

      {/* Main Workspace (3 columns) */}
      <main className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">
        {/* Left Column: Dataset Studio (~28% -> col-span-3 or 4) */}
        <section className="col-span-3 min-h-0 overflow-hidden h-full">
          <DatasetStudio />
        </section>

        {/* Center Column: Training Control (~30% -> col-span-4) */}
        <section className="col-span-4 min-h-0 overflow-hidden h-full">
          <TrainingControl />
        </section>

        {/* Right Column: Live Inference (~42% -> col-span-5) */}
        <section className="col-span-5 min-h-0 overflow-hidden h-full">
          <LiveInference />
        </section>
      </main>

      {/* Bottom Tabbed Analytics Laboratory */}
      <AnalyticsWorkspace />

      {/* Global Modals */}
      <LessonModal />
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  )
}

export default App

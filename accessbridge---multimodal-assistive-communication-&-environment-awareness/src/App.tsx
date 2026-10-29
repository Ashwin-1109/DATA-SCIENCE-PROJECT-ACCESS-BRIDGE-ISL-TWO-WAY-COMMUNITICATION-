/**
 * AccessBridge - Multimodal Assistive Communication & Environment Awareness System
 * Karunya Institute of Technology and Sciences
 * Department of Computer Science & Engineering (AI & ML)
 * 
 * Optimized with React.lazy code-splitting, Suspense, and resilient ErrorBoundaries
 * around every page and 3D avatar viewport.
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { NavigationTab, AccessibilitySettings } from './types';
import { storageService } from './services/storageService';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// Lazy-loaded heavy modules for maximum bundle optimization
const DeafInterface = lazy(() => import('./pages/DeafInterface').then(m => ({ default: m.DeafInterface })));
const MuteInterface = lazy(() => import('./pages/MuteInterface').then(m => ({ default: m.MuteInterface })));
const BlindInterface = lazy(() => import('./pages/BlindInterface').then(m => ({ default: m.BlindInterface })));
const ProcessorPanel = lazy(() => import('./pages/ProcessorPanel').then(m => ({ default: m.ProcessorPanel })));
const HomeReadiness = lazy(() => import('./pages/HomeReadiness').then(m => ({ default: m.HomeReadiness })));
const SignCommunication = lazy(() => import('./pages/SignCommunication').then(m => ({ default: m.SignCommunication })));
const RecordSign = lazy(() => import('./pages/RecordSign').then(m => ({ default: m.RecordSign })));
const LiveCaptions = lazy(() => import('./pages/LiveCaptions').then(m => ({ default: m.LiveCaptions })));
const EnvironmentReader = lazy(() => import('./pages/EnvironmentReader').then(m => ({ default: m.EnvironmentReader })));
const DataScienceLab = lazy(() => import('./pages/DataScienceLab').then(m => ({ default: m.DataScienceLab })));
const EvaluationDashboard = lazy(() => import('./pages/EvaluationDashboard').then(m => ({ default: m.EvaluationDashboard })));
const Diagnostics = lazy(() => import('./pages/Diagnostics').then(m => ({ default: m.Diagnostics })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

// Accessible loading fallback
const PageLoader: React.FC<{ label?: string }> = ({ label = 'Loading assistive module...' }) => (
  <div 
    role="status" 
    aria-live="polite"
    className="min-h-[50vh] flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-3"
  >
    <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
    </div>
    <span className="text-xs font-mono font-medium text-slate-300">{label}</span>
    <span className="sr-only">Please wait, loading interface</span>
  </div>
);

export default function App() {
  // Default to the first tailored assistive interface: Deaf Assist
  const [activeTab, setActiveTab] = useState<NavigationTab>('deaf');
  const [settings, setSettings] = useState<AccessibilitySettings>(() => storageService.getSettings());
  const [activeModelName, setActiveModelName] = useState<string | null>(() => storageService.getActiveSignModel());

  const handleUpdateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      storageService.saveSettings(updated);
      return updated;
    });
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + 1-8 for instant accessible mode navigation
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === '1') { e.preventDefault(); setActiveTab('deaf'); }
        if (e.key === '2') { e.preventDefault(); setActiveTab('mute'); }
        if (e.key === '3') { e.preventDefault(); setActiveTab('blind'); }
        if (e.key === '4') { e.preventDefault(); setActiveTab('processor'); }
        if (e.key === '5') { e.preventDefault(); setActiveTab('lab'); }
        if (e.key === '6') { e.preventDefault(); setActiveTab('evaluation'); }
        if (e.key === '7') { e.preventDefault(); setActiveTab('settings'); }
        if (e.key === '8') { e.preventDefault(); setActiveTab('diagnostics'); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getFontSizeClass = () => {
    if (settings.fontSize === 'large') return 'font-size-large';
    if (settings.fontSize === 'extralarge') return 'font-size-extralarge';
    return '';
  };

  return (
    <div className={`min-h-screen flex flex-col bg-[#070B14] text-slate-100 ${settings.highContrast ? 'high-contrast' : ''} ${settings.reducedMotion ? 'reduced-motion' : ''} ${getFontSizeClass()}`}>
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-sky-600 focus:text-white focus:font-bold focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip directly to main content
      </a>

      {/* Primary Accessible Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        activeModelName={activeModelName}
      />

      {/* Main Content Viewport */}
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <Suspense fallback={<PageLoader label={`Loading ${activeTab.toUpperCase()} Module...`} />}>
          {/* 1. Tailored UI System for DEAF & Hard-of-Hearing */}
          {activeTab === 'deaf' && (
            <ErrorBoundary componentName="Deaf Interface">
              <DeafInterface onNavigate={setActiveTab} />
            </ErrorBoundary>
          )}

          {/* 2. Tailored UI System for MUTE & Non-Verbal Speech Impaired */}
          {activeTab === 'mute' && (
            <ErrorBoundary componentName="Mute Interface">
              <MuteInterface
                onNavigate={setActiveTab}
                activeModelName={activeModelName}
              />
            </ErrorBoundary>
          )}

          {/* 3. Tailored UI System for BLIND & Low-Vision */}
          {activeTab === 'blind' && (
            <ErrorBoundary componentName="Blind Interface">
              <BlindInterface onNavigate={setActiveTab} />
            </ErrorBoundary>
          )}

          {/* 4. Departed Technical Processor & Admin Panel */}
          {activeTab === 'processor' && (
            <ErrorBoundary componentName="Processor Panel">
              <ProcessorPanel
                onNavigate={setActiveTab}
                activeModelName={activeModelName}
                onModelChanged={setActiveModelName}
              />
            </ErrorBoundary>
          )}

          {/* Underlying Specific Modules (Jumpable from Secondary Navigation) */}
          {activeTab === 'home' && (
            <ErrorBoundary componentName="Home Readiness">
              <HomeReadiness
                onNavigate={setActiveTab}
                onModelLoaded={setActiveModelName}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'sign' && (
            <ErrorBoundary componentName="Sign Communication">
              <SignCommunication
                onNavigate={setActiveTab}
                activeModelName={activeModelName}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'record' && (
            <ErrorBoundary componentName="Record Sign">
              <RecordSign onNavigateBack={() => setActiveTab('sign')} />
            </ErrorBoundary>
          )}

          {activeTab === 'captions' && (
            <ErrorBoundary componentName="Live Captions">
              <LiveCaptions onNavigate={setActiveTab} />
            </ErrorBoundary>
          )}

          {activeTab === 'environment' && (
            <ErrorBoundary componentName="Environment Reader">
              <EnvironmentReader onNavigate={setActiveTab} />
            </ErrorBoundary>
          )}

          {activeTab === 'lab' && (
            <ErrorBoundary componentName="Data Science Lab">
              <DataScienceLab
                onNavigate={setActiveTab}
                onModelTrainedAndLoaded={setActiveModelName}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'evaluation' && (
            <ErrorBoundary componentName="Evaluation Dashboard">
              <EvaluationDashboard onNavigate={setActiveTab} />
            </ErrorBoundary>
          )}

          {activeTab === 'diagnostics' && (
            <ErrorBoundary componentName="Diagnostics Audit">
              <Diagnostics onNavigate={setActiveTab} />
            </ErrorBoundary>
          )}

          {activeTab === 'settings' && (
            <ErrorBoundary componentName="Settings">
              <Settings
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onNavigate={setActiveTab}
              />
            </ErrorBoundary>
          )}
        </Suspense>
      </main>

      {/* Accessible Academic Footer */}
      <Footer />
    </div>
  );
}

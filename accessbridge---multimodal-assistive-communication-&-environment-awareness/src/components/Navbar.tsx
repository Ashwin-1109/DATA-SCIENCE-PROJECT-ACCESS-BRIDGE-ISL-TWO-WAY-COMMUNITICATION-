import React from 'react';
import { 
  ShieldCheck, 
  Hand, 
  Mic, 
  Eye, 
  FlaskConical, 
  BarChart3, 
  Settings as SettingsIcon,
  Sun,
  Moon,
  Type,
  Ear,
  MicOff,
  Cpu,
  Camera,
  Activity
} from 'lucide-react';
import { NavigationTab, AccessibilitySettings } from '../types';

interface NavbarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  settings: AccessibilitySettings;
  onUpdateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  activeModelName: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  settings,
  onUpdateSettings,
  activeModelName
}) => {
  // The 3 Tailored User Interface Systems + Departed Technical Processor Panel
  const coreModes: { id: NavigationTab; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
    { 
      id: 'deaf', 
      label: 'Deaf Assist', 
      icon: <Ear className="w-4 h-4" />, 
      color: activeTab === 'deaf' ? 'bg-sky-600 text-white' : 'hover:bg-slate-800 text-sky-400',
      desc: 'Visual-First Captions & Sound Flasher'
    },
    { 
      id: 'mute', 
      label: 'Mute Assist', 
      icon: <MicOff className="w-4 h-4" />, 
      color: activeTab === 'mute' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-emerald-400',
      desc: 'Sign-to-Speech & AAC Quick Soundboard'
    },
    { 
      id: 'blind', 
      label: 'Blind Assist', 
      icon: <Eye className="w-4 h-4" />, 
      color: activeTab === 'blind' ? 'bg-amber-400 text-black font-bold' : 'hover:bg-slate-800 text-amber-300',
      desc: 'Spatial Audio Narrator & Label OCR'
    },
    { 
      id: 'processor', 
      label: 'Technical Processor', 
      icon: <Cpu className="w-4 h-4" />, 
      color: activeTab === 'processor' ? 'bg-purple-600 text-white' : 'hover:bg-slate-800 text-purple-300',
      desc: 'Hardware Telemetry, Lab & Model Swapper'
    },
  ];

  // Secondary detailed module views
  const secondaryTabs: { id: NavigationTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Readiness', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'sign', label: 'ISL Sign Camera', icon: <Hand className="w-3.5 h-3.5" /> },
    { id: 'record', label: 'Record Sign', icon: <Camera className="w-3.5 h-3.5" /> },
    { id: 'captions', label: 'Live Captions', icon: <Mic className="w-3.5 h-3.5" /> },
    { id: 'environment', label: 'Environment Reader', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'lab', label: 'Data Science Lab', icon: <FlaskConical className="w-3.5 h-3.5" /> },
    { id: 'evaluation', label: 'Evaluation Benchmarks', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'diagnostics', label: 'Diagnostics', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-3.5 h-3.5" /> },
  ];

  const cycleFontSize = () => {
    if (settings.fontSize === 'normal') onUpdateSettings({ fontSize: 'large' });
    else if (settings.fontSize === 'large') onUpdateSettings({ fontSize: 'extralarge' });
    else onUpdateSettings({ fontSize: 'normal' });
  };

  const getFontSizeLabel = () => {
    if (settings.fontSize === 'large') return 'A+ (115%)';
    if (settings.fontSize === 'extralarge') return 'A++ (130%)';
    return 'A (100%)';
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0B1120] border-b border-slate-800 shadow-md">
      {/* Top Branding & Accessibility Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-lg shadow-sm" aria-hidden="true">
            AB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-white">AccessBridge</span>
              <span className="text-slate-500 text-xs hidden sm:inline" aria-hidden="true">·</span>
              <span className="text-slate-400 text-xs hidden sm:inline">Multimodal Assistive System</span>
            </div>
            <div className="text-slate-500 text-xs">
              Karunya Institute of Technology and Sciences · B.Tech CSE AI & ML
            </div>
          </div>
        </div>

        {/* Global Accessibility Quick Toggles */}
        <div className="flex items-center gap-2">
          {/* Active Model Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 pr-3 border-r border-slate-800">
            <span className="text-slate-500">Sign Model:</span>
            <span className={activeModelName ? "text-sky-400 font-medium" : "text-amber-400 font-medium"}>
              {activeModelName || 'Model not trained'}
            </span>
          </div>

          {/* Font Size Toggle */}
          <button
            onClick={cycleFontSize}
            className="min-h-[40px] px-2.5 py-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            title="Toggle text size for readability"
            aria-label={`Change text size. Current: ${getFontSizeLabel()}`}
          >
            <Type className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
            <span>{getFontSizeLabel()}</span>
          </button>

          {/* High Contrast Toggle */}
          <button
            onClick={() => onUpdateSettings({ highContrast: !settings.highContrast })}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              settings.highContrast 
                ? 'bg-amber-400 text-black font-semibold' 
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Toggle high-contrast display mode"
            aria-pressed={settings.highContrast}
          >
            {settings.highContrast ? (
              <Sun className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            )}
            <span>{settings.highContrast ? 'High Contrast ON' : 'High Contrast'}</span>
          </button>
        </div>
      </div>

      {/* Primary UI Systems Switcher (Deaf, Mute, Blind, and Processor) */}
      <div className="bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hidden md:inline pr-2">
              Assistive Interfaces:
            </span>

            {coreModes.map(mode => {
              const isSelected = activeTab === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => onTabChange(mode.id)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    isSelected
                      ? mode.color
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                  }`}
                  aria-pressed={isSelected}
                  title={mode.desc}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-slate-800 text-xs">
            <button
              onClick={() => onTabChange('settings')}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Settings & Audio preferences"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Quick-Jump Modules Bar */}
      <nav 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-none"
        aria-label="Secondary Modules"
      >
        <div className="flex items-center gap-1 py-1 min-w-max text-[11px]">
          <span className="text-slate-400 pr-1 font-mono">Modules:</span>
          {secondaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`min-h-[32px] px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 ${
                  isActive
                    ? 'bg-slate-800 text-sky-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};

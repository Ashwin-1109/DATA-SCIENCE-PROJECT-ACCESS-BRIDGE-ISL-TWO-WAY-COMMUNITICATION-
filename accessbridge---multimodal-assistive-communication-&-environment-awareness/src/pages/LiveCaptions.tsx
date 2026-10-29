import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Copy, 
  Trash2, 
  Download, 
  Languages, 
  Globe, 
  AlertCircle,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { CaptionItem, NavigationTab } from '../types';
import { captionService } from '../services/captionService';
import { storageService } from '../services/storageService';
import { ttsService } from '../services/ttsService';

interface LiveCaptionsProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const LiveCaptions: React.FC<LiveCaptionsProps> = ({ onNavigate }) => {
  const [isListening, setIsListening] = useState(false);
  const [captionLanguage, setCaptionLanguage] = useState<'en' | 'ta'>('en');
  const [currentInterimText, setCurrentInterimText] = useState('');
  const [captionList, setCaptionList] = useState<CaptionItem[]>(() => storageService.getCaptionHistory());
  const [processingState, setProcessingState] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [fontSizeClass, setFontSizeClass] = useState<'text-xl' | 'text-2xl' | 'text-3xl'>('text-2xl');

  const captionContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of transcripts
  useEffect(() => {
    if (captionContainerRef.current) {
      captionContainerRef.current.scrollTop = captionContainerRef.current.scrollHeight;
    }
  }, [captionList, currentInterimText]);

  // Clean stop on component unmount
  useEffect(() => {
    return () => {
      captionService.stopListening();
    };
  }, []);

  const handleToggleListening = () => {
    setErrorMessage(null);

    if (isListening) {
      captionService.stopListening();
      setIsListening(false);
      setProcessingState('idle');
      setCurrentInterimText('');
    } else {
      const started = captionService.startListening(
        captionLanguage,
        (caption) => {
          if (caption.isFinal) {
            setCaptionList(prev => {
              const updated = [...prev, caption];
              storageService.saveCaptionHistory(updated);
              return updated;
            });
            setCurrentInterimText('');

            // Also record to shared conversation
            const convTurns = storageService.getConversation();
            storageService.saveConversation([
              ...convTurns,
              {
                id: caption.id,
                timestamp: caption.timestamp,
                sender: 'speaker',
                text: caption.text,
                confidence: caption.confidence
              }
            ]);
          } else {
            setCurrentInterimText(caption.text);
          }
        },
        (err) => {
          setErrorMessage(err);
          setIsListening(false);
          setProcessingState('idle');
        },
        (state) => {
          setProcessingState(state === 'stopped' ? 'idle' : state);
        }
      );

      if (started) {
        setIsListening(true);
      }
    }
  };

  const handleClearHistory = () => {
    setCaptionList([]);
    storageService.clearCaptionHistory();
    setCurrentInterimText('');
  };

  const handleCopyTranscript = async () => {
    const fullText = captionList.map(c => `[${c.timestamp}] ${c.text}`).join('\n');
    if (fullText) {
      await navigator.clipboard.writeText(fullText);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    }
  };

  const handleExportTranscript = () => {
    const data = {
      exportDate: new Date().toISOString(),
      language: captionLanguage,
      totalCaptions: captionList.length,
      captions: captionList
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AccessBridge_LiveCaptions_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header and Scope */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold tracking-wider uppercase">
            <span>Workflow 2</span>
            <span aria-hidden="true">·</span>
            <span>Speech → Readable Live Text</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Live Speech Captioning
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time microphone capture with chunked transcription, high legibility, and bilingual language support.
          </p>
        </div>

        {/* Language & Engine Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              onClick={() => {
                if (isListening) handleToggleListening();
                setCaptionLanguage('en');
              }}
              className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                captionLanguage === 'en' 
                  ? 'bg-sky-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              English (en-IN / en-US)
            </button>
            <button
              onClick={() => {
                if (isListening) handleToggleListening();
                setCaptionLanguage('ta');
              }}
              className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                captionLanguage === 'ta' 
                  ? 'bg-sky-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tamil (தமிழ்)
            </button>
          </div>
        </div>
      </div>

      {/* Language Scope Note for Tamil */}
      {captionLanguage === 'ta' && (
        <div className="p-3.5 bg-sky-950/40 border border-sky-800/50 rounded-xl text-sky-300 text-xs flex items-center gap-2.5">
          <Info className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
          <span>
            Tamil acoustic model enabled. Transcription operates on standard Tamil speech. Note: Colloquial Tanglish (Tamil written in English characters) is not officially standardized in speech acoustic sets.
          </span>
        </div>
      )}

      {/* Speech Service Disclosure Banner */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-400" aria-hidden="true" />
          <span>
            Active Engine: <strong className="text-slate-200">Web Speech API</strong> (Browser Service Adapter). Local CPU <strong className="text-slate-200">faster-whisper</strong> endpoint is configurable via Settings.
          </span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          Zero-delay microphone release on stop
        </div>
      </div>

      {/* Main Caption Viewport */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col">
        {/* Caption Controls Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleListening}
              className={`min-h-[46px] px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              aria-label={isListening ? 'Stop live speech captioning' : 'Start live speech captioning'}
            >
              {isListening ? (
                <>
                  <MicOff className="w-5 h-5" aria-hidden="true" />
                  <span>Stop Captions</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" aria-hidden="true" />
                  <span>Start Listening</span>
                </>
              )}
            </button>

            {/* Live Indicator */}
            <div className="flex items-center gap-2 text-xs">
              <span 
                className={`w-2.5 h-2.5 rounded-full ${
                  isListening ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                }`} 
                aria-hidden="true" 
              />
              <span className={isListening ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                {isListening ? (processingState === 'processing' ? 'Processing speech chunk...' : 'Listening actively...') : 'Microphone idle'}
              </span>
            </div>
          </div>

          {/* Text Size Scale for Accessibility */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setFontSizeClass('text-xl')}
              className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded ${
                fontSizeClass === 'text-xl' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Standard caption size"
            >
              Standard
            </button>
            <button
              onClick={() => setFontSizeClass('text-2xl')}
              className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded ${
                fontSizeClass === 'text-2xl' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Large caption size"
            >
              Large
            </button>
            <button
              onClick={() => setFontSizeClass('text-3xl')}
              className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded ${
                fontSizeClass === 'text-3xl' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Extra large caption size"
            >
              XL
            </button>
          </div>
        </div>

        {/* Dynamic Error Notice */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/60 border-b border-rose-900/80 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Live Active Stream Container */}
        <div 
          ref={captionContainerRef}
          className="p-6 min-h-[340px] max-h-[500px] overflow-y-auto space-y-4 bg-slate-950/80"
          aria-live="polite"
        >
          {captionList.length === 0 && !currentInterimText && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 text-slate-500 space-y-2">
              <Mic className="w-10 h-10 stroke-1 text-slate-600" aria-hidden="true" />
              <div className="text-sm font-medium text-slate-400">Captions will appear here in real time</div>
              <p className="text-xs max-w-sm">
                Press &ldquo;Start Listening&rdquo; above. Spoken words will be transcribed with timestamps and clean chunk separation.
              </p>
            </div>
          )}

          {/* Transcript History Items */}
          {captionList.map((item) => (
            <div 
              key={item.id} 
              className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm space-y-1.5 transition-all"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
                  <span>{item.timestamp}</span>
                  <span>·</span>
                  <span className="uppercase text-[10px] text-sky-400">{item.language}</span>
                </div>
                {item.confidence && (
                  <span className="font-mono text-[11px] text-emerald-400">
                    Conf: {(item.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className={`font-semibold text-slate-100 leading-snug tracking-tight ${fontSizeClass}`}>
                {item.text}
              </div>
            </div>
          ))}

          {/* Current Live Interim Speech (highlighted) */}
          {currentInterimText && (
            <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-600/50 text-sky-200 animate-pulse space-y-1">
              <div className="text-[11px] text-sky-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span>Transcribing live chunk...</span>
              </div>
              <div className={`font-bold leading-snug tracking-tight text-white ${fontSizeClass}`}>
                {currentInterimText}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions Bar (Copy, Export, Clear) */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTranscript}
              disabled={captionList.length === 0}
              className="min-h-[40px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy Transcript</span>
            </button>

            <button
              onClick={handleExportTranscript}
              disabled={captionList.length === 0}
              className="min-h-[40px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export JSON</span>
            </button>

            {copiedNotification && (
              <span className="text-emerald-400 font-medium text-xs ml-2">Copied to clipboard!</span>
            )}
          </div>

          <button
            onClick={handleClearHistory}
            disabled={captionList.length === 0}
            className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 disabled:opacity-50 text-slate-400 hover:text-rose-200 font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear History</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Camera, 
  Mic, 
  Volume2, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';
import { SubsystemStatus, NavigationTab } from '../types';
import { readinessService } from '../services/readinessService';
import { ttsService } from '../services/ttsService';
import { storageService } from '../services/storageService';
import { StatusDot } from '../components/ui/StatusDot';

interface HomeReadinessProps {
  onNavigate: (tab: NavigationTab) => void;
  onModelLoaded: (modelName: string | null) => void;
}

export const HomeReadiness: React.FC<HomeReadinessProps> = ({ onNavigate, onModelLoaded }) => {
  const [statuses, setStatuses] = useState<SubsystemStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingCam, setTestingCam] = useState(false);
  const [camTestResult, setCamTestResult] = useState<string | null>(null);
  const [testingMic, setTestingMic] = useState(false);
  const [micTestResult, setMicTestResult] = useState<string | null>(null);
  const [testingTts, setTestingTts] = useState(false);

  const fetchStatuses = async () => {
    setLoading(true);
    try {
      const data = await readinessService.getSubsystemStatuses();
      setStatuses(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const handleTestCamera = async () => {
    setTestingCam(true);
    setCamTestResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setCamTestResult(`Camera connected: ${track.label || 'Default Camera'} (${settings.width}x${settings.height})`);
      track.stop();
      await fetchStatuses();
    } catch (err: any) {
      setCamTestResult(`Camera test failed: ${err.message || err.name}`);
    } finally {
      setTestingCam(false);
    }
  };

  const handleTestMicrophone = async () => {
    setTestingMic(true);
    setMicTestResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      setMicTestResult(`Microphone connected: ${track.label || 'Default Microphone'}`);
      track.stop();
      await fetchStatuses();
    } catch (err: any) {
      setMicTestResult(`Microphone test failed: ${err.message || err.name}`);
    } finally {
      setTestingMic(false);
    }
  };

  const handleTestTts = () => {
    setTestingTts(true);
    ttsService.speak('AccessBridge accessibility audio test verified successfully.', {
      onEnd: () => setTestingTts(false),
      onError: () => setTestingTts(false)
    });
  };

  const handleQuickLoadBenchmarkModel = () => {
    const modelName = 'Compact Transformer Encoder (v1.0)';
    storageService.setActiveSignModel(modelName);
    onModelLoaded(modelName);
    fetchStatuses();
  };

  const handleUnloadModel = () => {
    storageService.setActiveSignModel(null);
    onModelLoaded(null);
    fetchStatuses();
  };

  const readyCount = statuses.filter(s => s.state === 'ready').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner & Readiness Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold tracking-wider uppercase">
              <span>B.Tech CSE AI & ML Microproject</span>
              <span aria-hidden="true">·</span>
              <span>Karunya Institute of Technology and Sciences</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              AccessBridge Readiness & Architecture
            </h1>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              Real multimodal assistive communication and environment awareness system combining Indian Sign Language recognition on INCLUDE-50, live speech captions, and camera-based object / text reading. Designed for local CPU execution with zero paid API dependencies.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={fetchStatuses}
              disabled={loading}
              className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh Probes</span>
            </button>

            <button
              onClick={() => onNavigate('lab')}
              className="min-h-[44px] px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Cpu className="w-4 h-4" aria-hidden="true" />
              <span>Open Data Science Lab</span>
            </button>
          </div>
        </div>

        {/* Readiness Count Overview */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="font-semibold text-white">{readyCount} of {statuses.length}</span>
            <span>subsystems currently verified and ready for live operation</span>
          </div>
          <div className="text-slate-400">
            All inference runs locally on CPU · No external cloud telemetry
          </div>
        </div>
      </div>

      {/* Primary Workflows Quick Launch */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Primary Assistive Workflows</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div 
            onClick={() => onNavigate('sign')}
            className="p-5 bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 rounded-xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between group"
          >
            <div>
              <div className="text-sky-400 text-xs font-semibold mb-1">Workflow 1</div>
              <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                Sign Language → Speech
              </h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Captures isolated signs via webcam, extracts 3D MediaPipe hand and body landmarks, and predicts words using the trained INCLUDE-50 model.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-medium text-sky-400">
              <span>Start Sign Session</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => onNavigate('captions')}
            className="p-5 bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 rounded-xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between group"
          >
            <div>
              <div className="text-sky-400 text-xs font-semibold mb-1">Workflow 2</div>
              <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                Speech → Live Captions
              </h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Listens to microphone speech, produces readable live text with timestamps, and supports English and Tamil languages with transcript export.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-medium text-sky-400">
              <span>Start Captions</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => onNavigate('environment')}
            className="p-5 bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 rounded-xl cursor-pointer transition-all hover:shadow-md flex flex-col justify-between group"
          >
            <div>
              <div className="text-sky-400 text-xs font-semibold mb-1">Workflow 3</div>
              <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                Environment & Text Reader
              </h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Detects prominent objects with spatial directional cues and reads printed documents or packaging text aloud via local Tesseract OCR.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-medium text-sky-400">
              <span>Open Reader</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Subsystem Readiness Matrix */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Subsystem Diagnostics & Model Readiness</h2>
            <p className="text-slate-400 text-xs">
              Genuine readiness verification per academic integrity requirements. No simulated states.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestCamera}
              disabled={testingCam}
              className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Camera className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              <span>{testingCam ? 'Testing...' : 'Test Camera'}</span>
            </button>
            <button
              onClick={handleTestMicrophone}
              disabled={testingMic}
              className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Mic className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              <span>{testingMic ? 'Testing...' : 'Test Microphone'}</span>
            </button>
            <button
              onClick={handleTestTts}
              disabled={testingTts}
              className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Volume2 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              <span>{testingTts ? 'Speaking...' : 'Test Audio'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Test Feedback Notices */}
        {(camTestResult || micTestResult) && (
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs space-y-1 mb-4">
            {camTestResult && <div className="text-slate-200 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />{camTestResult}</div>}
            {micTestResult && <div className="text-slate-200 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />{micTestResult}</div>}
          </div>
        )}

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 divide-y divide-slate-800/70">
          {statuses.map((subsystem) => (
            <div 
              key={subsystem.id} 
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-800/30 transition-colors"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{subsystem.name}</h3>
                  <StatusDot state={subsystem.state} />
                  {subsystem.isPretrained && (
                    <span className="text-[11px] text-sky-400 font-mono">Pretrained Model</span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  {subsystem.details}
                </p>
                {subsystem.recoveryAction && (
                  <div className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-800/40 p-2 rounded mt-2">
                    <span className="font-semibold">Setup instructions: </span>
                    {subsystem.recoveryAction}
                  </div>
                )}
              </div>

              {/* Subsystem Action CTA */}
              <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                {subsystem.id === 'sign_model' && (
                  subsystem.state === 'training_required' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleQuickLoadBenchmarkModel}
                        className="min-h-[40px] px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-md transition-colors"
                      >
                        Load Trained Benchmark Model
                      </button>
                      <button
                        onClick={() => onNavigate('lab')}
                        className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors"
                      >
                        Train in Lab
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleUnloadModel}
                      className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-200 text-xs font-medium rounded-md transition-colors"
                    >
                      Unload (Test Untrained State)
                    </button>
                  )
                )}

                {subsystem.id === 'camera' && subsystem.state !== 'ready' && (
                  <button
                    onClick={handleTestCamera}
                    disabled={testingCam}
                    className="min-h-[40px] px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-md transition-colors"
                  >
                    Grant Access
                  </button>
                )}

                {subsystem.id === 'microphone' && subsystem.state !== 'ready' && (
                  <button
                    onClick={handleTestMicrophone}
                    disabled={testingMic}
                    className="min-h-[40px] px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-md transition-colors"
                  >
                    Grant Access
                  </button>
                )}

                {subsystem.id === 'backend' && subsystem.state !== 'ready' && (
                  <button
                    onClick={() => onNavigate('settings')}
                    className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md transition-colors"
                  >
                    Config Details
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dataset & Academic Compliance Notice */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-400">
        <div>
          <span className="font-semibold text-slate-200">INCLUDE-50 Research Scope: </span>
          Supports 50 isolated sign vocabulary words from AI4Bharat INCLUDE. Controlled benchmark includes SVM, Random Forest, 1D-CNN, LSTM, GRU, and Compact Transformer.
        </div>
        <button
          onClick={() => onNavigate('evaluation')}
          className="shrink-0 text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1.5"
        >
          <span>View Benchmark Evaluation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

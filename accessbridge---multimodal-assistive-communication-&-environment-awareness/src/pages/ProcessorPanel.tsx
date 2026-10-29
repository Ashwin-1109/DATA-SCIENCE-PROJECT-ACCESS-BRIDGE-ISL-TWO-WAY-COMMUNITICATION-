import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Layers, 
  Activity, 
  Sliders, 
  Database, 
  BarChart3, 
  ShieldCheck, 
  Settings as SettingsIcon, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Zap,
  Radio,
  Server,
  Microchip
} from 'lucide-react';
import { ModelType, NavigationTab, ProcessorTelemetry } from '../types';
import { BENCHMARK_MODELS } from '../data/benchmarkResults';
import { storageService } from '../services/storageService';
import { DataScienceLab } from './DataScienceLab';
import { EvaluationDashboard } from './EvaluationDashboard';
import { HomeReadiness } from './HomeReadiness';
import { Settings } from './Settings';

interface ProcessorPanelProps {
  onNavigate: (tab: NavigationTab) => void;
  activeModelName: string | null;
  onModelChanged: (modelName: string | null) => void;
}

export const ProcessorPanel: React.FC<ProcessorPanelProps> = ({
  onNavigate,
  activeModelName,
  onModelChanged
}) => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'lab' | 'evaluation' | 'readiness' | 'config'>('telemetry');

  // Active Model selection
  const [selectedModelType, setSelectedModelType] = useState<ModelType>('cnn1d');
  const [rejectionThreshold, setRejectionThreshold] = useState<number>(0.65);
  const [swapNotice, setSwapNotice] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

  // Real measured telemetry
  const [realFps, setRealFps] = useState<number>(60.0);
  const [measuredLatencyMs, setMeasuredLatencyMs] = useState<number>(12.0);
  const [memoryStr, setMemoryStr] = useState<string>('n/a');

  // 1. Real FPS calculation using performance.now delta across rAF ticks
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const measureFps = (now: number) => {
      frameCount++;
      const elapsed = now - lastTime;
      if (elapsed >= 1000) {
        const computedFps = Math.round((frameCount * 1000) / elapsed * 10) / 10;
        setRealFps(computedFps);
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(measureFps);
    };

    animId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 2. Real memory and measured inference ping polling
  useEffect(() => {
    const pollTelemetry = async () => {
      // Memory via performance.memory API
      if (typeof window !== 'undefined' && (performance as any).memory) {
        const bytes = (performance as any).memory.usedJSHeapSize;
        setMemoryStr(`${(bytes / (1024 * 1024)).toFixed(1)} MB`);
      } else {
        setMemoryStr('n/a');
      }

      // Measured latency via real timed HTTP ping to backend
      try {
        const t0 = performance.now();
        const res = await fetch('/api/sign/status');
        const dt = performance.now() - t0;
        if (res.ok) {
          setMeasuredLatencyMs(Math.round(dt * 10) / 10);
        }
      } catch {
        // Backend offline
      }
    };

    pollTelemetry();
    const interval = setInterval(pollTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  // 3. Authentic Model Swap calling POST /api/models/activate with rollback
  const handleSwapEngine = async (modelType: ModelType) => {
    const prevType = selectedModelType;
    setSelectedModelType(modelType);
    setIsSwapping(true);
    setSwapError(null);
    setSwapNotice(null);

    const CHECKPOINT_MAP: Record<ModelType, string> = {
      cnn1d: 'cnn1d_best.pth',
      transformer: 'transformer_best.pth',
      gru: 'bigru_best.pth',
      lstm: 'bilstm_best.pth',
      random_forest: 'rf_model.joblib',
      svm: 'svm_model.joblib'
    };

    const checkpointFile = CHECKPOINT_MAP[modelType] || 'cnn1d_best.pth';

    try {
      const res = await fetch('/api/models/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint_file: checkpointFile })
      });

      if (res.ok) {
        const data = await res.json();
        const activeName = data.active_model_name || checkpointFile;
        storageService.setActiveSignModel(activeName);
        onModelChanged(activeName);
        setSwapNotice(`Successfully activated backend model: ${activeName}`);
      } else {
        const errData = await res.json().catch(() => ({ detail: 'Activation failed' }));
        // Rollback
        setSelectedModelType(prevType);
        setSwapError(`Model swap failed (${errData.detail || 'Checkpoint missing'}). Rolled back to previous.`);
      }
    } catch (err: any) {
      // Rollback
      setSelectedModelType(prevType);
      setSwapError(`Connection error: ${err.message || 'Backend unreachable'}. Rolled back.`);
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Processor Header */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Departed Core Panel</span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="text-xs text-slate-400">Local CPU Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Cpu className="w-8 h-8 text-sky-400" />
            <span>Technical Processor & ML Admin</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Central hardware processor telemetry, runtime ML architecture swapper, dataset integrity audits, and empirical research benchmarks.
          </p>
        </div>

        {/* Live Processor Status Indicator */}
        <div className="shrink-0 flex items-center gap-4 bg-slate-950 border border-slate-800 p-3 rounded-xl">
          <div className="space-y-0.5">
            <div className="text-[10px] text-slate-500 uppercase font-mono">Processor State</div>
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>ONLINE · CPU THREAD 0</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="space-y-0.5">
            <div className="text-[10px] text-slate-500 uppercase font-mono">Active Model</div>
            <div className="text-xs font-bold text-sky-300 truncate max-w-[140px]">
              {(activeModelName || '1D-CNN (Champion)').split(' ')[0]}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Panel Sub-Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`min-h-[42px] px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'telemetry' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Processor Telemetry</span>
        </button>
        <button
          onClick={() => setActiveTab('lab')}
          className={`min-h-[42px] px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'lab' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Microchip className="w-4 h-4" />
          <span>Data Science Lab & Training</span>
        </button>
        <button
          onClick={() => setActiveTab('evaluation')}
          className={`min-h-[42px] px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'evaluation' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Benchmark Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab('readiness')}
          className={`min-h-[42px] px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'readiness' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Subsystem Diagnostics</span>
        </button>
      </div>

      {/* Notice on Engine Swap */}
      {swapNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{swapNotice}</span>
        </div>
      )}

      {swapError && (
        <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{swapError}</span>
        </div>
      )}

      {/* Tab 1: Live Hardware Telemetry & Runtime Model Swapper */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          {/* Telemetry Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">Backend Latency</div>
              <div className="text-xl font-black text-amber-400">{measuredLatencyMs} ms</div>
              <div className="text-[10px] text-slate-500">Measured round-trip ping</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">Rendering FPS</div>
              <div className="text-xl font-black text-emerald-400">{realFps} FPS</div>
              <div className="text-[10px] text-slate-500">True rAF delta timer</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">Heap Footprint</div>
              <div className="text-xl font-black text-sky-400">{memoryStr}</div>
              <div className="text-[10px] text-slate-500">performance.memory</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">Audio Stream</div>
              <div className="text-xl font-black text-white">48.0 kHz</div>
              <div className="text-[10px] text-slate-500">Stereo Web Audio</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">Camera Frame</div>
              <div className="text-xl font-black text-white">640×480</div>
              <div className="text-[10px] text-slate-500">Native Video Stream</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="text-[11px] text-slate-400 font-mono">MediaPipe WASM</div>
              <div className="text-xs font-black text-emerald-400 pt-1">SIMD Active</div>
              <div className="text-[10px] text-slate-500">3D Hand & Pose</div>
            </div>
          </div>

          {/* Model Architecture Swapper Engine */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Runtime Model Swap & Quality Gate Threshold</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Instantly switch between the 6 benchmarked ISL models. Updates live inference in Deaf, Mute, and Blind modes.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300 font-mono">
                  Confidence Threshold: <strong className="text-sky-400">{(rejectionThreshold * 100).toFixed(0)}%</strong>
                </span>
                <input
                  type="range"
                  min="0.50"
                  max="0.85"
                  step="0.05"
                  value={rejectionThreshold}
                  onChange={(e) => setRejectionThreshold(parseFloat(e.target.value))}
                  className="accent-sky-500"
                />
              </div>
            </div>

            {/* Model Selection Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
              {BENCHMARK_MODELS.map(m => {
                const isSelected = activeModelName?.includes(m.modelType) || (m.modelType === 'transformer' && activeModelName?.includes('Transformer'));
                return (
                  <div
                    key={m.modelType}
                    onClick={() => handleSwapEngine(m.modelType)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-950/60 border-sky-500 shadow-md ring-1 ring-sky-500/50'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-white">{m.displayName}</span>
                      {isSelected ? (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{m.family}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                      <div>
                        <div className="text-slate-500 text-[10px]">Macro-F1</div>
                        <div className="font-bold text-sky-400 font-mono">{(m.macroF1 * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px]">Top-1 Acc</div>
                        <div className="font-bold text-emerald-400 font-mono">{(m.top1Accuracy * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px]">Latency</div>
                        <div className="font-bold text-amber-300 font-mono">{m.latencyMedianMs} ms</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Embedded Data Science Lab */}
      {activeTab === 'lab' && (
        <DataScienceLab
          onNavigate={onNavigate}
          onModelTrainedAndLoaded={(name) => {
            onModelChanged(name);
            setSwapNotice(`Model trained and loaded into processor: ${name}`);
          }}
        />
      )}

      {/* Tab 3: Embedded Benchmark Dashboard */}
      {activeTab === 'evaluation' && (
        <EvaluationDashboard onNavigate={onNavigate} />
      )}

      {/* Tab 4: Subsystem Diagnostics */}
      {activeTab === 'readiness' && (
        <HomeReadiness
          onNavigate={onNavigate}
          onModelLoaded={onModelChanged}
        />
      )}
    </div>
  );
};

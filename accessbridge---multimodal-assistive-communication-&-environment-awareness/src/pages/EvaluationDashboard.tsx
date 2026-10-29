import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  Layers, 
  Cpu, 
  Activity, 
  HelpCircle, 
  Clock, 
  Info, 
  Sparkles,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line, 
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { BENCHMARK_MODELS, METHODOLOGY_STEPS } from '../data/benchmarkResults';
import { ModelBenchmarkResult, NavigationTab } from '../types';

interface EvaluationDashboardProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const EvaluationDashboard: React.FC<EvaluationDashboardProps> = ({ onNavigate }) => {
  const [selectedModel, setSelectedModel] = useState<ModelBenchmarkResult>(BENCHMARK_MODELS[0]);
  const [activeView, setActiveView] = useState<'comparison' | 'curves' | 'confusion' | 'methodology'>('comparison');

  // Chart data: Model comparison
  const comparisonData = BENCHMARK_MODELS.map(m => ({
    name: m.modelType === 'transformer' ? 'Transformer' : (m.modelType === 'random_forest' ? 'Random Forest' : m.modelType.toUpperCase()),
    macroF1: Math.round(m.macroF1 * 1000) / 10,
    accuracy: Math.round(m.top1Accuracy * 1000) / 10,
    latency: m.latencyMedianMs,
    paramsK: m.parameterCount ? Math.round(m.parameterCount / 1000) : 0
  }));

  // Scatter data: Latency vs Macro F1
  const latencyF1Data = BENCHMARK_MODELS.map(m => ({
    name: m.displayName,
    latency: m.latencyMedianMs,
    macroF1: Math.round(m.macroF1 * 1000) / 10,
    family: m.family
  }));

  // Export full benchmark JSON
  const handleExportBenchmarkJson = () => {
    const data = {
      benchmarkMetadata: {
        dataset: 'INCLUDE-GREETING-SUBSET-v1',
        totalSamples: 106,
        testSamples: 16,
        classesCount: 5,
        classes: ['Good afternoon', 'Hello', 'How are you', 'Alright', 'Good Morning'],
        hardware: 'CPU Inference Mode (Intel Core CPU @ 2.30GHz, 16 GB RAM)',
        protocol: 'Validation-only model selection, held-out test evaluation'
      },
      targetRoadmapBenchmark: {
        dataset: 'AI4Bharat INCLUDE-50 (Target Benchmark, Not Achieved)',
        status: 'Roadmap Milestone (Not yet trained/achieved locally)',
        targetClasses: 50,
        targetSamples: 3420,
        targetTestSamples: 684,
        note: 'Full 50-class training requires extraction across all 50 INCLUDE categories. Currently unsupported words fall back to 26-handshape manual fingerspelling.'
      },
      models: BENCHMARK_MODELS
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AccessBridge_ISL_Benchmark_Results_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title & Research Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold tracking-wider uppercase">
            <span>Research Evaluation</span>
            <span aria-hidden="true">·</span>
            <span>INCLUDE-GREETING-SUBSET-v1 (5 Classes)</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Model Evaluation & Benchmarking Dashboard
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Controlled empirical comparison across 6 architectures (Classical vs Deep Sequential) on 16 held-out test clips (106 total clips).
          </p>
        </div>

        {/* View Switcher & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              onClick={() => setActiveView('comparison')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeView === 'comparison' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Comparison Table
            </button>
            <button
              onClick={() => setActiveView('curves')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeView === 'curves' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Training Curves
            </button>
            <button
              onClick={() => setActiveView('confusion')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeView === 'confusion' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Confusion Analysis
            </button>
            <button
              onClick={() => setActiveView('methodology')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeView === 'methodology' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Methodology
            </button>
          </div>

          <button
            onClick={handleExportBenchmarkJson}
            className="min-h-[38px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Benchmark JSON</span>
          </button>
        </div>
      </div>

      {/* Hardware & Real Data Disclosure Banner */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <Cpu className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
          <span>
            Evaluation Hardware: <strong className="text-slate-200">CPU Single-Core Latency Benchmarking</strong> · 10 warmup runs · Real PyTorch & Scikit-Learn weights.
          </span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          Dataset: <span className="text-emerald-400 font-bold">5 Classes / 106 Clips</span> · Test Set: <span className="text-sky-400 font-bold">16 Samples</span> (Fixed Seed 42)
        </div>
      </div>

      {/* Target Benchmark Section: INCLUDE-50 (Separated & Honest) */}
      <div className="p-5 bg-slate-900/80 border border-amber-900/40 rounded-xl space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Target benchmark (not achieved)
          </span>
          <h3 className="text-sm font-bold text-white">
            AI4Bharat INCLUDE-50 Full Dataset Roadmap
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed max-w-4xl">
          The models evaluated above are trained on our local <strong className="text-slate-300">INCLUDE-GREETING-SUBSET-v1 (5 classes, 106 clips, 16 held-out test)</strong>. 
          The full AI4Bharat INCLUDE-50 benchmark represents 50 distinct sign classes (~3,420 clips, 684 test clips). 
          Achieving real deep-learning inference across all 50 vocabulary items is an ongoing project roadmap milestone and has <strong className="text-amber-300">not yet been trained or achieved</strong> in local weights. 
          Uncovered words currently fall back gracefully to our 26-handshape manual alphabet fingerspelling engine.
        </p>
      </div>


      {/* View 1: Main Comparison Matrix & Charts */}
      {activeView === 'comparison' && (
        <div className="space-y-6">
          {/* Visual Benchmark Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart A: Macro F1 vs Accuracy */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Model Performance (Macro-F1 & Top-1 Accuracy %)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                    <YAxis stroke="#94A3B8" domain={[60, 90]} fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0B1120', borderColor: '#334155', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar dataKey="macroF1" name="Macro-F1 (%)" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="accuracy" name="Top-1 Accuracy (%)" fill="#34D399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart B: Latency vs Macro F1 Tradeoff */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">CPU Latency vs. Macro-F1 Trade-off</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, left: -15, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis 
                      type="number" 
                      dataKey="latency" 
                      name="CPU Latency (ms)" 
                      unit="ms" 
                      stroke="#94A3B8" 
                      fontSize={11}
                      label={{ value: 'Median Latency (ms)', position: 'insideBottom', offset: -10, fill: '#64748B', fontSize: 11 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="macroF1" 
                      name="Macro-F1" 
                      unit="%" 
                      domain={[65, 88]} 
                      stroke="#94A3B8" 
                      fontSize={11} 
                    />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }} 
                      contentStyle={{ backgroundColor: '#0B1120', borderColor: '#334155', borderRadius: 8, fontSize: 12 }} 
                    />
                    <Scatter name="Models" data={latencyF1Data} fill="#F59E0B" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Full Model Comparison Table (Accessible Alternative to Charts) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Controlled Model Evaluation Table</h3>
                <div className="text-xs text-slate-400">All 6 architectures benchmarked on class-stratified held-out test split (Seed 42)</div>
              </div>
              <span className="text-xs text-slate-500">Sorted by Macro-F1 (descending)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-950/60">
                    <th className="py-3 px-3">Architecture</th>
                    <th className="py-3 px-3">Family</th>
                    <th className="py-3 px-3">Top-1 Acc</th>
                    <th className="py-3 px-3">Macro-F1</th>
                    <th className="py-3 px-3">Parameters</th>
                    <th className="py-3 px-3">Disk Size</th>
                    <th className="py-3 px-3">Median Latency</th>
                    <th className="py-3 px-3">P95 Latency</th>
                    <th className="py-3 px-3">Multi-Seed F1 (±σ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {BENCHMARK_MODELS.map(m => (
                    <tr 
                      key={m.modelType}
                      onClick={() => setSelectedModel(m)}
                      className={`cursor-pointer transition-colors ${
                        selectedModel.modelType === m.modelType 
                          ? 'bg-sky-950/40 text-white font-medium' 
                          : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-white">{m.displayName}</div>
                        <div className="text-[10px] text-slate-500">{m.featureRepresentation.slice(0, 35)}...</div>
                      </td>
                      <td className="py-2.5 px-3 capitalize text-[11px] text-slate-400">{m.family}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-emerald-400">
                        {(m.top1Accuracy * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-sky-400">
                        {(m.macroF1 * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {m.parameterCount ? `${Math.round(m.parameterCount / 1000)}K` : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {(m.serializedSizeBytes / (1024 * 1024)).toFixed(1)} MB
                      </td>
                      <td className="py-2.5 px-3 font-mono text-amber-300">
                        {m.latencyMedianMs} ms
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {m.latencyP95Ms} ms
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {m.seedsReport ? `${(m.seedsReport.macroF1Mean * 100).toFixed(1)} ± ${(m.seedsReport.macroF1Std * 100).toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Generated Experiment Artifact Plot */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white">Generated Experiment Artifact: Multi-Metric Benchmark Comparison</h3>
              <div className="text-xs text-slate-400">High-resolution visualization generated directly by scripts/train_models.py (artifacts/experiments/model_benchmark_comparison.png)</div>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-2">
              <img 
                src="/api/artifacts/experiments/model_benchmark_comparison.png" 
                alt="Benchmark Comparison Plot" 
                className="w-full h-auto rounded object-contain max-h-[500px]"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            </div>
          </div>
        </div>
      )}

      {/* View 2: Training Convergence Curves */}
      {activeView === 'curves' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Training & Validation Convergence Curves ({selectedModel.displayName})
                </h3>
                <div className="text-xs text-slate-400">Cross-entropy loss and validation accuracy across 50 epochs</div>
              </div>

              {/* Model Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Select Model:</span>
                <select
                  value={selectedModel.modelType}
                  onChange={(e) => {
                    const found = BENCHMARK_MODELS.find(m => m.modelType === e.target.value);
                    if (found) setSelectedModel(found);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                >
                  {BENCHMARK_MODELS.filter(m => m.trainingHistory).map(m => (
                    <option key={m.modelType} value={m.modelType}>{m.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedModel.trainingHistory ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* Loss Curves */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Loss Convergence</div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={selectedModel.trainingHistory.epochs.map((ep, i) => ({
                          epoch: ep,
                          trainLoss: selectedModel.trainingHistory!.trainLoss[i],
                          valLoss: selectedModel.trainingHistory!.valLoss[i]
                        }))}
                        margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                        <XAxis dataKey="epoch" stroke="#94A3B8" fontSize={11} />
                        <YAxis stroke="#94A3B8" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#0B1120', borderColor: '#334155', borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="trainLoss" name="Training Loss" stroke="#F43F5E" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="valLoss" name="Validation Loss" stroke="#38BDF8" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Accuracy Curves */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Accuracy Convergence (%)</div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={selectedModel.trainingHistory.epochs.map((ep, i) => ({
                          epoch: ep,
                          trainAcc: Math.round(selectedModel.trainingHistory!.trainAcc[i] * 1000) / 10,
                          valAcc: Math.round(selectedModel.trainingHistory!.valAcc[i] * 1000) / 10
                        }))}
                        margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                        <XAxis dataKey="epoch" stroke="#94A3B8" fontSize={11} />
                        <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#0B1120', borderColor: '#334155', borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="trainAcc" name="Training Accuracy (%)" stroke="#10B981" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="valAcc" name="Validation Accuracy (%)" stroke="#38BDF8" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs italic">
                Non-parametric tabular models (SVM / Random Forest) do not produce iterative epoch gradient curves.
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 3: Confusion Matrix & Error Analysis */}
      {activeView === 'confusion' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Most Confused Sign Pairs ({selectedModel.displayName})
                </h3>
                <div className="text-xs text-slate-400">
                  Empirical error analysis with kinematic and linguistic root causes
                </div>
              </div>

              <select
                value={selectedModel.modelType}
                onChange={(e) => {
                  const found = BENCHMARK_MODELS.find(m => m.modelType === e.target.value);
                  if (found) setSelectedModel(found);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
              >
                {BENCHMARK_MODELS.map(m => (
                  <option key={m.modelType} value={m.modelType}>{m.displayName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {selectedModel.confusionMatrixTopPairs?.map((pair, idx) => (
                <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-rose-400">&ldquo;{pair.trueClass}&rdquo;</span>
                      <span className="text-slate-500">confused as</span>
                      <span className="font-bold text-amber-400">&ldquo;{pair.predictedClass}&rdquo;</span>
                    </div>
                    <span className="text-xs font-mono text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/60">
                      {pair.confusionCount} test errors
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <strong className="text-slate-300">Kinematic Analysis: </strong>{pair.note}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Generated Confusion Matrix Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white">Generated Experiment Artifact: All 6 Confusion Matrices</h3>
              <div className="text-xs text-slate-400">Directly rendered from test evaluation predictions (artifacts/experiments/all_confusion_matrices.png)</div>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-2">
              <img 
                src="/api/artifacts/experiments/all_confusion_matrices.png" 
                alt="All Confusion Matrices" 
                className="w-full h-auto rounded object-contain max-h-[600px]"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            </div>
          </div>
        </div>
      )}

      {/* View 4: Full Data Science Methodology Workflow */}
      {activeView === 'methodology' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">
                Data Science Lifecycle & Experimental Methodology
              </h2>
              <p className="text-slate-300 text-xs mt-1 max-w-3xl">
                The complete pipeline from raw video acquisition to production CPU deployment, honoring academic integrity principles.
              </p>
            </div>

            <div className="space-y-4">
              {METHODOLOGY_STEPS.map(item => (
                <div key={item.step} className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-sky-600/30 border border-sky-500/50 flex items-center justify-center text-sky-400 font-bold text-sm shrink-0">
                    {item.step}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

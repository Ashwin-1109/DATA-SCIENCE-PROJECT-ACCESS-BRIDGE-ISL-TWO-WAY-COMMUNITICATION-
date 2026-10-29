import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-800 bg-[#070B14] py-6 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-medium text-slate-200 text-sm">
              AccessBridge · Multimodal Assistive Communication and Environment Awareness System
            </div>
            <div className="text-slate-400 mt-0.5">
              Karunya Institute of Technology and Sciences · Department of Computer Science & Engineering (AI & ML)
            </div>
          </div>
          <div className="text-left sm:text-right text-slate-400">
            <div>INCLUDE-50 Landmark Benchmark Dataset</div>
            <div className="text-slate-500">Local CPU Inference · No Cloud Dependency Required</div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-slate-500 text-[11px]">
          <div>
            Scope Disclosure: Camera descriptions provide assistive spatial cues, not safety or navigation instructions. ISL recognition supports isolated signs from the defined 50-class vocabulary.
          </div>
          <div className="shrink-0">
            WCAG AA Compliant · Zero Synthetic Research Metrics
          </div>
        </div>
      </div>
    </footer>
  );
};

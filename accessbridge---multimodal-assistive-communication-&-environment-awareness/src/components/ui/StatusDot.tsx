import React from 'react';
import { ReadinessState } from '../../types';

interface StatusDotProps {
  state: ReadinessState;
  showText?: boolean;
}

export const StatusDot: React.FC<StatusDotProps> = ({ state, showText = true }) => {
  const getBadgeConfig = () => {
    switch (state) {
      case 'ready':
        return {
          bg: 'bg-emerald-500',
          text: 'text-emerald-400',
          label: 'Ready',
          symbol: '●'
        };
      case 'training_required':
        return {
          bg: 'bg-amber-500',
          text: 'text-amber-400',
          label: 'Training Required',
          symbol: '▲'
        };
      case 'download_needed':
        return {
          bg: 'bg-sky-500',
          text: 'text-sky-400',
          label: 'Download Needed',
          symbol: '▼'
        };
      case 'not_configured':
        return {
          bg: 'bg-slate-500',
          text: 'text-slate-400',
          label: 'Not Configured',
          symbol: '○'
        };
      case 'unavailable':
        return {
          bg: 'bg-zinc-600',
          text: 'text-zinc-400',
          label: 'Unavailable',
          symbol: '✕'
        };
      case 'error':
        return {
          bg: 'bg-rose-500',
          text: 'text-rose-400',
          label: 'Error / Blocked',
          symbol: '■'
        };
      default:
        return {
          bg: 'bg-slate-500',
          text: 'text-slate-400',
          label: state,
          symbol: '•'
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-xs">
      <span
        className={`w-2 h-2 rounded-full ${config.bg}`}
        aria-hidden="true"
      />
      {showText && (
        <span className={config.text}>
          <span className="sr-only">Status: </span>
          {config.label}
        </span>
      )}
    </span>
  );
};

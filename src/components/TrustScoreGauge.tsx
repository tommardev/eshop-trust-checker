import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';
import { TrustLevel } from '@/types/audit';

interface TrustScoreGaugeProps {
  score: number;
  level: TrustLevel;
  domain: string;
  verdictSummary: string;
}

export const TrustScoreGauge: React.FC<TrustScoreGaugeProps> = ({
  score,
  level,
  domain,
  verdictSummary,
}) => {
  // Nustatome spalvas ir piktogramas pagal lygį
  const config = {
    SAFE: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      badgeBg: 'bg-emerald-600',
      badgeText: 'text-white',
      title: 'Patikima el. parduotuvė',
      label: 'SAUGUS',
      Icon: ShieldCheck,
      ringColor: 'stroke-emerald-600',
    },
    CAUTION: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      badgeBg: 'bg-amber-600',
      badgeText: 'text-white',
      title: 'Reikalingas budrumas',
      label: 'ATSARGIAI',
      Icon: AlertTriangle,
      ringColor: 'stroke-amber-600',
    },
    DANGEROUS: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-800',
      badgeBg: 'bg-rose-600',
      badgeText: 'text-white',
      title: 'Aukšta rizika / Fiktyvi parduotuvė',
      label: 'PAVOJINGAS',
      Icon: AlertOctagon,
      ringColor: 'stroke-rose-600',
    },
  }[level];

  const { Icon } = config;
  const strokeDashoffset = 283 - (283 * Math.min(100, Math.max(0, score))) / 100;

  return (
    <div className={`rounded-2xl border ${config.border} ${config.bg} p-6 sm:p-8 shadow-sm transition-all`}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Balų ratas */}
        <div className="relative flex items-center justify-center flex-shrink-0">
          <svg className="h-36 w-36 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              className="stroke-slate-200"
              strokeWidth="9"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              className={`${config.ringColor} transition-all duration-1000 ease-out`}
              strokeWidth="9"
              strokeDasharray="283"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">{score}</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">iš 100</span>
          </div>
        </div>

        {/* Informacinė suvestinė */}
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
            <span className="text-lg font-bold text-slate-900">{domain}</span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase ${config.badgeBg} ${config.badgeText}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{config.label}</span>
            </span>
          </div>
          <h2 className={`text-xl font-bold ${config.text} mb-2`}>{config.title}</h2>
          <p className="text-sm text-slate-700 leading-relaxed max-w-2xl">{verdictSummary}</p>
        </div>
      </div>
    </div>
  );
};

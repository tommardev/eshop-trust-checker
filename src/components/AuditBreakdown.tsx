import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info,
  Scale,
  ShieldAlert,
  Server,
  CreditCard,
  HeartHandshake
} from 'lucide-react';
import { AuditCheckItem, StructuredRecommendations } from '@/types/audit';

interface AuditBreakdownProps {
  checklist: AuditCheckItem[];
  recommendations: StructuredRecommendations;
}

export const AuditBreakdown: React.FC<AuditBreakdownProps> = ({
  checklist,
  recommendations,
}) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'BLACKLIST':
        return <ShieldAlert className="h-5 w-5 text-rose-600" aria-hidden="true" />;
      case 'LEGAL':
        return <Scale className="h-5 w-5 text-blue-600" aria-hidden="true" />;
      case 'TECHNICAL':
        return <Server className="h-5 w-5 text-indigo-600" aria-hidden="true" />;
      case 'CONSUMER_RIGHTS':
        return <HeartHandshake className="h-5 w-5 text-emerald-600" aria-hidden="true" />;
      case 'PAYMENT':
        return <CreditCard className="h-5 w-5 text-violet-600" aria-hidden="true" />;
      default:
        return <Info className="h-5 w-5 text-slate-600" aria-hidden="true" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Atitinka
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Dėmesio
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Pažeidimas
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Informacija
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Rekomendacijos ir patarimai pirkėjui */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-700" aria-hidden="true" />
          <span>Išvados ir Rekomendacijos Pirkėjui</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {recommendations.keyPoints.map((kp, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border text-sm ${
                kp.type === 'danger'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : kp.type === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              <div className="font-semibold">{kp.title}</div>
              <div className="text-xs mt-1 opacity-90">{kp.description}</div>
            </div>
          ))}
        </div>

        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          {recommendations.list.map((rec, i) => (
            <li key={i}>{rec}</li>
          ))}
        </ul>

        {recommendations.vvtatAdviceLink && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs">
            <a
              href={recommendations.vvtatAdviceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 font-medium hover:underline inline-flex items-center gap-1"
            >
              Skaityti oficialius VVTAT patarimus: Kaip atpažinti fiktyvias internetines parduotuves →
            </a>
          </div>
        )}
      </div>

      {/* Detalus kriterijų sąrašas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-4">
          Detali Patikros Kriterijų Ataskaita
        </h3>

        <div className="divide-y divide-slate-100">
          {checklist.map((item) => (
            <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-slate-50 p-2 border border-slate-100">
                  {getCategoryIcon(item.category)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm sm:text-base">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                    {item.description}
                  </p>
                  {item.sourceReference && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      Šaltinis: {item.sourceReference}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 self-end sm:self-center">
                {getStatusBadge(item.status)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

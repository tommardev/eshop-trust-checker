import React from 'react';
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { JarEntityStatus, LegalEntityInfo } from '@/types/audit';

interface LegalSummaryCardProps {
  legal: LegalEntityInfo;
}

const JAR_STATUS_CONFIG: Record<
  JarEntityStatus,
  { label: string; badgeClass: string; Icon: LucideIcon }
> = {
  VEIKIANTI: {
    label: 'Veikiantis juridinis asmuo',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    Icon: CheckCircle2,
  },
  LIKVIDUOJAMA: {
    label: 'Likviduojama įmonė',
    badgeClass: 'bg-amber-100 text-amber-800',
    Icon: AlertTriangle,
  },
  BANKRUTUOJANTI: {
    label: 'Bankrutuojanti įmonė',
    badgeClass: 'bg-rose-100 text-rose-800',
    Icon: XCircle,
  },
  NEZINOMA: {
    label: 'Nežinomas / Neįvertintas registre',
    badgeClass: 'bg-slate-100 text-slate-700',
    Icon: Info,
  },
};

export const LegalSummaryCard: React.FC<LegalSummaryCardProps> = ({ legal }) => {
  const jarStatusConfig =
    JAR_STATUS_CONFIG[legal.jarStatus ?? 'NEZINOMA'] ?? JAR_STATUS_CONFIG.NEZINOMA;
  const JarStatusIcon = jarStatusConfig.Icon;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center space-x-2">
          <Building2 className="h-5 w-5 text-blue-700" aria-hidden="true" />
          <h3 className="font-bold text-slate-900">Juridinis Asmuo ir Rekvizitai</h3>
        </div>
        <div>
          {legal.found ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Rekvizitai nurodyti
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Nenurodyti
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Įmonės pavadinimas</span>
          <span className="font-medium text-slate-900">
            {legal.companyName || (legal.companyCode ? `Įmonė (kodas ${legal.companyCode})` : 'Nenurodytas')}
          </span>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Įmonės kodas (JAR)</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono font-medium text-slate-900">
              {legal.companyCode || 'Nenurodytas'}
            </span>
            {legal.companyCode && (
              legal.isValidCodeFormat !== false ? (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Formatas galioja (M11)
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  Neteisingas kontrolinis skaitmuo
                </span>
              )
            )}
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">PVM kodas</span>
          <span className="font-mono font-medium text-slate-900">
            {legal.vatCode || 'Nenurodytas / Ne PVM mokėtojas'}
          </span>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Statusas registre</span>
          <div className="mt-0.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${jarStatusConfig.badgeClass}`}
            >
              <JarStatusIcon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              {jarStatusConfig.label}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Buveinės adresas</span>
            <span className="text-slate-800">{legal.address || 'Adresas nenurodytas'}</span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Phone className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Kontaktinis telefonas</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-800 font-mono">{legal.phone || 'Nenurodytas'}</span>
              {legal.hasLegacyPhonePrefix && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  Pasenęs prefiksas 8
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 md:col-span-2">
          <Mail className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">El. paštas</span>
            <span className="text-slate-800">{legal.email || 'Nenurodytas'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

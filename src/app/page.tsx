'use client';

import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SearchBar } from '@/components/SearchBar';
import { TrustScoreGauge } from '@/components/TrustScoreGauge';
import { LegalSummaryCard } from '@/components/LegalSummaryCard';
import { AuditBreakdown } from '@/components/AuditBreakdown';
import { TrustAuditResult } from '@/types/audit';
import { AlertCircle, ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';

export default function Home() {
  const [auditResult, setAuditResult] = useState<TrustAuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<string>('');

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setActiveStep('Tikrinamas VVTAT blokuojamų svetainių registras...');

    try {
      const stepTimer1 = setTimeout(() => {
        setActiveStep('Tikrinama domeno registracija (WHOIS) ir SSL sertifikatas...');
      }, 700);

      const stepTimer2 = setTimeout(() => {
        setActiveStep('Ieškomi juridinio asmens rekvizitai ir vartotojų teisės...');
      }, 1500);

      const response = await fetch('/api/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Nepavyko atlikti el. parduotuvės audito.');
      }

      setAuditResult(data.data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Įvyko netikėta klaida tikrinant svetainę.');
      }
      setAuditResult(null);
    } finally {
      setIsLoading(false);
      setActiveStep('');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />

      <main className="flex-1">
        {/* Hero / Paieškos sekcija */}
        <section className="bg-gradient-to-b from-blue-900 to-slate-900 py-12 px-4 sm:px-6 lg:px-8 text-white text-center">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-800/80 px-3 py-1 text-xs font-semibold text-blue-200 border border-blue-700">
              <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
              <span>VVTAT 5 Auksinės Taisyklės & JAR Modulo 11 Patikra</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Ar ši el. parduotuvė saugi apsipirkti?
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
              Įveskite internetinės parduotuvės adresą ir akimirksniu patikrinkite, ar ji nėra įtraukta į teismo blokuojamus sąrašus, ar skelbia legalius rekvizitus bei saugo pirkėjų teises.
            </p>

            <div className="pt-4">
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            </div>
          </div>
        </section>

        {/* Būsenos sekcija */}
        <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {/* Krovimo indikatorius */}
          {isLoading && (
            <div className="my-8 rounded-2xl border border-blue-200 bg-blue-50/70 p-8 text-center shadow-sm">
              <div className="inline-flex items-center justify-center p-3 bg-blue-600 text-white rounded-full mb-3 animate-spin">
                <RefreshCw className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">Vykdomas išsamus patikrinimas</h3>
              <p className="text-sm text-slate-600 animate-pulse">{activeStep}</p>
            </div>
          )}

          {/* Klaidos pranešimas */}
          {error && !isLoading && (
            <div className="my-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 flex items-start gap-4 text-rose-900 shadow-sm" role="alert">
              <AlertCircle className="h-6 w-6 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm sm:text-base">Klaida atliekant auditą</h3>
                <p className="text-xs sm:text-sm mt-1 text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {/* Audito Rezultatai */}
          {auditResult && !isLoading && (
            <div className="space-y-6 animate-fadeIn">
              {/* VVTAT juodojo sąrašo įspėjimas viršuje jei blokuojama */}
              {auditResult.blacklist.isVvtatBlocked && (
                <div className="rounded-2xl border-2 border-rose-600 bg-rose-100 p-6 flex items-start gap-4 text-rose-950 shadow-md">
                  <ShieldAlert className="h-8 w-8 text-rose-700 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-extrabold uppercase tracking-wide text-rose-900">
                      DĖMESIO: BLOKUOJAMA SVETAINĖ
                    </h3>
                    <p className="text-sm font-medium mt-1">
                      {auditResult.blacklist.vvtatDetails}
                    </p>
                  </div>
                </div>
              )}

              {/* Šviesoforas ir įvertinimo balas */}
              <TrustScoreGauge
                score={auditResult.trustScore}
                level={auditResult.trustLevel}
                domain={auditResult.domain}
                verdictSummary={auditResult.verdictSummary}
              />

              {/* Juridinio asmens suvestinė */}
              <LegalSummaryCard legal={auditResult.legalEntity} />

              {/* Išsami kriterijų ir rekomendacijų ataskaita */}
              <AuditBreakdown
                checklist={auditResult.checklist}
                recommendations={auditResult.recommendations}
              />
            </div>
          )}

          {/* Tuščia pradinė būsena */}
          {!auditResult && !isLoading && !error && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 mb-4 font-bold text-lg">
                  1
                </div>
                <h3 className="font-bold text-slate-900 mb-2">VVTAT Juodieji Sąrašai</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tikrinama pagal teismo sprendimu blokuojamų netikrų parduotuvių registrą.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 mb-4 font-bold text-lg">
                  2
                </div>
                <h3 className="font-bold text-slate-900 mb-2">JAR Modulo 11 Rekvizitai</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Patvirtinamas įmonės kodo kontrolinis skaičius ir atitiktis LR teisės aktams.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 mb-4 font-bold text-lg">
                  3
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Vartotojų Teisės & SSL</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Analizuojama 14 dienų grąžinimo politika, šifruotas ryšys ir mokėjimo būdai.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

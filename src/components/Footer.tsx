import React from 'react';
import { Shield, BookOpen, AlertTriangle } from 'lucide-react';
import { getAppVersion } from '@/lib/app-version';

export const Footer: React.FC = () => {
  const appVersion = getAppVersion();

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-8 text-slate-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center space-x-2 text-slate-900 font-semibold mb-2">
              <Shield className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <span>Apie Įrankį</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Nemokamas atviro kodo įrankis, padedantis pirkėjams atpažinti fiktyvias ar nesaugias interneto parduotuves pagal oficialius LR institucijų reikalavimus.
            </p>
          </div>

          <div>
            <div className="flex items-center space-x-2 text-slate-900 font-semibold mb-2">
              <BookOpen className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <span>Oficialūs Šaltiniai</span>
            </div>
            <ul className="text-sm space-y-1.5">
              <li>
                <a
                  href="https://vvtat.lrv.lt/lt/naujienos-ir-pranesimai-ziniasklaidai-377/fiktyvios-internetines-parduotuves-kaip-atpazinti-ir-neapsigauti-977/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-700 hover:underline"
                >
                  VVTAT 5 auksinės taisyklės
                </a>
              </li>
              <li>
                <a
                  href="https://www.registrucentras.lt/jar/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-700 hover:underline"
                >
                  Juridinių asmenų registras (JAR)
                </a>
              </li>
              <li>
                <a
                  href="https://www.rrt.lt/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-700 hover:underline"
                >
                  RRT nacionalinis numeracijos planas
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="flex items-center space-x-2 text-slate-900 font-semibold mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
              <span>Atsakomybės Apribojimas</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Audito rezultatai yra rekomendacinio pobūdžio, gauti automatizuotos viešų registrų ir svetainės techninės analizės būdu. Prieš atlikdami mokėjimus visada įvertinkite riziką.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} E-Shop Trust Checker ·{' '}
          <span className="font-mono" aria-label={`Programos versija ${appVersion}`}>
            {appVersion}
          </span>
          . Parengta pagal LR teisės aktus ir VVTAT gaires.
        </div>
      </div>
    </footer>
  );
};

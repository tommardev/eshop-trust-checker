import React from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 text-white shadow-md">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              LT E-Shop Trust Checker
            </h1>
            <p className="text-xs text-slate-600 sm:text-sm">
              Lietuvos el. parduotuvių atitikties ir saugumo auditas pagal VVTAT taisykles
            </p>
          </div>
        </div>

        <nav className="flex items-center space-x-4 text-xs sm:text-sm">
          <a
            href="https://vvtat.lrv.lt/lt/blokuojami-tinklalapiai-646/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-medium text-slate-700 hover:text-blue-700"
          >
            <span>VVTAT Registras</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  );
};

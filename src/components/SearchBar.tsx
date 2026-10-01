import React, { useState } from 'react';
import { Search, Loader2, ArrowRight } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSearch(input.trim());
    }
  };

  const handleChipClick = (domain: string) => {
    setInput(domain);
    onSearch(domain);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative flex items-center shadow-lg rounded-2xl bg-white border border-slate-200 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent transition-all">
        <div className="pl-4 text-slate-400">
          <Search className="h-6 w-6" aria-hidden="true" />
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Įveskite el. parduotuvės domeną arba URL (pvz., pigu.lt)..."
          disabled={isLoading}
          aria-label="El. parduotuvės adresas"
          className="w-full py-4 pl-3 pr-28 text-base text-slate-900 bg-transparent placeholder-slate-400 focus:outline-none disabled:opacity-50"
        />
        <div className="absolute right-2">
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="hidden sm:inline">Tikrinama...</span>
              </>
            ) : (
              <>
                <span>Tikrinti</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Pavyzdiniai domenai greitai patikrai */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Išbandykite pavyzdžius:</span>
        <button
          type="button"
          onClick={() => handleChipClick('kalykla.lt')}
          disabled={isLoading}
          className="rounded-full bg-slate-200/80 px-2.5 py-1 text-slate-700 hover:bg-slate-300 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          kalykla.lt (Valstybinis)
        </button>
        <button
          type="button"
          onClick={() => handleChipClick('pigu.lt')}
          disabled={isLoading}
          className="rounded-full bg-slate-200/80 px-2.5 py-1 text-slate-700 hover:bg-slate-300 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          pigu.lt (Prekyvietė)
        </button>
        <button
          type="button"
          onClick={() => handleChipClick('senukai.lt')}
          disabled={isLoading}
          className="rounded-full bg-slate-200/80 px-2.5 py-1 text-slate-700 hover:bg-slate-300 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          senukai.lt (Prekybos tinklas)
        </button>
      </div>
    </div>
  );
};

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, AlertCircle } from 'lucide-react';

interface DenialCode {
  id: number;
  code: string;
  codeType: string;
  description: string;
  category: string | null;
}

interface DenialCodeSearchProps {
  selectedCode: DenialCode | null;
  onSelect: (code: DenialCode | null) => void;
  onReasonChange?: (reason: string) => void;
  initialReason?: string;
}

export function DenialCodeSearch({ selectedCode, onSelect, onReasonChange, initialReason }: DenialCodeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DenialCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [denialReason, setDenialReason] = useState(initialReason || '');
  const [reasonEdited, setReasonEdited] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize reason from selected code
  useEffect(() => {
    if (initialReason) setDenialReason(initialReason);
  }, [initialReason]);

  // Search denial codes with debounce
  const searchCodes = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      // Load first 30 codes when empty
      setLoading(true);
      try {
        const res = await fetch('/api/denial-codes?limit=30', { credentials: 'include' });
        const d = await res.json();
        if (res.ok) setResults(d.denialCodes || []);
      } catch {}
      finally { setLoading(false); }
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/denial-codes?search=${encodeURIComponent(searchQuery)}&limit=20`, { credentials: 'include' });
      const d = await res.json();
      if (res.ok) {
        let codes = d.denialCodes || [];
        // Sort by relevance: exact code match first, then starts-with, then contains
        const q = searchQuery.toLowerCase();
        codes.sort((a: DenialCode, b: DenialCode) => {
          const aCode = a.code.toLowerCase();
          const bCode = b.code.toLowerCase();
          const aDesc = a.description.toLowerCase();
          const bDesc = b.description.toLowerCase();
          // Exact code match
          if (aCode === q && bCode !== q) return -1;
          if (bCode === q && aCode !== q) return 1;
          // Code starts with query
          if (aCode.startsWith(q) && !bCode.startsWith(q)) return -1;
          if (bCode.startsWith(q) && !aCode.startsWith(q)) return 1;
          // Description starts with query
          if (aDesc.startsWith(q) && !bDesc.startsWith(q)) return -1;
          if (bDesc.startsWith(q) && !aDesc.startsWith(q)) return 1;
          return 0;
        });
        setResults(codes);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setHighlightIdx(-1);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCodes(value), 250);
  };

  const handleSelect = (code: DenialCode) => {
    // If user has edited the reason, ask before replacing
    if (reasonEdited && denialReason.trim() && denialReason !== selectedCode?.description) {
      const replace = confirm('The denial code has changed. Do you want to replace the current denial reason with the standard reason for the newly selected denial code?');
      if (!replace) {
        // Keep current reason, just update the code
        onSelect(code);
        setQuery('');
        setShowDropdown(false);
        return;
      }
    }

    onSelect(code);
    setDenialReason(code.description);
    setReasonEdited(false);
    onReasonChange?.(code.description);
    setQuery('');
    setShowDropdown(false);
  };

  const handleClear = () => {
    onSelect(null);
    setDenialReason('');
    setReasonEdited(false);
    onReasonChange?.('');
    setQuery('');
  };

  const handleReasonEdit = (value: string) => {
    setDenialReason(value);
    setReasonEdited(true);
    onReasonChange?.(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIdx]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Denial Code Search */}
      <div ref={wrapperRef} className="relative">
        <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
          Denial Code
        </label>

        {selectedCode ? (
          /* Selected state */
          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[#2563EB] bg-blue-50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#2563EB]">{selectedCode.codeType}-{selectedCode.code}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB] font-medium">{selectedCode.codeType}</span>
              </div>
              <p className="text-sm text-slate-700 mt-0.5 truncate">{selectedCode.description}</p>
            </div>
            <button onClick={handleClear} className="p-1 rounded hover:bg-blue-100 text-[#64748B] hover:text-[#DC2626] transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Search input */
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => handleInputChange(e.target.value)}
              onFocus={() => { setShowDropdown(true); if (!query) searchCodes(''); }}
              onKeyDown={handleKeyDown}
              placeholder="Search denial code, reason, description, or category..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-[#94A3B8]"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Dropdown results */}
        {showDropdown && !selectedCode && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-lg border border-[#E5E7EB] shadow-xl max-h-72 overflow-y-auto">
            {results.length === 0 && !loading ? (
              <div className="px-4 py-6 text-center">
                <AlertCircle className="w-5 h-5 text-[#94A3B8] mx-auto mb-2" />
                <p className="text-sm text-[#64748B]">No matching denial code found</p>
                <p className="text-xs text-[#94A3B8] mt-1">Try searching by code, description, or category</p>
              </div>
            ) : (
              results.map((code, idx) => (
                <button
                  key={code.id}
                  onClick={() => handleSelect(code)}
                  className={`w-full text-left px-4 py-2.5 border-b border-[#F1F5F9] last:border-0 transition-colors ${
                    idx === highlightIdx ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-[#2563EB] flex-shrink-0">{code.codeType}-{code.code}</span>
                      <span className="text-sm text-slate-800 truncate">— {code.description.length > 70 ? code.description.substring(0, 70) + '...' : code.description}</span>
                    </div>
                    {code.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-[#64748B] font-medium flex-shrink-0 ml-2 whitespace-nowrap">
                        {code.category}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Auto-populated Denial Category (read-only) */}
      {selectedCode && (
        <div>
          <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
            Denial Category
          </label>
          <div className="px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] bg-[#F5F7FA] text-sm text-slate-700">
            {selectedCode.category || 'Uncategorized'}
          </div>
        </div>
      )}

      {/* Denial Reason (auto-populated, editable) */}
      {selectedCode && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Denial Reason
            </label>
            {reasonEdited && (
              <span className="text-[10px] text-amber-600 font-medium">✏️ Modified</span>
            )}
          </div>
          <textarea
            value={denialReason}
            onChange={e => handleReasonEdit(e.target.value)}
            rows={4}
            placeholder="Denial reason auto-populated from the selected code. You can add claim-specific details."
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] resize-none"
          />
          <p className="text-[11px] text-[#94A3B8] mt-1">
            Auto-populated from denial master list. You may edit to add claim-specific details.
          </p>
        </div>
      )}
    </div>
  );
}

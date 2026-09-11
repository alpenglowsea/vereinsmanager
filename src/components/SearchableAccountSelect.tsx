import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface SearchableAccountOption {
  value: string;
  code?: string;
  name: string;
  label?: string;
  group?: string;
  vatRateDefault?: 0 | 7 | 19;
}

interface SearchableAccountSelectProps {
  label: React.ReactNode;
  headerRight?: React.ReactNode;
  value: string;
  options: SearchableAccountOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export const SearchableAccountSelect: React.FC<SearchableAccountSelectProps> = ({
  label,
  headerRight,
  value,
  options,
  onChange,
  placeholder = 'Konto auswählen...',
  searchPlaceholder = 'Nummer oder Begriff tippen...',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredOption, setHoveredOption] = useState<SearchableAccountOption | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find(
      opt =>
        opt.value === value ||
        (opt.code && opt.code === value) ||
        (opt.label && opt.label === value)
    );
  }, [options, value]);

  // Filter options based on search query (case-insensitive across code, name, label, and group)
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(opt => {
      const codeMatch = opt.code ? opt.code.toLowerCase().includes(q) : false;
      const nameMatch = opt.name ? opt.name.toLowerCase().includes(q) : false;
      const labelMatch = opt.label ? opt.label.toLowerCase().includes(q) : false;
      const groupMatch = opt.group ? opt.group.toLowerCase().includes(q) : false;
      return codeMatch || nameMatch || labelMatch || groupMatch;
    });
  }, [options, searchQuery]);

  // Group options if 'group' property exists
  const groupedOptions = useMemo(() => {
    const hasGroups = filteredOptions.some(opt => opt.group);
    if (!hasGroups) return null;

    const map = new Map<string, SearchableAccountOption[]>();
    filteredOptions.forEach(opt => {
      const g = opt.group || 'Weitere';
      if (!map.has(g)) {
        map.set(g, []);
      }
      map.get(g)!.push(opt);
    });
    return Array.from(map.entries());
  }, [filteredOptions]);

  const handleMouseEnterOption = (opt: SearchableAccountOption, e: React.MouseEvent) => {
    setHoveredOption(opt);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMoveOption = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeaveOption = () => {
    setHoveredOption(null);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
    setHoveredOption(null);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Header bar with fixed height (h-5) to guarantee pixel-perfect vertical alignment */}
      <div className="h-5 flex items-center justify-between mb-1.5 leading-none">
        <div className="text-2xs font-bold text-slate-700 flex items-center gap-1 truncate">
          {label}
        </div>
        {headerRight && (
          <div className="shrink-0 flex items-center text-3xs">
            {headerRight}
          </div>
        )}
      </div>

      {/* Select Trigger Box with fixed height (h-10) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onMouseEnter={(e) => selectedOption && handleMouseEnterOption(selectedOption, e)}
        onMouseMove={(e) => selectedOption && handleMouseMoveOption(e)}
        onMouseLeave={handleMouseLeaveOption}
        className={`w-full h-10 px-3 py-2 border rounded-lg text-xs bg-white transition-all flex items-center justify-between gap-2 shadow-2xs text-left cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'hover:border-slate-400'
        } ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-300'}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {selectedOption ? (
            <>
              {selectedOption.code && (
                <span className="font-mono text-2xs font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                  {selectedOption.code}
                </span>
              )}
              <span className="font-semibold text-slate-800 truncate">
                {selectedOption.name}
              </span>
              {selectedOption.vatRateDefault !== undefined && selectedOption.vatRateDefault > 0 && (
                <span className="text-3xs text-slate-400 shrink-0 font-medium">
                  ({selectedOption.vatRateDefault}% USt)
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
      </button>

      {/* Searchable Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Live Search Input Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Suche löschen"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 text-xs">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                Kein Konto für „{searchQuery}“ gefunden.
              </div>
            ) : groupedOptions ? (
              groupedOptions.map(([groupName, groupItems]) => (
                <div key={groupName} className="py-1">
                  <div className="px-3 py-1 text-3xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/90 sticky top-0 border-y border-slate-100/80">
                    {groupName}
                  </div>
                  {groupItems.map(opt => {
                    const isSelected =
                      selectedOption?.value === opt.value ||
                      (selectedOption?.code && selectedOption.code === opt.code);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        onMouseEnter={(e) => handleMouseEnterOption(opt, e)}
                        onMouseMove={handleMouseMoveOption}
                        onMouseLeave={handleMouseLeaveOption}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {opt.code && (
                            <span
                              className={`font-mono text-2xs font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                isSelected
                                  ? 'bg-blue-100 border-blue-200 text-blue-800'
                                  : 'bg-slate-100 border-slate-200 text-slate-800'
                              }`}
                            >
                              {opt.code}
                            </span>
                          )}
                          <span className="truncate">{opt.name}</span>
                          {opt.vatRateDefault !== undefined && opt.vatRateDefault > 0 && (
                            <span className="text-3xs text-slate-400 font-normal shrink-0">
                              ({opt.vatRateDefault}% USt)
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              filteredOptions.map(opt => {
                const isSelected =
                  selectedOption?.value === opt.value ||
                  (selectedOption?.code && selectedOption.code === opt.code);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={(e) => handleMouseEnterOption(opt, e)}
                    onMouseMove={handleMouseMoveOption}
                    onMouseLeave={handleMouseLeaveOption}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.code && (
                        <span
                          className={`font-mono text-2xs font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                            isSelected
                              ? 'bg-blue-100 border-blue-200 text-blue-800'
                              : 'bg-slate-100 border-slate-200 text-slate-800'
                          }`}
                        >
                          {opt.code}
                        </span>
                      )}
                      <span className="truncate">{opt.name}</span>
                      {opt.vatRateDefault !== undefined && opt.vatRateDefault > 0 && (
                        <span className="text-3xs text-slate-400 font-normal shrink-0">
                          ({opt.vatRateDefault}% USt)
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer count */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-3xs text-slate-400 flex items-center justify-between">
            <span>{filteredOptions.length} Konten verfügbar</span>
            <span className="text-slate-400">Tipp: Tippen Sie z.B. 40000 oder Name</span>
          </div>
        </div>
      )}

      {/* Cursor-following full-text pop-up for truncated accounts */}
      {hoveredOption && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none max-w-sm sm:max-w-md bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/90 rounded-xl p-3 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-75"
          style={{
            top: `${Math.min(mousePos.y + 16, window.innerHeight - 130)}px`,
            left: `${Math.max(12, Math.min(mousePos.x + 16, window.innerWidth - 380))}px`,
          }}
        >
          <div className="flex items-center gap-2">
            {hoveredOption.code && (
              <span className="font-mono text-xs font-black bg-blue-600 text-white px-2 py-0.5 rounded shadow-xs">
                {hoveredOption.code}
              </span>
            )}
            {hoveredOption.group && (
              <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold truncate">
                {hoveredOption.group}
              </span>
            )}
            {hoveredOption.vatRateDefault !== undefined && (
              <span className="text-3xs font-medium text-amber-300 ml-auto bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-800 shrink-0">
                {hoveredOption.vatRateDefault}% USt
              </span>
            )}
          </div>
          <div className="text-xs font-bold text-white leading-relaxed break-words">
            {hoveredOption.name}
          </div>
          {hoveredOption.label && hoveredOption.label !== hoveredOption.name && (
            <div className="text-2xs text-slate-300 leading-tight">
              {hoveredOption.label}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import type { ViewMode, AppTheme } from '../types';
import * as Icons from 'lucide-react';

interface NavbarProps {
  projectName: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetWorld: () => void;
  onOpenHelp: () => void;
  onOpenWorldManager: () => void;
  localDirectoryName: string | null;
  onChangeDirectory: () => void;
}

const VIEW_TABS: { id: ViewMode; label: string; icon: any }[] = [
  { id: 'canvas', label: 'Canvas', icon: Icons.LayoutGrid },
  { id: 'library', label: 'Galeri', icon: Icons.Library },
  { id: 'timeline', label: 'Timeline', icon: Icons.Clock },
  { id: 'documents', label: 'Dokumen', icon: Icons.BookOpen },
];

export const Navbar: React.FC<NavbarProps> = ({
  projectName,
  viewMode,
  onViewModeChange,
  currentTheme,
  onThemeChange,
  onExport,
  onImport,
  onResetWorld,
  onOpenHelp,
  onOpenWorldManager,
  localDirectoryName,
  onChangeDirectory,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-11 bg-[#2c2c2c] border-b border-[#383838] px-3 flex items-center justify-between z-40 relative select-none text-white transition-colors shadow-xs">
      
      {/* LEFT: Figma Icon Menu & Project Switcher */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenWorldManager}
          className="w-7 h-7 rounded-lg bg-[#383838] hover:bg-[#444444] text-[#0d99ff] font-extrabold flex items-center justify-center text-xs shadow-xs transition-colors cursor-pointer"
          title="Buka Pengelola Dunia & Workspace"
        >
          <img src="/wd-logo-circle.png" alt="WD Logo" className="w-4 h-4 object-contain rounded-full" />
        </button>

        <button
          type="button"
          onClick={onOpenWorldManager}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-200 hover:text-white hover:bg-[#383838] transition-all text-xs font-semibold group cursor-pointer"
          title="Buka Pengelola Workspace & Dunia"
        >
          <span className="truncate max-w-[140px] sm:max-w-[200px]">
            {projectName}
          </span>
          <Icons.ChevronDown size={12} className="text-slate-400 group-hover:text-white transition-colors" />
        </button>
      </div>

      {/* CENTER: Figma Segmented View Mode Switcher Pills */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-0.5 bg-[#1e1e1e] p-1 rounded-xl border border-[#383838] shadow-inner">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={(e) => {
                (e.currentTarget as HTMLElement).blur();
                onViewModeChange(tab.id);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none select-none border ${
                isActive
                  ? 'bg-[#2c2c2c] text-white font-bold shadow-xs border-[#383838]'
                  : 'border-transparent text-slate-200 hover:text-white hover:bg-[#2c2c2c]/50'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-[#0d99ff]' : 'text-slate-300'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* RIGHT: Figma Menu Dropdown */}
      <div className="flex items-center gap-2">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="px-3 py-1 rounded-lg text-slate-200 hover:text-white hover:bg-[#383838] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#383838] outline-none focus:outline-none select-none"
            title="Opsi & Menu Proyek"
          >
            <Icons.SlidersHorizontal size={13} className="text-[#0d99ff]" />
            <span>Menu</span>
            <Icons.ChevronDown size={12} className={`text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#2c2c2c] border border-[#383838] rounded-2xl shadow-2xl p-1.5 z-50 text-xs text-[#f8fafc] animate-in fade-in zoom-in-95 duration-100 space-y-1.5 select-none overflow-hidden">
              {/* Header Brand Badge */}
              <div className="px-3 py-2.5 rounded-xl bg-[#1e1e1e] border border-[#383838] flex items-center gap-2.5">
                <img src="/wd-logo-circle.png" alt="World Deck" className="w-6 h-6 object-contain rounded-full shadow-sm" />
                <div>
                  <div className="font-bold text-xs text-white leading-tight">World Deck</div>
                  <div className="text-[10px] text-slate-400">Cards Worldbuilding</div>
                </div>
              </div>

              {/* Workspace Folder Row */}
              {localDirectoryName ? (
                <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <Icons.FolderClosed size={13} className="shrink-0" />
                    <span className="truncate">{localDirectoryName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onChangeDirectory();
                    }}
                    className="text-[10px] underline hover:text-white cursor-pointer shrink-0"
                  >
                    Ubah
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onChangeDirectory();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl hover:bg-[#383838] flex items-center gap-2 transition-colors font-medium text-amber-400 cursor-pointer"
                >
                  <Icons.FolderOpen size={14} />
                  <span>Pilih Folder Workspace</span>
                </button>
              )}

              <div className="border-t border-[#383838]" />

              {/* Import & Export Menu Items */}
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onExport();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl hover:bg-[#383838] flex items-center gap-2 text-slate-200 hover:text-white transition-colors cursor-pointer font-medium"
                >
                  <Icons.Download size={14} className="text-[#0d99ff]" />
                  <span>Ekspor Proyek (JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl hover:bg-[#383838] flex items-center gap-2 text-slate-200 hover:text-white transition-colors cursor-pointer font-medium"
                >
                  <Icons.Upload size={14} className="text-[#0d99ff]" />
                  <span>Impor Proyek (JSON)</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    onImport(e);
                    setIsMenuOpen(false);
                  }}
                  className="hidden"
                />
              </div>

              <div className="border-t border-[#383838]" />

              {/* Theme Segmented Switcher */}
              <div className="p-1 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span>Tema Aplikasi</span>
                  <Icons.Palette size={12} className="text-slate-400" />
                </div>
                <div className="grid grid-cols-2 gap-1 bg-[#1e1e1e] p-1 rounded-xl border border-[#383838]">
                  <button
                    type="button"
                    onClick={() => onThemeChange('light')}
                    className={`px-2 py-1 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      currentTheme === 'light'
                        ? 'bg-[#0d99ff] text-white shadow-xs font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-[#383838]'
                    }`}
                  >
                    <Icons.Sun size={13} className={currentTheme === 'light' ? 'text-amber-300' : 'text-slate-400'} />
                    <span>Terang</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onThemeChange('dark')}
                    className={`px-2 py-1 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      currentTheme === 'dark'
                        ? 'bg-[#0d99ff] text-white shadow-xs font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-[#383838]'
                    }`}
                  >
                    <Icons.Moon size={13} className={currentTheme === 'dark' ? 'text-blue-200' : 'text-slate-400'} />
                    <span>Gelap</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-[#383838]" />

              {/* Help & Reset Actions */}
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenHelp();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl hover:bg-[#383838] flex items-center gap-2 text-slate-200 hover:text-white transition-colors cursor-pointer font-medium"
                >
                  <Icons.HelpCircle size={14} className="text-slate-400" />
                  <span>Panduan Worldbuilding</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onResetWorld();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl hover:bg-[#383838] text-rose-400 flex items-center gap-2 transition-colors cursor-pointer font-medium"
                >
                  <Icons.RotateCcw size={14} />
                  <span>Bersihkan Workspace</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import type { ViewMode, AppTheme } from '../types';
import * as Icons from 'lucide-react';

interface NavbarProps {
  projectName: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onAddCard: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetWorld: () => void;
  onOpenHelp: () => void;
  onOpenWorldManager: () => void;
  totalCards: number;
  totalConnections: number;
  localFileName: string | null;
  onConnectLocalFile: () => void;
  onOpenLocalFile: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  projectName,
  viewMode,
  onViewModeChange,
  currentTheme,
  onThemeChange,
  onAddCard,
  onExport,
  onImport,
  onResetWorld,
  onOpenHelp,
  onOpenWorldManager,
  totalCards,
  totalConnections,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
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
    <header className="h-12 app-bg-main border-b app-border px-3 md:px-4 flex items-center justify-between z-40 relative select-none transition-colors">
      
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onOpenWorldManager}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md app-text-muted hover:app-text-main app-bg-hover transition-colors font-medium"
          title="Buka Pengelola Dunia (Menu Utama)"
        >
          <Icons.Globe size={15} className="app-accent-text" />
          <span>{projectName}</span>
        </button>

        <span className="opacity-40">/</span>

        <div className="flex items-center gap-1.5 font-medium px-2 py-1 app-text-main">
          <Icons.LayoutGrid size={14} className="app-text-muted" />
          <span className="text-[10px] px-1.5 py-0.2 rounded app-bg-secondary font-mono border app-border app-text-muted">
            {totalCards} Kartu • {totalConnections} Relasi
          </span>

          <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 font-medium items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Tersimpan Otomatis</span>
          </span>
        </div>
      </div>

      {/* View Mode Switcher (Database Tabs) */}
      <div className="hidden lg:flex items-center gap-0.5 app-bg-secondary p-1 rounded-lg border app-border">
        <button
          type="button"
          onClick={() => onViewModeChange('canvas')}
          className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            viewMode === 'canvas'
              ? 'app-bg-main app-text-main shadow-sm font-semibold'
              : 'app-text-muted hover:app-text-main app-bg-hover'
          }`}
        >
          <Icons.LayoutGrid size={13} />
          <span>Canvas Graph</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('library')}
          className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            viewMode === 'library'
              ? 'app-bg-main app-text-main shadow-sm font-semibold'
              : 'app-text-muted hover:app-text-main app-bg-hover'
          }`}
        >
          <Icons.Library size={13} />
          <span>Galeri Grid</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('timeline')}
          className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            viewMode === 'timeline'
              ? 'app-bg-main app-text-main shadow-sm font-semibold'
              : 'app-text-muted hover:app-text-main app-bg-hover'
          }`}
        >
          <Icons.Clock size={13} />
          <span>Timeline</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange('relations')}
          className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
            viewMode === 'relations'
              ? 'app-bg-main app-text-main shadow-sm font-semibold'
              : 'app-text-muted hover:app-text-main app-bg-hover'
          }`}
        >
          <Icons.GitCommit size={13} />
          <span>Tabel Relasi</span>
        </button>
      </div>

      {/* Right Controls Area */}
      <div className="flex items-center gap-2">
        
        {/* Undo / Redo Buttons */}
        <div className="flex items-center gap-0.5 app-bg-secondary border app-border rounded-lg p-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-md transition-colors ${
              canUndo
                ? 'app-text-main hover:app-bg-hover cursor-pointer'
                : 'app-text-muted opacity-30 cursor-not-allowed'
            }`}
            title="Undo / Batal Perubahan (Ctrl + Z)"
          >
            <Icons.Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-md transition-colors ${
              canRedo
                ? 'app-text-main hover:app-bg-hover cursor-pointer'
                : 'app-text-muted opacity-30 cursor-not-allowed'
            }`}
            title="Redo / Ulangi Perubahan (Ctrl + Y)"
          >
            <Icons.Redo2 size={14} />
          </button>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onAddCard}
          className="px-3 py-1.5 rounded-lg app-accent-bg text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-transform active:scale-95"
        >
          <Icons.Plus size={14} strokeWidth={2.5} />
          <span>Tambah Kartu</span>
        </button>

        {/* Theme Selector */}
        <div className="flex items-center gap-1 app-bg-secondary border app-border rounded-lg px-2 py-1 text-xs">
          <Icons.Palette size={14} className="app-accent-text" />
          <select
            value={currentTheme}
            onChange={(e) => onThemeChange(e.target.value as AppTheme)}
            className="bg-transparent app-text-main text-xs focus:outline-none cursor-pointer"
            title="Pilih Tema Warna Aplikasi"
          >
            <option value="notion-dark" className="app-bg-secondary app-text-main">🖤 Notion Dark</option>
            <option value="notion-light" className="app-bg-secondary app-text-main">📄 Notion Light</option>
            <option value="cyberpunk" className="app-bg-secondary app-text-main">🌆 Cyberpunk</option>
            <option value="dracula" className="app-bg-secondary app-text-main">🧛 Dracula</option>
            <option value="nordic" className="app-bg-secondary app-text-main">❄️ Nordic Slate</option>
          </select>
        </div>

        {/* Consolidated Actions Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="px-2.5 py-1 rounded-lg app-bg-secondary border app-border app-text-main hover:app-bg-hover text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Opsi & Menu Proyek"
          >
            <Icons.SlidersHorizontal size={14} className="app-text-muted" />
            <span className="hidden sm:inline">Menu Proyek</span>
            <Icons.ChevronDown size={13} className={`app-text-muted transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 app-bg-secondary border app-border rounded-xl shadow-2xl py-1.5 z-50 text-xs app-text-main animate-in fade-in zoom-in-95 duration-100 space-y-0.5">
              
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onExport();
                }}
                className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors"
              >
                <Icons.Download size={14} className="app-accent-text" />
                <span>Ekspor Proyek (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors"
              >
                <Icons.Upload size={14} className="app-accent-text" />
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

              <div className="my-1 border-t app-border opacity-50" />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenHelp();
                }}
                className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors"
              >
                <Icons.HelpCircle size={14} className="app-text-muted" />
                <span>Panduan Worldbuilding</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onResetWorld();
                }}
                className="w-full px-3 py-2 text-left hover:app-bg-hover text-amber-500 flex items-center gap-2 transition-colors"
              >
                <Icons.RotateCcw size={14} />
                <span>Bersihkan Canvas</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

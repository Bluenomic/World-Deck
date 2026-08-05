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
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
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
    <header className="h-12 app-bg-main px-4 md:px-6 flex items-center justify-between z-40 relative select-none transition-colors">
      
      {/* LEFT: Project Name & Workspace Switcher Trigger */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenWorldManager}
          className="flex items-center gap-2 px-2 py-1 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/40 transition-all font-bold group cursor-pointer"
          title="Buka Pengelola Workspace & Dunia"
        >
          <img
            src="/wd-logo-circle.png"
            alt="World Deck Logo"
            className="w-6 h-6 object-contain rounded-full shadow-md group-hover:scale-105 transition-transform"
          />
          <span className="text-xs md:text-sm font-extrabold tracking-tight truncate max-w-[140px] sm:max-w-[200px]">
            {projectName}
          </span>
          <Icons.ChevronDown size={13} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
        </button>
      </div>

      {/* CENTER: Minimalist Navigation Controls */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onViewModeChange(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'app-accent-bg text-white font-bold shadow-xs'
                  : 'app-text-muted hover:app-text-main app-bg-hover'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* RIGHT: Action Controls (Undo, Redo, Theme, Menu) */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo Controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2 rounded-xl transition-all ${
              canUndo
                ? 'text-slate-300 hover:text-white hover:bg-slate-800/40 cursor-pointer active:scale-95'
                : 'text-slate-600 opacity-40 cursor-not-allowed'
            }`}
            title="Undo / Batal Perubahan (Ctrl + Z)"
          >
            <Icons.Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-2 rounded-xl transition-all ${
              canRedo
                ? 'text-slate-300 hover:text-white hover:bg-slate-800/40 cursor-pointer active:scale-95'
                : 'text-slate-600 opacity-40 cursor-not-allowed'
            }`}
            title="Redo / Ulangi Perubahan (Ctrl + Y)"
          >
            <Icons.Redo2 size={16} />
          </button>
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/40 transition-colors cursor-pointer"
          title={currentTheme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
        >
          {currentTheme === 'dark' ? <Icons.Sun size={17} /> : <Icons.Moon size={17} />}
        </button>

        {/* Consolidated Actions Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Opsi & Menu Proyek"
          >
            <Icons.SlidersHorizontal size={15} className="text-slate-400" />
            <span className="hidden sm:inline">Menu</span>
            <Icons.ChevronDown size={13} className={`text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 app-bg-secondary border border-slate-700/60 rounded-2xl shadow-2xl py-1.5 z-50 text-xs app-text-main animate-in fade-in zoom-in-95 duration-100 space-y-0.5 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-800 app-bg-main flex items-center gap-2.5">
                <img src="/wd-logo-circle.png" alt="World Deck" className="w-6 h-6 object-contain rounded-full" />
                <div>
                  <div className="font-bold text-xs app-text-main leading-tight">World Deck</div>
                  <div className="text-[10px] text-slate-400">Cards Worldbuilding</div>
                </div>
              </div>

              {localDirectoryName && (
                <div className="px-3 py-2 bg-emerald-950/30 text-emerald-400 font-semibold border-b border-slate-800 flex items-center gap-1.5 select-none" title={`Folder Workspace: ${localDirectoryName}`}>
                  <Icons.FolderClosed size={13} className="text-emerald-400 min-w-[13px]" />
                  <span className="truncate">WS: {localDirectoryName}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onChangeDirectory();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 transition-colors font-medium text-amber-500 cursor-pointer"
              >
                <Icons.FolderOpen size={14} />
                <span>Ganti Folder Workspace</span>
              </button>

              <div className="my-1 border-t border-slate-800" />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onExport();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Icons.Download size={14} className="text-blue-400" />
                <span>Ekspor Proyek (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Icons.Upload size={14} className="text-blue-400" />
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

              <div className="my-1 border-t border-slate-800" />

              {/* Theme Selector inside Dropdown */}
              <button
                type="button"
                onClick={() => {
                  onThemeChange(currentTheme === 'dark' ? 'light' : 'dark');
                  setIsMenuOpen(false);
                }}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-800 transition-colors text-xs font-semibold cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Icons.Palette size={14} className="text-slate-400" />
                  <span>Tema Aplikasi</span>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {currentTheme === 'dark' ? 'Mode Gelap' : 'Mode Terang'}
                </span>
              </button>

              <div className="my-1 border-t border-slate-800" />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenHelp();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer"
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
                className="w-full px-3 py-2 text-left hover:bg-slate-800 text-rose-400 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Icons.RotateCcw size={14} />
                <span>Bersihkan Workspace</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

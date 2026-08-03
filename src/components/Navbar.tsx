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
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

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
  isSidebarOpen,
  onToggleSidebar,
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
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg app-text-muted hover:app-text-main app-bg-hover transition-colors mr-1 cursor-pointer"
            title={isSidebarOpen ? "Sembunyikan Sidebar (Ctrl + \\)" : "Tampilkan Sidebar (Ctrl + \\)"}
          >
            {isSidebarOpen ? <Icons.PanelLeftClose size={16} /> : <Icons.PanelLeft size={16} />}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenWorldManager}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md app-text-muted hover:app-text-main app-bg-hover transition-colors font-medium"
          title="Pengelola Workspace"
        >
          <Icons.Globe size={15} className="app-accent-text" />
          <span>{projectName}</span>
        </button>

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
          <span>Canvas</span>
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
          <span>Galeri</span>
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

        {/* Dark / Light Theme Toggle Button */}
        <button
          type="button"
          onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 rounded-lg app-bg-secondary border app-border app-text-main hover:app-bg-hover transition-colors cursor-pointer"
          title={currentTheme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
        >
          {currentTheme === 'dark' ? <Icons.Sun size={15} /> : <Icons.Moon size={15} />}
        </button>

        {/* Consolidated Actions Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="px-2.5 py-1 rounded-lg app-bg-secondary border app-border app-text-main hover:app-bg-hover text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            title="Opsi & Menu Proyek"
          >
            <Icons.SlidersHorizontal size={14} className="app-text-muted" />
            <span className="hidden sm:inline">Menu Proyek</span>
            <Icons.ChevronDown size={13} className={`app-text-muted transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 app-bg-secondary border app-border rounded-xl shadow-2xl py-1.5 z-50 text-xs app-text-main animate-in fade-in zoom-in-95 duration-100 space-y-0.5 overflow-hidden">
              {localDirectoryName && (
                <>
                  <div className="px-3 py-2 bg-emerald-950/30 text-emerald-400 font-semibold border-b app-border flex items-center gap-1.5 select-none" title={`Folder Workspace: ${localDirectoryName}`}>
                    <Icons.FolderClosed size={13} className="text-emerald-400 min-w-[13px]" />
                    <span className="truncate">WS: {localDirectoryName}</span>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onChangeDirectory();
                }}
                className="w-full px-3 py-2 text-left hover:app-bg-hover flex items-center gap-2 transition-colors font-medium text-amber-500"
              >
                <Icons.FolderOpen size={14} />
                <span>Ganti Folder Workspace</span>
              </button>

              <div className="my-1 border-t app-border opacity-50" />

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

              {/* Theme Selector inside Dropdown */}
              <button
                type="button"
                onClick={() => {
                  onThemeChange(currentTheme === 'dark' ? 'light' : 'dark');
                  setIsMenuOpen(false);
                }}
                className="w-full px-3 py-2 flex items-center justify-between hover:app-bg-hover transition-colors text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <Icons.Palette size={14} className="app-text-muted" />
                  <span>Tema Aplikasi</span>
                </div>
                <span className="text-xs font-medium app-text-muted">
                  {currentTheme === 'dark' ? 'Mode Gelap' : 'Mode Terang'}
                </span>
              </button>

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
                <span>Bersihkan</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

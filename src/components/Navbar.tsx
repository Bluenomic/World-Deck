import React, { useState, useRef, useEffect } from 'react';
import type { ViewMode, AppTheme } from '../types';
import * as Icons from 'lucide-react';
import {
  isTauriAvailable,
  minimizeTauriWindow,
  toggleMaximizeTauriWindow,
  closeTauriWindow,
  startDraggingTauriWindow,
  isTauriWindowMaximized,
} from '../utils/tauriStorage';

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
  const [isMaximized, setIsMaximized] = useState(false);
  const [inTauri, setInTauri] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect Tauri environment and setup max state interval check
  useEffect(() => {
    const tauriActive = isTauriAvailable();
    setInTauri(tauriActive);

    if (!tauriActive) return;

    const checkMax = async () => {
      const isMax = await isTauriWindowMaximized();
      setIsMaximized(isMax);
    };

    checkMax();
    const interval = setInterval(checkMax, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await minimizeTauriWindow();
  };

  const handleMaximize = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isMax = await toggleMaximizeTauriWindow();
    setIsMaximized(isMax);
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await closeTauriWindow();
  };

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    // Close menu if open and click is outside menu container
    if (isMenuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setIsMenuOpen(false);
    }
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [role="button"], .no-drag')) return;
    startDraggingTauriWindow();
  };

  const handleHeaderDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [role="button"], .no-drag')) return;
    handleMaximize();
  };

  // Close dropdown menu when clicking outside (using capture phase to intercept prior to OS drag)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isMenuOpen]);

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleHeaderMouseDown}
      onDoubleClick={handleHeaderDoubleClick}
      className="h-12 bg-[#2c2c2c] border-b border-[#383838] pl-3.5 pr-0 flex items-center justify-between z-40 relative select-none text-white transition-colors shadow-xs overflow-hidden"
    >
      
      {/* LEFT: Figma Icon Menu & Project Switcher */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenWorldManager}
          className="w-9 h-9 rounded-xl bg-[#1e1e1e] hover:bg-[#383838] border border-[#383838] hover:border-[#0d99ff] flex items-center justify-center shadow-md transition-all cursor-pointer group no-drag"
          title="Buka Pengelola Dunia & Workspace"
        >
          <img src="/wd-logo-circle.png" alt="WD Logo" className="w-6.5 h-6.5 object-contain rounded-full group-hover:scale-110 transition-transform" />
        </button>

        <button
          type="button"
          onClick={onOpenWorldManager}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-[#383838] transition-all text-xs font-bold group cursor-pointer border border-transparent hover:border-[#383838] no-drag"
          title="Buka Pengelola Workspace & Dunia"
        >
          <span className="truncate max-w-[140px] sm:max-w-[240px]">
            {projectName}
          </span>
          <Icons.ChevronDown size={13} className="text-slate-400 group-hover:text-white transition-colors" />
        </button>
      </div>

      {/* CENTER: Figma Segmented View Mode Switcher Pills */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 bg-[#1e1e1e] p-1 rounded-xl border border-[#383838] shadow-inner no-drag">
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none select-none border ${
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

      {/* RIGHT: Menu Dropdown & Native Window Controls */}
      <div className="flex items-center h-full">
        {/* Menu Dropdown Button */}
        <div className="relative no-drag" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="px-3.5 py-1.5 rounded-xl text-slate-200 hover:text-white hover:bg-[#383838] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border border-[#383838] outline-none focus:outline-none select-none shadow-xs"
            title="Opsi & Menu Proyek"
          >
            <Icons.SlidersHorizontal size={14} className="text-[#0d99ff]" />
            <span>Menu</span>
            <Icons.ChevronDown size={13} className={`text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#2c2c2c] border border-[#383838] rounded-2xl shadow-2xl p-1.5 z-50 text-xs text-[#f8fafc] animate-in fade-in zoom-in-95 duration-100 space-y-1.5 select-none overflow-hidden no-drag">
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

        {/* Window Controls (Minimize, Maximize/Restore, Close) - Extra Large Native Style */}
        {inTauri && (
          <div className="flex items-stretch h-full ml-3 border-l border-[#383838] no-drag">
            <button
              type="button"
              onClick={handleMinimize}
              className="w-12 h-full flex items-center justify-center hover:bg-[#383838] active:bg-[#484848] text-slate-300 hover:text-white transition-colors cursor-pointer outline-none"
              title="Minimize Window"
            >
              <Icons.Minus size={18} className="stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={handleMaximize}
              className="w-12 h-full flex items-center justify-center hover:bg-[#383838] active:bg-[#484848] text-slate-300 hover:text-white transition-colors cursor-pointer outline-none"
              title={isMaximized ? "Restore Window" : "Maximize Window"}
            >
              {isMaximized ? (
                <Icons.Copy size={15} className="rotate-180 stroke-[2.2]" />
              ) : (
                <Icons.Square size={14} className="stroke-[2.2]" />
              )}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="w-13 h-full flex items-center justify-center hover:bg-[#e81123] active:bg-[#c40e1e] text-slate-300 hover:text-white transition-colors cursor-pointer outline-none"
              title="Close Application"
            >
              <Icons.X size={18} className="stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

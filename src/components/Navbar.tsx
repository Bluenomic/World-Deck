import React, { useState, useRef, useEffect } from 'react';
import type { ViewMode, AppTheme } from '../types';
import * as Icons from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  isTauriAvailable,
  minimizeTauriWindow,
  toggleMaximizeTauriWindow,
  closeTauriWindow,
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

const VIEW_TABS: { id: ViewMode; labelKey: 'canvas' | 'library' | 'timeline' | 'documents' | 'map'; icon: any }[] = [
  { id: 'canvas', labelKey: 'canvas', icon: Icons.LayoutGrid },
  { id: 'library', labelKey: 'library', icon: Icons.Library },
  { id: 'timeline', labelKey: 'timeline', icon: Icons.Clock },
  { id: 'documents', labelKey: 'documents', icon: Icons.BookOpen },
  { id: 'map', labelKey: 'map', icon: Icons.Map },
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
  const { language, setLanguage, t } = useLanguage();
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

  const handleHeaderDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a, [role="button"], .no-drag')) return;
    handleMaximize();
  };

  // Close dropdown menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={handleHeaderDoubleClick}
      className="h-10 bg-[#2c2c2c] border-b border-[#383838] pl-3 pr-0 flex items-center justify-between z-40 relative select-none text-white transition-colors shadow-xs"
    >
      
      {/* LEFT: Logo & Project Switcher */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-tauri-drag-region={false}
          onClick={onOpenWorldManager}
          className="w-7 h-7 shrink-0 rounded-lg bg-[#1e1e1e] hover:bg-[#383838] border border-[#383838] hover:border-[#0d99ff] flex items-center justify-center shadow-md transition-all cursor-pointer group"
          title={t.navbar.openWorldManager}
        >
          <img src="/wd-logo-circle.png" alt="WD Logo" className="w-5 h-5 object-contain rounded-full group-hover:scale-110 transition-transform" />
        </button>

        <button
          type="button"
          data-tauri-drag-region={false}
          onClick={onOpenWorldManager}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-200 hover:text-white hover:bg-[#383838] transition-all text-xs font-bold group cursor-pointer border border-transparent hover:border-[#383838]"
          title={t.navbar.openWorldManager}
        >
          <span className="truncate max-w-[140px] sm:max-w-[240px]">
            {projectName}
          </span>
          <Icons.ChevronDown size={12} className="text-slate-400 group-hover:text-white transition-colors" />
        </button>

        {localDirectoryName && (
          <button
            type="button"
            data-tauri-drag-region={false}
            onClick={onChangeDirectory}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1e1e1e] hover:bg-[#383838] border border-[#383838] hover:border-[#0d99ff] text-slate-300 hover:text-white text-[11px] font-mono transition-all cursor-pointer shadow-xs"
            title="Ganti Folder Workspace"
          >
            <Icons.Folder size={13} className="text-[#0d99ff]" />
            <span className="truncate max-w-[150px] font-bold">{localDirectoryName}</span>
          </button>
        )}
      </div>

      {/* CENTER: Segmented View Mode Switcher Pills */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-0.5 bg-[#1e1e1e] p-0.5 rounded-lg border border-[#383838] shadow-inner" data-tauri-drag-region={false}>
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-tauri-drag-region={false}
              onClick={(e) => {
                (e.currentTarget as HTMLElement).blur();
                onViewModeChange(tab.id);
              }}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none select-none border ${
                isActive
                  ? 'bg-[#2c2c2c] text-white font-bold shadow-xs border-[#383838]'
                  : 'border-transparent text-slate-200 hover:text-white hover:bg-[#2c2c2c]/50'
              }`}
            >
              <Icon size={13} className={isActive ? 'text-[#0d99ff]' : 'text-slate-300'} />
              <span>{t.navbar.tabs[tab.labelKey]}</span>
            </button>
          );
        })}
      </div>

      {/* RIGHT: Menu Dropdown & Native Window Controls */}
      <div className="flex items-center h-full">
        {/* Menu Dropdown Button */}
        <div className="relative" ref={menuRef} data-tauri-drag-region={false}>
          <button
            type="button"
            data-tauri-drag-region={false}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            className="px-2.5 py-1 rounded-lg text-slate-200 hover:text-white hover:bg-[#383838] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-[#383838] outline-none focus:outline-none select-none shadow-xs"
            title={t.navbar.menuTitle}
          >
            <Icons.SlidersHorizontal size={13} className="text-[#0d99ff]" />
            <span>{t.navbar.menu}</span>
            <Icons.ChevronDown size={12} className={`text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#2c2c2c] border border-[#383838] rounded-2xl shadow-2xl p-1.5 z-50 text-xs text-[#f8fafc] animate-in fade-in zoom-in-95 duration-100 space-y-1.5 select-none overflow-hidden" data-tauri-drag-region={false}>
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
                    {t.navbar.changeWorkspace}
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
                  <span>{t.navbar.selectWorkspace}</span>
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
                  <span>{t.navbar.exportProject}</span>
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
                  <span>{t.navbar.importProject}</span>
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

              {/* Language Switcher */}
              <div className="p-1 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span>{t.navbar.appLanguage}</span>
                  <Icons.Globe size={12} className="text-slate-400" />
                </div>
                <div className="grid grid-cols-2 gap-1 bg-[#1e1e1e] p-1 rounded-xl border border-[#383838]">
                  <button
                    type="button"
                    onClick={() => setLanguage('id')}
                    className={`px-2 py-1 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      language === 'id'
                        ? 'bg-[#0d99ff] text-white shadow-xs font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-[#383838]'
                    }`}
                  >
                    <span className="text-[11px]">🇮🇩</span>
                    <span>{t.navbar.langId}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-1 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      language === 'en'
                        ? 'bg-[#0d99ff] text-white shadow-xs font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-[#383838]'
                    }`}
                  >
                    <span className="text-[11px]">🇬🇧</span>
                    <span>{t.navbar.langEn}</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-[#383838]" />

              {/* Theme Segmented Switcher */}
              <div className="p-1 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span>{t.navbar.appTheme}</span>
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
                    <span>{t.navbar.themeLight}</span>
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
                    <span>{t.navbar.themeDark}</span>
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
                  <span>{t.navbar.worldGuide}</span>
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
                  <span>{t.navbar.clearWorkspace}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Window Controls (Minimize, Maximize/Restore, Close) - Uniform Extra Wide Buttons */}
        {inTauri && (
          <div className="flex items-stretch h-full ml-2.5 border-l border-[#383838]" data-tauri-drag-region={false}>
            <button
              type="button"
              data-tauri-drag-region={false}
              onClick={handleMinimize}
              className="w-12 h-full flex items-center justify-center hover:bg-[#383838] active:bg-[#484848] text-slate-300 hover:text-white transition-colors cursor-pointer outline-none"
              title="Minimize Window"
            >
              <Icons.Minus size={16} className="stroke-[2.5]" />
            </button>

            <button
              type="button"
              data-tauri-drag-region={false}
              onClick={handleMaximize}
              className="w-12 h-full flex items-center justify-center hover:bg-[#383838] active:bg-[#484848] text-slate-300 hover:text-white transition-colors cursor-pointer outline-none"
              title={isMaximized ? "Restore Window" : "Maximize Window"}
            >
              {isMaximized ? (
                <Icons.Copy size={13} className="rotate-180 stroke-[2.2]" />
              ) : (
                <Icons.Square size={13} className="stroke-[2.2]" />
              )}
            </button>

            <button
              type="button"
              data-tauri-drag-region={false}
              onClick={handleClose}
              className="w-12 h-full flex items-center justify-center hover:bg-[#e81123] active:bg-[#c40e1e] text-slate-300 hover:text-white transition-colors cursor-pointer outline-none"
              title="Close Application"
            >
              <Icons.X size={16} className="stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

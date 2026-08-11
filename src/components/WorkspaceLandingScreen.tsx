import React, { useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

interface WorkspaceLandingScreenProps {
  onSelectWorkspace: () => void;
  onFallbackFolderSelect?: (files: FileList) => void;
}

export const WorkspaceLandingScreen: React.FC<WorkspaceLandingScreenProps> = ({
  onSelectWorkspace,
  onFallbackFolderSelect,
}) => {
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    // Primary folder selection handler
    onSelectWorkspace();
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFallbackFolderSelect) {
      onFallbackFolderSelect(e.target.files);
    }
  };

  return (
    <div className="flex-1 w-full app-bg-main app-text-main flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Hidden File Input Fallback */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        className="hidden"
        onChange={handleFolderInputChange}
      />

      {/* Subtle Figma Background Glow */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#0d99ff]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Figma-styled Workspace Permission Card */}
      <div className="max-w-md w-full p-8 rounded-2xl bg-[#1e1e1e] border border-[#383838] shadow-2xl space-y-6 text-center z-10 animate-in zoom-in-95 duration-200">
        
        {/* App Icon / Logo Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#0d99ff] flex items-center justify-center text-white font-bold shadow-lg shadow-[#0d99ff]/20">
          <Icons.FolderOpen size={32} />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {language === 'en' ? 'Select Workspace Folder' : 'Pilih Folder Workspace Proyek'}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            {language === 'en'
              ? 'Select a folder on your computer where all your cards, canvases, timelines, and documents will be saved transparently.'
              : 'Pilih folder di komputer Anda di mana seluruh kartu, kanvas, timeline, dan dokumen Anda akan disimpan secara transparan.'}
          </p>
        </div>

        {/* Primary Call-to-Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleButtonClick}
            className="w-full py-3.5 px-4 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Icons.FolderOpen size={18} />
            <span>
              {language === 'en' ? 'Select Workspace Folder' : 'Pilih Folder Workspace'}
            </span>
          </button>
        </div>

        {/* Transparent Storage Info */}
        <div className="pt-4 border-t border-[#383838] text-[11px] text-slate-400 font-mono space-y-1">
          <div className="flex items-center justify-center gap-1 text-[#0d99ff] font-bold">
            <Icons.ShieldCheck size={14} />
            <span>{language === 'en' ? 'Direct File System Access' : 'Akses Berkas Sistem Langsung'}</span>
          </div>
          <p className="text-[10px] text-slate-500">
            {language === 'en'
              ? 'Files saved as human-readable JSON in your chosen directory.'
              : 'Disimpan sebagai berkas JSON yang dapat dibaca pada folder pilihan Anda.'}
          </p>
        </div>

      </div>
    </div>
  );
};

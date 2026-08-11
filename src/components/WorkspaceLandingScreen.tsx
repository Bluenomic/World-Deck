import React, { useState, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

interface WorkspaceLandingScreenProps {
  selectedWorkspacePath: string | null;
  onSelectWorkspace: () => void;
  onCreateProjectInFolder?: (name: string, description: string) => void;
  onFallbackFolderSelect?: (files: FileList) => void;
}

export const WorkspaceLandingScreen: React.FC<WorkspaceLandingScreenProps> = ({
  selectedWorkspacePath,
  onSelectWorkspace,
  onCreateProjectInFolder,
  onFallbackFolderSelect,
}) => {
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFallbackFolderSelect) {
      onFallbackFolderSelect(e.target.files);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    onCreateProjectInFolder?.(projectName.trim(), projectDesc.trim());
    setShowCreateModal(false);
    setProjectName('');
    setProjectDesc('');
  };

  const isFolderSelected = !!selectedWorkspacePath;
  const folderName = selectedWorkspacePath ? selectedWorkspacePath.split(/[/\\]/).pop() || 'Workspace' : '';

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

      {/* Background Subtle Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#0d99ff]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Landing Card */}
      <div className="max-w-md w-full p-8 rounded-3xl bg-[#1e1e1e] border border-[#383838] shadow-2xl space-y-6 text-center z-10 animate-in zoom-in-95 duration-200 relative">
        
        {/* Active Folder Badge if folder is selected */}
        {isFolderSelected && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0d99ff]/15 border border-[#0d99ff]/30 text-[#0d99ff] text-[11px] font-mono font-bold max-w-full truncate">
            <Icons.Folder size={13} className="shrink-0" />
            <span className="truncate">{selectedWorkspacePath}</span>
          </div>
        )}

        {/* Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#0d99ff] flex items-center justify-center text-white font-bold shadow-lg shadow-[#0d99ff]/20">
          {isFolderSelected ? <Icons.FolderPlus size={32} /> : <Icons.FolderOpen size={32} />}
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {isFolderSelected
              ? (language === 'en' ? 'No Projects in Folder' : 'Belum Ada Project di Folder Ini')
              : (language === 'en' ? 'Select Workspace Folder' : 'Pilih Folder Workspace Proyek')}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            {isFolderSelected
              ? (language === 'en'
                  ? `Folder "${folderName}" has no World Deck project files yet. Create a new project inside this folder or select another folder.`
                  : `Folder "${folderName}" belum memiliki berkas project World Deck. Buat project baru di folder ini atau pilih folder lain.`)
              : (language === 'en'
                  ? 'Select a folder on your computer where all your cards, canvases, timelines, and documents will be saved transparently.'
                  : 'Pilih folder di komputer Anda di mana seluruh kartu, kanvas, timeline, dan dokumen Anda akan disimpan secara transparan.')}
          </p>
        </div>

        {/* Call to Action Buttons */}
        <div className="space-y-2 pt-2">
          {isFolderSelected ? (
            <>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="w-full py-3.5 px-4 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icons.PlusCircle size={18} />
                <span>
                  {language === 'en' ? 'Create New Project in Folder' : '+ Buat Project Baru di Folder Ini'}
                </span>
              </button>

              <button
                type="button"
                onClick={onSelectWorkspace}
                className="w-full py-2.5 px-4 rounded-xl bg-[#2c2c2c] hover:bg-[#383838] border border-[#383838] text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icons.FolderOpen size={16} />
                <span>
                  {language === 'en' ? 'Select Another Folder' : 'Pilih Folder Lain'}
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onSelectWorkspace}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Icons.FolderOpen size={18} />
              <span>
                {language === 'en' ? 'Select Workspace Folder' : 'Pilih Folder Workspace'}
              </span>
            </button>
          )}
        </div>

        {/* Transparent Storage Info */}
        <div className="pt-4 border-t border-[#383838] text-[11px] text-slate-400 font-mono space-y-1">
          <div className="flex items-center justify-center gap-1 text-[#0d99ff] font-bold">
            <Icons.ShieldCheck size={14} />
            <span>{language === 'en' ? 'Direct File System Storage' : 'Akses Berkas Sistem Langsung'}</span>
          </div>
          <p className="text-[10px] text-slate-500">
            {language === 'en'
              ? 'All world progress saves cleanly as project_<id>.json inside your chosen folder.'
              : 'Seluruh progres disimpan sebagai project_<id>.json di dalam folder pilihan Anda.'}
          </p>
        </div>

      </div>

      {/* Modal Form for Creating New Project in Folder */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in fade-in duration-150 select-none cursor-pointer"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[#1e1e1e] border border-[#383838] w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 text-white animate-in zoom-in-95 duration-150 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#383838] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#0d99ff]/20 text-[#0d99ff]">
                  <Icons.FolderPlus size={18} />
                </div>
                <h3 className="font-extrabold text-sm text-white">
                  {language === 'en' ? 'Create New Project' : 'Buat Project Workspace Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl hover:bg-[#383838] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <Icons.X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {language === 'en' ? 'Project Name' : 'Nama Project'} <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={language === 'en' ? 'e.g. Kingdom of Eldoria' : 'contoh: Kerajaan Eldoria'}
                  className="w-full bg-[#2c2c2c] border border-[#383838] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0d99ff] font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {language === 'en' ? 'Description (Optional)' : 'Deskripsi Project (Opsional)'}
                </label>
                <textarea
                  rows={3}
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder={language === 'en' ? 'Brief summary about this world...' : 'Ringkasan singkat tentang dunia ini...'}
                  className="w-full bg-[#2c2c2c] border border-[#383838] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0d99ff] resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#383838]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#2c2c2c] hover:bg-[#383838] text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {language === 'en' ? 'Cancel' : 'Batal'}
                </button>
                <button
                  type="submit"
                  disabled={!projectName.trim()}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                    projectName.trim()
                      ? 'bg-[#0d99ff] hover:bg-[#0b85de] text-white cursor-pointer active:scale-95'
                      : 'bg-[#2c2c2c] text-slate-500 cursor-not-allowed border border-[#383838]'
                  }`}
                >
                  <Icons.PlusCircle size={14} />
                  <span>{language === 'en' ? 'Create Project' : 'Buat Project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

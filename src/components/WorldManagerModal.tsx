import React, { useState, useRef } from 'react';
import type { WorldProject } from '../types';
import { generateId, downloadProjectJson } from '../utils/helpers';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

interface WorldManagerModalProps {
  worlds: WorldProject[];
  activeWorldId: string;
  onSelectWorld: (worldId: string) => void;
  onCreateWorld: (newWorld: WorldProject) => void;
  onDeleteWorld: (worldId: string) => void;
  onDuplicateWorld: (worldId: string) => void;
  onUpdateWorldInfo: (worldId: string, name: string, description: string, author: string) => void;
  onClose: () => void;
  onImportWorld: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const WorldManagerModal: React.FC<WorldManagerModalProps> = ({
  worlds,
  activeWorldId,
  onSelectWorld,
  onCreateWorld,
  onDeleteWorld,
  onDuplicateWorld,
  onUpdateWorldInfo,
  onClose,
  onImportWorld,
}) => {
  const { language, t } = useLanguage();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWorldId, setEditingWorldId] = useState<string | null>(null);

  // Form states
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartCreate = () => {
    setNameInput('');
    setDescInput('');
    setAuthorInput('');
    setEditingWorldId(null);
    setShowCreateForm(true);
  };

  const handleStartEdit = (w: WorldProject) => {
    setEditingWorldId(w.id);
    setNameInput(w.name);
    setDescInput(w.description || '');
    setAuthorInput(w.author || '');
    setShowCreateForm(false);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    const newWorld: WorldProject = {
      id: generateId('world'),
      name: nameInput.trim(),
      description: descInput.trim(),
      author: authorInput.trim() || (language === 'en' ? 'Author' : 'Penulis'),
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cards: [],
      connections: [],
    };

    onCreateWorld(newWorld);
    setShowCreateForm(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWorldId && nameInput.trim()) {
      onUpdateWorldInfo(editingWorldId, nameInput.trim(), descInput.trim(), authorInput.trim());
      setEditingWorldId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      {/* Hidden Import File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={onImportWorld}
        className="hidden"
      />

      <div
        className="bg-[#1e1e1e] border border-[#383838] w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white transition-all cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 bg-[#1e1e1e] border-b border-[#383838] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Icons.FolderGit2 size={18} className="text-[#0d99ff]" />
            <h2 className="text-sm font-extrabold text-white tracking-tight">{t.worldManager.title}</h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#2c2c2c] text-slate-400 border border-[#383838]">
              {worlds.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartCreate}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showCreateForm
                  ? 'bg-[#0d99ff] text-white shadow-md'
                  : 'bg-[#2c2c2c] hover:bg-[#383838] text-white border border-[#383838]'
              }`}
            >
              <Icons.Plus size={14} strokeWidth={2.5} />
              <span>{t.worldManager.createWorld}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#2c2c2c] hover:bg-[#383838] text-slate-300 hover:text-white border border-[#383838] transition-all flex items-center gap-1.5 cursor-pointer"
              title={t.worldManager.importWorld}
            >
              <Icons.Upload size={13} />
              <span className="hidden sm:inline">{t.worldManager.importWorld}</span>
            </button>

            <div className="h-4 w-px bg-[#383838] mx-0.5" />

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#383838] transition-colors cursor-pointer"
              title={t.common.close}
            >
              <Icons.X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">

          {/* Form Buat Workspace Baru */}
          {showCreateForm && (
            <form
              onSubmit={handleCreateSubmit}
              className="p-4 rounded-xl bg-[#2c2c2c] border border-[#0d99ff]/50 space-y-3 shadow-xl animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between border-b border-[#383838] pb-2">
                <span className="text-xs font-bold text-[#0d99ff] uppercase tracking-wider flex items-center gap-1.5">
                  <Icons.PlusCircle size={14} />
                  <span>{t.worldManager.createWorld}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  {t.common.cancel}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">{t.worldManager.worldName} *</label>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder={t.worldManager.worldName}
                    className="w-full bg-[#1e1e1e] border border-[#383838] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">{t.worldManager.author}</label>
                  <input
                    type="text"
                    value={authorInput}
                    onChange={(e) => setAuthorInput(e.target.value)}
                    placeholder={t.worldManager.author}
                    className="w-full bg-[#1e1e1e] border border-[#383838] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">{t.worldManager.description}</label>
                <textarea
                  rows={2}
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  placeholder={t.worldManager.description}
                  className="w-full bg-[#1e1e1e] border border-[#383838] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#0d99ff] leading-relaxed resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#383838] bg-[#1e1e1e] hover:bg-[#383838] text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-md cursor-pointer active:scale-95 transition-all"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          )}

          {/* Cards List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {worlds.map((w) => {
              const isActive = w.id === activeWorldId;
              const isEditing = editingWorldId === w.id;

              if (isEditing) {
                return (
                  <form
                    key={w.id}
                    onSubmit={handleEditSubmit}
                    className="bg-[#2c2c2c] p-4 rounded-xl border border-[#0d99ff] space-y-3 shadow-xl animate-in fade-in duration-100"
                  >
                    <div className="flex items-center justify-between border-b border-[#383838] pb-2">
                      <span className="text-xs font-bold text-[#0d99ff] uppercase tracking-wider">
                        {t.worldManager.editWorld}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingWorldId(null)}
                        className="text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        {t.common.cancel}
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">{t.worldManager.worldName}</label>
                      <input
                        type="text"
                        required
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">{t.worldManager.author}</label>
                      <input
                        type="text"
                        value={authorInput}
                        onChange={(e) => setAuthorInput(e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">{t.worldManager.description}</label>
                      <textarea
                        rows={2}
                        value={descInput}
                        onChange={(e) => setDescInput(e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-[#383838] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#0d99ff] leading-relaxed resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingWorldId(null)}
                        className="px-3 py-1 rounded-lg border border-[#383838] bg-[#1e1e1e] text-xs font-semibold text-slate-300 cursor-pointer"
                      >
                        {t.common.cancel}
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1 rounded-lg bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-md cursor-pointer"
                      >
                        {t.common.save}
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={w.id}
                  onClick={() => {
                    onSelectWorld(w.id);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 cursor-pointer group ${
                    isActive
                      ? 'bg-[#2c2c2c] border-[#0d99ff] ring-1 ring-[#0d99ff]/50 shadow-xl'
                      : 'bg-[#2c2c2c]/60 border-[#383838] hover:bg-[#2c2c2c] hover:border-slate-500'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-[#0d99ff] shadow-[0_0_8px_#0d99ff]' : 'bg-slate-600'}`} />
                        <h3 className="text-xs font-bold text-white group-hover:text-[#0d99ff] transition-colors truncate">
                          {w.name}
                        </h3>
                      </div>

                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#0d99ff]/15 border border-[#0d99ff]/30 text-[#0d99ff] text-[9px] font-bold shrink-0">
                          {t.common.active}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {w.author || (language === 'en' ? 'Author' : 'Penulis')}
                        </span>
                      )}
                    </div>

                    {w.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {w.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 pt-1">
                      <span>🎴 {w.cards ? w.cards.length : 0} {t.library.cards}</span>
                      <span>•</span>
                      <span>🔗 {w.connections ? w.connections.length : 0} {t.cardReader.connections}</span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="pt-2 border-t border-[#383838] flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(w);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                        title={t.worldManager.editWorld}
                      >
                        <Icons.Edit3 size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateWorld(w.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                        title={t.worldManager.duplicateWorld}
                      >
                        <Icons.Copy size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadProjectJson(w);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                        title={t.worldManager.exportJson}
                      >
                        <Icons.Download size={13} />
                      </button>

                      {worlds.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteWorld(w.id);
                          }}
                          className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors cursor-pointer"
                          title={t.worldManager.deleteWorld}
                        >
                          <Icons.Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {!isActive ? (
                      <span className="px-3 py-1 rounded-lg bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold transition-all shadow-xs">
                        {t.worldManager.openWorld}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 rounded bg-[#1e1e1e] border border-[#383838]">
                        {t.common.active}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};

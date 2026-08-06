import React, { useState } from 'react';
import type { WorldProject } from '../types';
import { generateId, downloadProjectJson } from '../utils/helpers';
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
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  const [newWorldName, setNewWorldName] = useState('');
  const [newWorldDesc, setNewWorldDesc] = useState('');
  const [newWorldAuthor, setNewWorldAuthor] = useState('');

  const [editingWorldId, setEditingWorldId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAuthor, setEditAuthor] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorldName.trim()) return;

    const newWorld: WorldProject = {
      id: generateId('world'),
      name: newWorldName.trim(),
      description: newWorldDesc.trim() || 'Arsip workspace kustom baru.',
      author: newWorldAuthor.trim() || 'Penulis / Worldbuilder',
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cards: [],
      connections: [],
    };

    onCreateWorld(newWorld);
    setNewWorldName('');
    setNewWorldDesc('');
    setNewWorldAuthor('');
    setActiveTab('list');
  };

  const startEditWorld = (w: WorldProject) => {
    setEditingWorldId(w.id);
    setEditName(w.name);
    setEditDesc(w.description || '');
    setEditAuthor(w.author || '');
  };

  const saveEditWorld = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWorldId) {
      onUpdateWorldInfo(editingWorldId, editName, editDesc, editAuthor);
      setEditingWorldId(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[100] backdrop-animate-appear select-none"
      onClick={onClose}
    >
      <div 
        className="bg-[#2c2c2c] border border-[#383838] w-full max-w-3xl max-h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white transition-colors modal-animate-appear cursor-default relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Strip */}
        <div className="px-6 py-4 bg-[#1e1e1e] border-b border-[#383838] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2c2c2c] border border-[#383838] flex items-center justify-center shrink-0 shadow-md">
              <img
                src="/wd-logo-circle.png"
                alt="World Deck Logo"
                className="w-7 h-7 object-contain rounded-full"
              />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">Pengelola Workspace & Dunia</h2>
              <p className="text-xs text-slate-400">Kelola, buat, dan impor universe worldbuilding Anda</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#383838] transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Tab Navigation Segmented Bar */}
        <div className="flex border-b border-[#383838] bg-[#1e1e1e] px-6 gap-6 text-xs font-semibold text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'list'
                ? 'border-[#0d99ff] text-white font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Icons.FolderGit2 size={15} className={activeTab === 'list' ? 'text-[#0d99ff]' : ''} />
            <span>Daftar Workspace ({worlds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'create'
                ? 'border-[#0d99ff] text-white font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Icons.PlusCircle size={15} className={activeTab === 'create' ? 'text-[#0d99ff]' : ''} />
            <span>+ Buat / Impor Workspace</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          
          {/* TAB 1: DAFTAR WORKSPACE */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {worlds.map((w) => {
                  const isActive = w.id === activeWorldId;
                  const isEditing = editingWorldId === w.id;

                  if (isEditing) {
                    return (
                      <form
                        key={w.id}
                        onSubmit={saveEditWorld}
                        className="bg-[#1e1e1e] p-4 rounded-xl border border-[#0d99ff] space-y-3 shadow-lg"
                      >
                        <h4 className="text-xs font-bold text-[#0d99ff] uppercase tracking-wider">Edit Informasi Workspace</h4>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Nama Workspace</label>
                          <input
                            type="text"
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-[#2c2c2c] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Deskripsi</label>
                          <textarea
                            rows={2}
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="w-full bg-[#2c2c2c] border border-[#383838] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#0d99ff] leading-relaxed resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Penulis</label>
                          <input
                            type="text"
                            value={editAuthor}
                            onChange={(e) => setEditAuthor(e.target.value)}
                            className="w-full bg-[#2c2c2c] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingWorldId(null)}
                            className="px-3 py-1 rounded-lg border border-[#383838] bg-[#2c2c2c] hover:bg-[#383838] text-xs font-bold text-slate-300 cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1 rounded-lg bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-md cursor-pointer"
                          >
                            Simpan
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
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3.5 cursor-pointer group hover:border-[#0d99ff] ${
                        isActive
                          ? 'bg-[#1e1e1e] border-[#0d99ff] ring-2 ring-[#0d99ff]/30 shadow-xl'
                          : 'bg-[#1e1e1e] border-[#383838] hover:bg-[#2c2c2c]/50'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className={`p-2 rounded-xl border shrink-0 ${isActive ? 'bg-[#0d99ff]/15 border-[#0d99ff]/30 text-[#0d99ff]' : 'bg-[#2c2c2c] border-[#383838] text-slate-400'}`}>
                              <Icons.Globe size={18} />
                            </div>
                            <div className="truncate">
                              <h3 className="text-sm font-extrabold text-white group-hover:text-[#0d99ff] transition-colors truncate">
                                {w.name}
                              </h3>
                              <p className="text-[10px] text-slate-400 font-mono">
                                Penulis: {w.author || 'Penulis Worldbuilding'}
                              </p>
                            </div>
                          </div>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-[#0d99ff]/15 border border-[#0d99ff]/40 text-[#0d99ff] text-[9px] font-bold uppercase tracking-wider shrink-0 shadow-xs">
                              Aktif
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {w.description || 'Tidak ada deskripsi workspace.'}
                        </p>

                        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400 pt-1">
                          <span className="px-2 py-0.5 rounded-md bg-[#2c2c2c] border border-[#383838] font-semibold text-slate-300">
                            🎴 {w.cards ? w.cards.length : 0} Kartu
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#2c2c2c] border border-[#383838] font-semibold text-slate-300">
                            🔗 {w.connections ? w.connections.length : 0} Relasi
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-3 border-t border-[#383838] flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditWorld(w);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                            title="Edit Informasi Workspace"
                          >
                            <Icons.Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateWorld(w.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                            title="Duplikat Workspace"
                          >
                            <Icons.Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadProjectJson(w);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
                            title="Ekspor File JSON"
                          >
                            <Icons.Download size={14} />
                          </button>
                          {worlds.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteWorld(w.id);
                              }}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Hapus Workspace"
                            >
                              <Icons.Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        {!isActive ? (
                          <span className="px-3.5 py-1.5 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-md transition-all">
                            Buka Workspace
                          </span>
                        ) : (
                          <span className="px-3.5 py-1.5 rounded-xl bg-[#2c2c2c] text-white border border-[#383838] text-xs font-bold">
                            Sedang Dibuka
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: BUAT & IMPOR WORKSPACE */}
          {activeTab === 'create' && (
            <div className="space-y-5 max-w-lg mx-auto py-2">
              {/* Form Buat Workspace Baru */}
              <form onSubmit={handleCreateSubmit} className="space-y-4 bg-[#1e1e1e] p-5 rounded-2xl border border-[#383838] shadow-xl">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d99ff] flex items-center gap-2">
                  <Icons.PlusCircle size={15} />
                  <span>Buat Workspace Baru dari Awal</span>
                </h3>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Workspace *</label>
                  <input
                    type="text"
                    required
                    value={newWorldName}
                    onChange={(e) => setNewWorldName(e.target.value)}
                    placeholder="Contoh: Universe High Fantasy Nusantara"
                    className="w-full bg-[#2c2c2c] border border-[#383838] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Deskripsi Singkat</label>
                  <textarea
                    rows={2}
                    value={newWorldDesc}
                    onChange={(e) => setNewWorldDesc(e.target.value)}
                    placeholder="Konsep umum latar belakang universe..."
                    className="w-full bg-[#2c2c2c] border border-[#383838] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#0d99ff] leading-relaxed resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Penulis / Creator</label>
                  <input
                    type="text"
                    value={newWorldAuthor}
                    onChange={(e) => setNewWorldAuthor(e.target.value)}
                    placeholder="Nama Penulis..."
                    className="w-full bg-[#2c2c2c] border border-[#383838] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2 rounded-xl border border-[#383838] bg-[#2c2c2c] hover:bg-[#383838] text-xs font-bold text-slate-300 cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0d99ff] hover:bg-[#0b85de] text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    Buat & Buka Workspace
                  </button>
                </div>
              </form>

              {/* Import Workspace JSON */}
              <div className="bg-[#1e1e1e] p-5 rounded-2xl border border-dashed border-[#383838] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Icons.Upload size={15} className="text-[#0d99ff]" />
                    <span>Impor Workspace dari File JSON</span>
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Muat data berkas `.json` cadangan workspace yang pernah diekspor sebelumnya.
                  </p>
                </div>

                <label className="px-4 py-2 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 transition-all shadow-md">
                  <Icons.Upload size={14} />
                  <span>Pilih File JSON</span>
                  <input type="file" accept=".json" onChange={onImportWorld} className="hidden" />
                </label>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

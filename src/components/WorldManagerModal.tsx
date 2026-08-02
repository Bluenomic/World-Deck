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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 backdrop-animate-appear cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="app-bg-secondary border app-border w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden app-text-main transition-colors modal-animate-appear cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 app-bg-main border-b app-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg app-accent-bg flex items-center justify-center text-white font-bold">
              <Icons.Globe size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold app-text-main">Pengelola Workspace</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 app-text-muted hover:app-text-main rounded-lg hover:app-bg-hover cursor-pointer"
            title="Tutup Modal"
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b app-border app-bg-main px-6 gap-4 text-xs font-medium app-text-muted">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'list'
                ? 'border-blue-500 app-text-main font-semibold'
                : 'border-transparent hover:app-text-main'
            }`}
          >
            <Icons.FolderGit2 size={14} />
            <span>Daftar Workspace ({worlds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'border-blue-500 app-text-main font-semibold'
                : 'border-transparent hover:app-text-main'
            }`}
          >
            <Icons.PlusCircle size={14} />
            <span>+ Buat Workspace Baru</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {worlds.map((w) => {
                  const isActive = w.id === activeWorldId;
                  const isEditing = editingWorldId === w.id;

                  if (isEditing) {
                    return (
                      <form
                        key={w.id}
                        onSubmit={saveEditWorld}
                        className="app-bg-main p-4 rounded-xl border border-blue-500 space-y-2.5"
                      >
                        <h4 className="text-xs font-bold app-accent-text">Edit Informasi Workspace</h4>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full app-bg-secondary border app-border rounded px-2.5 py-1.5 text-xs app-text-main"
                        />
                        <textarea
                          rows={2}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full app-bg-secondary border app-border rounded p-2 text-xs app-text-main"
                        />
                        <input
                          type="text"
                          value={editAuthor}
                          onChange={(e) => setEditAuthor(e.target.value)}
                          className="w-full app-bg-secondary border app-border rounded px-2.5 py-1.5 text-xs app-text-main"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingWorldId(null)}
                            className="px-2.5 py-1 rounded text-xs app-text-muted cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 rounded app-accent-bg text-white text-xs font-medium cursor-pointer"
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
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 cursor-pointer group hover:scale-[1.01] ${
                        isActive
                          ? 'app-bg-secondary border-blue-500 shadow-md ring-1 ring-blue-500/30'
                          : 'app-bg-main border app-border hover:border-blue-400'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icons.Globe size={16} className={isActive ? 'app-accent-text' : 'app-text-muted'} />
                            <h3 className="text-sm font-bold app-text-main group-hover:text-blue-400 transition-colors">
                              {w.name}
                            </h3>
                          </div>
                          {isActive && (
                            <span className="px-2 py-0.2 rounded app-accent-bg text-white text-[9px] font-bold uppercase tracking-wider">
                              Aktif
                            </span>
                          )}
                        </div>

                        <p className="text-xs app-text-muted line-clamp-2 leading-relaxed">
                          {w.description || 'Tidak ada deskripsi.'}
                        </p>

                        <div className="flex flex-wrap gap-2 text-[10px] font-mono app-text-muted pt-1">
                          <span className="px-1.5 py-0.2 rounded app-bg-main border app-border">
                            🎴 {w.cards ? w.cards.length : 0} Kartu
                          </span>
                          <span className="px-1.5 py-0.2 rounded app-bg-main border app-border">
                            🔗 {w.connections ? w.connections.length : 0} Relasi
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t app-border flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditWorld(w);
                            }}
                            className="p-1.5 rounded app-text-muted hover:app-text-main hover:app-bg-hover transition-colors cursor-pointer"
                            title="Edit Info"
                          >
                            <Icons.Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateWorld(w.id);
                            }}
                            className="p-1.5 rounded app-text-muted hover:app-text-main hover:app-bg-hover transition-colors cursor-pointer"
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
                            className="p-1.5 rounded app-text-muted hover:app-text-main hover:app-bg-hover transition-colors cursor-pointer"
                            title="Ekspor JSON"
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
                              className="p-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Hapus Workspace"
                            >
                              <Icons.Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        {!isActive ? (
                          <span className="px-3 py-1 rounded-lg app-accent-bg text-white text-xs font-medium">
                            Buka Workspace
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-lg app-bg-main app-text-main border app-border text-xs font-medium">
                            Workspace Aktif
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="space-y-5 max-w-lg mx-auto py-2">
              {/* Option A: Create Blank Workspace Form */}
              <form onSubmit={handleCreateSubmit} className="space-y-3.5 app-bg-main p-4 rounded-xl border app-border">
                <h3 className="text-xs font-bold uppercase tracking-wider app-accent-text flex items-center gap-1.5">
                  <Icons.PlusCircle size={14} />
                  <span>Buat Workspace Baru dari Awal</span>
                </h3>
                
                <div>
                  <label className="block text-xs font-semibold app-text-muted mb-1">Nama Workspace *</label>
                  <input
                    type="text"
                    required
                    value={newWorldName}
                    onChange={(e) => setNewWorldName(e.target.value)}
                    placeholder="Contoh: Worldbuilding Nusantara"
                    className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 text-xs app-text-main focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold app-text-muted mb-1">Deskripsi Singkat</label>
                  <textarea
                    rows={2}
                    value={newWorldDesc}
                    onChange={(e) => setNewWorldDesc(e.target.value)}
                    placeholder="Konsep umum latar belakang workspace..."
                    className="w-full app-bg-secondary border app-border rounded-lg p-2.5 text-xs app-text-main focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold app-text-muted mb-1">Penulis</label>
                  <input
                    type="text"
                    value={newWorldAuthor}
                    onChange={(e) => setNewWorldAuthor(e.target.value)}
                    placeholder="Nama Penulis..."
                    className="w-full app-bg-secondary border app-border rounded-lg px-3 py-2 text-xs app-text-main focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-3.5 py-1.5 rounded-lg border app-border text-xs app-text-muted hover:app-text-main cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 app-accent-bg text-white rounded-lg text-xs font-semibold hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                  >
                    Buat & Buka
                  </button>
                </div>
              </form>

              {/* Option B: Import Workspace from JSON File */}
              <div className="app-bg-main p-4 rounded-xl border border-dashed app-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold app-text-main flex items-center gap-1.5">
                    <Icons.Upload size={14} className="text-blue-400" />
                    <span>Atau Impor Workspace dari File JSON</span>
                  </h4>
                  <p className="text-[11px] app-text-muted">
                    Muat data berkas .json cadangan workspace yang pernah diekspor sebelumnya.
                  </p>
                </div>

                <label className="px-3.5 py-2 rounded-xl app-accent-bg text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0 hover:brightness-110 active:scale-95 transition-all shadow-sm">
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

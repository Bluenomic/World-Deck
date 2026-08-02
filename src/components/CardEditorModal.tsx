import React, { useState } from 'react';
import type { WorldCard, CardCategory, CustomAttribute, CardConnection } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import { generateId, parseMentions } from '../utils/helpers';
import * as Icons from 'lucide-react';

interface CardEditorModalProps {
  card: WorldCard;
  allCards: WorldCard[];
  connections: CardConnection[];
  onSave: (updatedCard: WorldCard) => void;
  onDelete: (cardId: string) => void;
  onClose: () => void;
  onNavigateToCard?: (cardId: string) => void;
  onAddConnection: (sourceId: string, targetId: string, label: string) => void;
  onDiscard?: (cardId: string) => void;
}

export const CardEditorModal: React.FC<CardEditorModalProps> = ({
  card,
  allCards,
  connections,
  onSave,
  onDelete,
  onClose,
  onNavigateToCard,
  onAddConnection,
  onDiscard,
}) => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [subtitle, setSubtitle] = useState(card.subtitle || '');
  const [category, setCategory] = useState<CardCategory>(card.category);
  const [summary, setSummary] = useState(card.summary || '');
  const [content, setContent] = useState(card.content || '');
  const [imageUrl, setImageUrl] = useState(card.imageUrl || '');
  const [showCoverInput, setShowCoverInput] = useState(false);
  const [tags, setTags] = useState<string[]>(card.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [attributes, setAttributes] = useState<CustomAttribute[]>(card.attributes || []);
  const [activeTab, setActiveTab] = useState<'content' | 'properties' | 'relations'>('content');

  const [targetCardId, setTargetCardId] = useState<string>('');
  const [relationLabel, setRelationLabel] = useState<string>('Berhubungan Dengan');

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim().toLowerCase()]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddAttribute = () => {
    setAttributes([
      ...attributes,
      { id: generateId('attr'), key: 'Properti Baru', value: 'Nilai' },
    ]);
  };

  const handleUpdateAttribute = (id: string, key: string, value: string) => {
    setAttributes(
      attributes.map((attr) => (attr.id === id ? { ...attr, key, value } : attr))
    );
  };

  const handleRemoveAttribute = (id: string) => {
    setAttributes(attributes.filter((attr) => attr.id !== id));
  };

  const handleInsertMention = (targetCard: WorldCard) => {
    const mentionText = ` @${targetCard.title} `;
    setContent((prev) => prev + mentionText);
  };

  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
        setShowCoverInput(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...card,
      title: title.trim() || 'Halaman Tanpa Judul',
      subtitle: subtitle.trim(),
      category,
      summary: summary.trim(),
      content: content.trim(),
      imageUrl: imageUrl.trim(),
      tags,
      attributes,
      updatedAt: Date.now(),
    });
  };

  const handleCreateConnection = () => {
    if (targetCardId) {
      onAddConnection(card.id, targetCardId, relationLabel);
      setTargetCardId('');
    }
  };

  const handleCloseRequest = () => {
    // Check if the card was originally empty (newly created blank card)
    const isOriginalEmpty =
      !card.title &&
      !card.subtitle &&
      !card.summary &&
      !card.content &&
      !card.imageUrl &&
      (!card.tags || card.tags.length === 0) &&
      (!card.attributes || card.attributes.length === 0);

    // Check if the current form inputs are also completely empty
    const isCurrentEmpty =
      !title.trim() &&
      !subtitle.trim() &&
      !summary.trim() &&
      !content.trim() &&
      !imageUrl.trim() &&
      tags.length === 0 &&
      attributes.length === 0;

    if (isOriginalEmpty && isCurrentEmpty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const cardConnections = connections.filter(
    (c) => c.sourceId === card.id || c.targetId === card.id
  );

  const categoryConfig = CATEGORY_CONFIGS[category];
  const IconComponent = (Icons as any)[categoryConfig.iconName] || Icons.FileText;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 z-50 backdrop-animate-appear cursor-pointer"
      onClick={() => {
        if (!showExitConfirm) {
          handleCloseRequest();
        }
      }}
    >
      <div 
        className="app-bg-secondary border app-border w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden app-text-main transition-colors modal-animate-appear cursor-default relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Action Bar */}
        <div className="px-4 py-2.5 app-bg-main border-b app-border flex items-center justify-between text-xs app-text-muted">
          <div className="flex items-center gap-2">
            <Icons.FileText size={14} className="app-accent-text" />
            <span>Halaman Kartu</span>
            <span>/</span>
            <span className="app-text-main font-medium truncate max-w-[200px]">{title}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="px-2.5 py-1 rounded-md text-rose-500 hover:bg-rose-950/40 transition-colors font-medium"
            >
              Hapus
            </button>
            <button
              type="button"
              onClick={handleCloseRequest}
              className="p-1 rounded-md app-bg-hover app-text-muted hover:app-text-main"
            >
              <Icons.X size={18} />
            </button>
          </div>
        </div>

        {/* Cover Photo Bar */}
        {imageUrl ? (
          <div className="h-44 w-full relative overflow-hidden group border-b app-border">
            <img src={imageUrl} alt="Cover" className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="absolute right-3 bottom-3 px-3 py-1 app-bg-main backdrop-blur-md rounded-lg text-xs text-rose-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity border app-border font-medium shadow-md"
            >
              Hapus Cover
            </button>
          </div>
        ) : (
          <div className="px-6 pt-4">
            {!showCoverInput ? (
              <button
                type="button"
                onClick={() => setShowCoverInput(true)}
                className="text-xs app-text-muted hover:app-text-main flex items-center gap-1.5 px-3 py-1.5 rounded-lg app-bg-main border app-border hover:app-bg-hover transition-colors font-medium"
              >
                <Icons.Image size={14} className="app-accent-text" />
                <span>+ Tambah Cover Gambar</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl app-bg-main border app-border space-y-2.5 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold app-text-main">Atur Cover Gambar Halaman</span>
                  <button
                    type="button"
                    onClick={() => setShowCoverInput(false)}
                    className="text-xs app-text-muted hover:app-text-main"
                  >
                    Tutup
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Tempel URL gambar (https://...)"
                    className="flex-1 w-full app-bg-secondary border app-border rounded-lg px-3 py-1.5 text-xs app-text-main focus:outline-none focus:border-purple-500 font-mono"
                  />
                  
                  <span className="text-xs app-text-muted">atau</span>

                  <label className="px-3 py-1.5 rounded-lg app-accent-bg text-white text-xs font-medium cursor-pointer flex items-center gap-1.5 shrink-0">
                    <Icons.Upload size={13} />
                    <span>Unggah Berkas Gambar</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex border-b app-border app-bg-main px-6 gap-4 text-xs font-medium app-text-muted mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'content'
                ? 'border-purple-500 app-text-main font-semibold'
                : 'border-transparent hover:app-text-main'
            }`}
          >
            <Icons.FileText size={14} />
            <span>Konten Halaman</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'properties'
                ? 'border-purple-500 app-text-main font-semibold'
                : 'border-transparent hover:app-text-main'
            }`}
          >
            <Icons.Sliders size={14} />
            <span>Database Properties ({attributes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('relations')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'relations'
                ? 'border-purple-500 app-text-main font-semibold'
                : 'border-transparent hover:app-text-main'
            }`}
          >
            <Icons.GitCommit size={14} />
            <span>Relasi Hubungan ({cardConnections.length})</span>
          </button>
        </div>

        {/* Editor Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {activeTab === 'content' && (
            <div className="space-y-4">
              
              {/* Category Selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs app-text-muted whitespace-nowrap">Kategori:</span>
                {(Object.keys(CATEGORY_CONFIGS) as CardCategory[]).map((cat) => {
                  const cfg = CATEGORY_CONFIGS[cat];
                  const isSel = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border transition-all ${
                        isSel
                          ? `${cfg.bgGradient} ${cfg.borderColor} app-text-main font-semibold`
                          : 'app-bg-main border app-border app-text-muted hover:app-text-main'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-1">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Judul Halaman..."
                  className="w-full bg-transparent border-none text-2xl md:text-3xl font-bold app-text-main placeholder:text-slate-500 focus:outline-none tracking-tight"
                />
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Gelar / Sub-judul singkat..."
                  className="w-full bg-transparent border-none text-xs app-text-muted placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              {/* Summary Callout Box */}
              <div className="notion-callout flex items-start gap-3">
                <IconComponent size={18} className="app-accent-text shrink-0 mt-0.5" />
                <textarea
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Ringkasan..."
                  className="w-full bg-transparent border-none text-xs app-text-main placeholder:text-slate-500 focus:outline-none leading-relaxed resize-none"
                />
              </div>

              {/* Main Content Markdown & @Mention */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold app-text-muted">
                    Catatan Lore & Penjelasan Lengkap
                  </label>
                  <span className="text-[11px] app-text-muted font-mono">Gunakan @NamaKartu</span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span className="text-[11px] app-text-muted whitespace-nowrap">Sisipkan:</span>
                  {allCards
                    .filter((c) => c.id !== card.id)
                    .slice(0, 5)
                    .map((otherCard) => (
                      <button
                        key={otherCard.id}
                        type="button"
                        onClick={() => handleInsertMention(otherCard)}
                        className="text-[11px] px-2 py-0.5 rounded app-bg-main border app-border app-accent-text hover:border-purple-400 whitespace-nowrap flex items-center gap-1"
                      >
                        <span>📄 {otherCard.title}</span>
                      </button>
                    ))}
                </div>

                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tuliskan isi catatan, lore, sejarah, atau mitologi... Gunakan @NamaKartu untuk merujuk kartu lain."
                  className="w-full app-bg-main border app-border rounded-xl p-3.5 text-xs app-text-main placeholder-slate-500 focus:outline-none focus:border-purple-500 leading-relaxed"
                />

                {content && (
                  <div className="p-3 rounded-lg app-bg-main border app-border space-y-1">
                    <span className="text-[10px] font-bold app-text-muted block uppercase">
                      Preview Link Halaman:
                    </span>
                    <div className="text-xs app-text-main leading-relaxed">
                      {parseMentions(content, allCards).map((seg, idx) =>
                        seg.isMention && seg.cardId ? (
                          <span
                            key={idx}
                            onClick={() => onNavigateToCard && onNavigateToCard(seg.cardId!)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 mx-0.5 rounded app-bg-secondary app-accent-text border app-border font-medium cursor-pointer hover:underline"
                          >
                            📄 {seg.text.substring(1)}
                          </span>
                        ) : (
                          <span key={idx}>{seg.text}</span>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold app-text-muted block">Tags Halaman (#tag)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Tambah tag..."
                    className="flex-1 app-bg-main border app-border rounded-lg px-3 py-1.5 text-xs app-text-main focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 app-bg-main hover:app-bg-hover app-text-main border app-border rounded-lg text-xs font-semibold"
                  >
                    + Tag
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded app-bg-main app-text-muted border app-border text-xs flex items-center gap-1"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-rose-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'properties' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold app-text-main">Database Properties</h4>
                  <p className="text-xs app-text-muted">Daftar atribut pasangan Nama & Nilai untuk kartu ini.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddAttribute}
                  className="px-3 py-1.5 rounded-lg app-accent-bg text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Icons.Plus size={14} />
                  <span>+ Properti Baru</span>
                </button>
              </div>

              {attributes.length === 0 ? (
                <div className="text-center py-8 app-bg-main rounded-xl border border-dashed app-border app-text-muted text-xs">
                  Belum ada atribut kustom. Klik "+ Properti Baru" untuk menambahkan.
                </div>
              ) : (
                <div className="space-y-2">
                  {attributes.map((attr) => (
                    <div key={attr.id} className="flex items-center gap-2 app-bg-main p-2 rounded-lg border app-border">
                      <input
                        type="text"
                        value={attr.key}
                        onChange={(e) => handleUpdateAttribute(attr.id, e.target.value, attr.value)}
                        placeholder="Nama Properti (mis. Ras)"
                        className="w-1/3 app-bg-secondary border app-border rounded px-2.5 py-1 text-xs app-text-main focus:outline-none"
                      />
                      <span className="app-text-muted">:</span>
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => handleUpdateAttribute(attr.id, attr.key, e.target.value)}
                        placeholder="Nilai (mis. Elven)"
                        className="flex-1 app-bg-secondary border app-border rounded px-2.5 py-1 text-xs app-text-main focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAttribute(attr.id)}
                        className="p-1 app-text-muted hover:text-rose-400 rounded hover:app-bg-hover"
                      >
                        <Icons.Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'relations' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl app-bg-main border app-border space-y-3">
                <h4 className="text-xs font-bold uppercase app-accent-text">
                  Hubungkan dengan Halaman Kartu Lain
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] app-text-muted mb-1">Pilih Kartu Target:</label>
                    <select
                      value={targetCardId}
                      onChange={(e) => setTargetCardId(e.target.value)}
                      className="w-full app-bg-secondary border app-border rounded-lg px-2.5 py-1.5 text-xs app-text-main focus:outline-none"
                    >
                      <option value="">-- Pilih Kartu --</option>
                      {allCards
                        .filter((c) => c.id !== card.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            [{c.category}] {c.title}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] app-text-muted mb-1">Label Hubungan:</label>
                    <input
                      type="text"
                      value={relationLabel}
                      onChange={(e) => setRelationLabel(e.target.value)}
                      placeholder="mis. Musuh Bebentukan"
                      className="w-full app-bg-secondary border app-border rounded-lg px-2.5 py-1.5 text-xs app-text-main focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={!targetCardId}
                      onClick={handleCreateConnection}
                      className="w-full py-1.5 app-accent-bg disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Icons.Link size={14} />
                      <span>Buat Hubungan</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase app-text-muted mb-2">
                  Daftar Hubungan Aktif
                </h4>
                {cardConnections.length === 0 ? (
                  <div className="text-center py-6 app-bg-main rounded-xl border app-border app-text-muted text-xs">
                    Kartu ini belum terhubung dengan kartu manapun.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cardConnections.map((conn) => {
                      const otherId = conn.sourceId === card.id ? conn.targetId : conn.sourceId;
                      const otherCard = allCards.find((c) => c.id === otherId);
                      if (!otherCard) return null;

                      return (
                        <div
                          key={conn.id}
                          className="flex items-center justify-between p-2.5 rounded-lg app-bg-main border app-border"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded app-bg-secondary app-accent-text text-[10px] border app-border">
                              {conn.label}
                            </span>
                            <span className="text-xs app-text-main font-medium">
                              → {otherCard.title}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onNavigateToCard && onNavigateToCard(otherCard.id)}
                            className="px-2.5 py-1 rounded app-bg-secondary hover:app-bg-hover app-accent-text text-xs border app-border"
                          >
                            Lihat di Canvas
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t app-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseRequest}
              className="px-4 py-2 rounded-lg border app-border app-text-muted hover:app-text-main text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg app-accent-bg text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
            >
              <Icons.Save size={15} />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>

      {showExitConfirm && (
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[60] cursor-default backdrop-animate-appear"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="app-bg-secondary border app-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 modal-animate-appear text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center">
              <Icons.AlertTriangle size={24} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-bold app-text-main">Simpan atau Buang Kartu?</h4>
              <p className="text-xs app-text-muted leading-relaxed">
                Kartu baru ini masih kosong. Apakah Anda ingin membuang kartu ini atau tetap menyimpannya di canvas?
              </p>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onDiscard) {
                    onDiscard(card.id);
                  } else {
                    onDelete(card.id);
                  }
                }}
                className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                Hapus Kartu
              </button>
              <button
                type="button"
                onClick={() => {
                  onSave({
                    ...card,
                    title: 'Kartu Tanpa Judul',
                    updatedAt: Date.now(),
                  });
                }}
                className="w-full py-2 rounded-lg app-bg-main border app-border hover:app-bg-hover app-text-main text-xs font-semibold transition-colors"
              >
                Simpan Kartu Kosong
              </button>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-2 rounded-lg text-xs app-text-muted hover:app-text-main font-semibold transition-colors"
              >
                Batal (Kembali Edit)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

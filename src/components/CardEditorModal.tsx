import React, { useState } from 'react';
import type { WorldCard, CardCategory, CustomAttribute, CardConnection } from '../types';
import { CATEGORY_CONFIGS, PRIMARY_CATEGORIES } from '../data/categoryConfig';
import { generateId, parseMentions } from '../utils/helpers';
import { isTauriAvailable, saveImageAsset } from '../utils/tauriStorage';
import * as Icons from 'lucide-react';

const SUGGESTED_ATTRIBUTES_BY_CATEGORY: Record<string, string[]> = {
  character: ['Umur', 'Peran', 'Senjata', 'Afiliasi', 'Status', 'Hobi', 'Tinggi Badan', 'Spesies'],
  faction: ['Pemimpin', 'Markas Besar', 'Jumlah Anggota', 'Ideologi', 'Aliansi', 'Kekuatan Utama'],
  location: ['Wilayah', 'Iklim', 'Populasi', 'Bahasa Utama', 'Tingkat Bahaya', 'Penguasa'],
  lore: ['Asal Usul', 'Elemen', 'Periode Era', 'Dampak Utama', 'Tokoh Kunci'],
  timeline: ['Tanggal / Era', 'Lokasi Kejadian', 'Pihak Terlibat', 'Hasil / Dampak', 'Tingkat Skala'],
  item: ['Tipe Item', 'Pemilik', 'Kelangkaan', 'Efek / Sihir', 'Bahan Pembuatan'],
  realm: ['Ibu Kota', 'Bentuk Pemerintahan', 'Mata Uang', 'Agama Mayoritas', 'Penguasa Utama'],
};

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
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [summary, setSummary] = useState(card.summary || '');
  const [content, setContent] = useState(card.content || '');
  const [images, setImages] = useState<string[]>(() => {
    const existing = card.images ? [...card.images] : [];
    if (card.imageUrl && !existing.includes(card.imageUrl)) {
      existing.unshift(card.imageUrl);
    }
    return existing;
  });
  const [imageUrl, setImageUrl] = useState<string>(card.imageUrl || (card.images?.[0] || ''));
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

  const handleAddAttribute = (initialKey: string = '', initialValue: string = '') => {
    setAttributes((prev) => [
      ...prev,
      { id: generateId('attr'), key: initialKey, value: initialValue },
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

  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const base64Data = event.target.result as string;
        let finalUrl = base64Data;
        if (isTauriAvailable()) {
          const assetUrl = await saveImageAsset(base64Data, title || 'card-image');
          if (assetUrl) finalUrl = assetUrl;
        }
        setImages((prev) => Array.from(new Set([...prev, finalUrl])));
        if (!imageUrl) setImageUrl(finalUrl);
        setShowCoverInput(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSetThumbnail = (imgSrc: string) => {
    setImageUrl(imgSrc);
  };

  const handleRemoveImage = (imgSrc: string) => {
    const nextImages = images.filter((img) => img !== imgSrc);
    setImages(nextImages);
    if (imageUrl === imgSrc) {
      setImageUrl(nextImages[0] || '');
    }
  };

  const [imageHeight, setImageHeight] = useState<number | undefined>(card.imageHeight);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSave({
      ...card,
      title: title.trim() || 'Kartu Tanpa Judul',
      subtitle: subtitle.trim(),
      category,
      summary: summary.trim(),
      content: content.trim(),
      imageUrl: imageUrl.trim(),
      imageHeight: imageHeight,
      images,
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
    const isOriginalEmpty =
      !card.title &&
      !card.subtitle &&
      !card.summary &&
      !card.content &&
      !card.imageUrl &&
      (!card.tags || card.tags.length === 0) &&
      (!card.attributes || card.attributes.length === 0);

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

  const categoryConfig = CATEGORY_CONFIGS[category] || CATEGORY_CONFIGS.character;
  const CategoryIcon = (Icons as any)[categoryConfig.iconName] || Icons.HelpCircle;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-6 backdrop-animate-appear select-none"
      onClick={handleCloseRequest}
    >
      <div
        className="bg-[#2c2c2c] border border-[#383838] w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white transition-colors modal-animate-appear cursor-default relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Action Strip */}
        <div className="px-5 py-3 bg-[#1e1e1e] border-b border-[#383838] flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            {/* Custom Category Select Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="bg-[#2c2c2c] border border-[#383838] hover:border-[#0d99ff] rounded-lg px-2.5 py-1 flex items-center gap-2 text-xs font-bold text-white cursor-pointer transition-colors"
              >
                <CategoryIcon size={14} style={{ color: categoryConfig.color }} className="shrink-0" />
                <span>{categoryConfig.label}</span>
                <Icons.ChevronDown size={12} className="text-slate-400 shrink-0 ml-0.5" />
              </button>

              {isCategoryOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[140]"
                    onClick={() => setIsCategoryOpen(false)}
                  />
                  <div
                    className="absolute left-0 top-full mt-1.5 w-48 bg-[#1e1e1e] border border-[#383838] rounded-xl shadow-2xl py-1 z-[150] space-y-0.5 custom-scrollbar max-h-60 overflow-y-auto"
                  >
                    {PRIMARY_CATEGORIES.map((cat) => {
                      const cfg = CATEGORY_CONFIGS[cat];
                      const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle;
                      const isSelected = category === cat;

                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategory(cat);
                            setIsCategoryOpen(false);
                          }}
                          className={`w-full px-3 py-1.5 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#0d99ff]/15 text-[#0d99ff]'
                              : 'text-slate-200 hover:bg-[#2c2c2c]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <IconComp size={14} style={{ color: cfg.color }} className="shrink-0" />
                            <span>{cfg.label}</span>
                          </div>
                          {isSelected && <Icons.Check size={13} className="text-[#0d99ff]" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <span className="text-slate-600">/</span>
            <span className="text-white font-bold truncate max-w-[200px]">{title || 'Kartu Tanpa Judul'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="px-2.5 py-1 rounded-lg text-rose-400 hover:bg-rose-500/10 font-semibold transition-colors cursor-pointer"
            >
              Hapus
            </button>
            <div className="h-4 w-px bg-[#383838]" />
            <button
              type="button"
              onClick={handleCloseRequest}
              className="p-1 rounded-lg hover:bg-[#383838] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <Icons.X size={18} />
            </button>
          </div>
        </div>

        {/* Cover Photo Header */}
        {imageUrl ? (
          <div className="h-40 w-full relative overflow-hidden group border-b border-[#383838] bg-[#1e1e1e]">
            <img src={imageUrl} alt="Cover" className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-3 gap-2">
              <button
                type="button"
                onClick={() => setShowCoverInput(true)}
                className="px-3 py-1 bg-[#2c2c2c]/90 backdrop-blur-md rounded-lg text-xs text-white border border-[#383838] font-semibold hover:bg-[#383838]"
              >
                Ubah Cover
              </button>
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="px-3 py-1 bg-rose-950/80 backdrop-blur-md rounded-lg text-xs text-rose-300 border border-rose-500/30 font-semibold hover:bg-rose-900"
              >
                Hapus Cover
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 pt-3">
            {!showCoverInput ? (
              <button
                type="button"
                onClick={() => setShowCoverInput(true)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#383838] hover:border-[#0d99ff] transition-all font-semibold cursor-pointer"
              >
                <Icons.Image size={14} className="text-[#0d99ff]" />
                <span>+ Tambah Cover Gambar</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-[#1e1e1e] border border-[#383838] space-y-2 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Atur Cover Gambar Halaman</span>
                  <button
                    type="button"
                    onClick={() => setShowCoverInput(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Tutup
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setImageUrl(val);
                      if (val && !images.includes(val)) {
                        setImages((prev) => [...prev, val]);
                      }
                    }}
                    placeholder="Tempel URL gambar (https://...)"
                    className="flex-1 w-full bg-[#2c2c2c] border border-[#383838] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff] font-mono"
                  />
                  <span className="text-xs text-slate-500">atau</span>
                  <label className="px-3 py-1.5 rounded-lg bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                    <Icons.Upload size={13} />
                    <span>Unggah Berkas</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {imageUrl && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[#383838]">
                    <span className="text-xs font-semibold text-slate-400">Tinggi Gambar (px):</span>
                    <input
                      type="number"
                      min={48}
                      max={600}
                      value={imageHeight || 120}
                      onChange={(e) => setImageHeight(Number(e.target.value) || undefined)}
                      className="w-20 bg-[#2c2c2c] border border-[#383838] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#0d99ff] font-mono text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setImageHeight(undefined)}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Galeri Gambar Kartu & Picker */}
        <div className="px-6 pt-3 pb-1">
          <div className="p-3 rounded-xl bg-[#1e1e1e] border border-[#383838] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
                <Icons.Image size={14} className="text-[#0d99ff]" />
                <span>Galeri Gambar Kartu ({images.length})</span>
              </div>
              <label className="px-2.5 py-1 rounded-lg bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/30 text-xs font-bold hover:bg-[#0d99ff]/30 transition-all cursor-pointer flex items-center gap-1">
                <Icons.Plus size={12} />
                <span>+ Tambah Gambar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {images.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3 italic">
                Belum ada gambar di galeri. Klik &quot;+ Tambah Gambar&quot; untuk mengunggah.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {images.map((imgSrc, idx) => {
                  const isThumbnail = imageUrl === imgSrc;
                  return (
                    <div
                      key={idx}
                      className={`relative rounded-xl overflow-hidden border group bg-[#2c2c2c] aspect-video transition-all ${
                        isThumbnail ? 'border-[#0d99ff] ring-2 ring-[#0d99ff]/40 shadow-md' : 'border-[#383838] hover:border-slate-500'
                      }`}
                    >
                      <img src={imgSrc} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />

                      {isThumbnail && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#0d99ff] text-white text-[9px] font-bold shadow-md flex items-center gap-1">
                          <Icons.Star size={10} className="fill-white" />
                          <span>Thumbnail</span>
                        </span>
                      )}

                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                        {!isThumbnail && (
                          <button
                            type="button"
                            onClick={() => handleSetThumbnail(imgSrc)}
                            className="px-2 py-1 rounded-lg bg-[#0d99ff] text-white text-[10px] font-bold hover:bg-[#0b85de] shadow-md flex items-center gap-1 cursor-pointer"
                            title="Jadikan Thumbnail Utama"
                          >
                            <Icons.Star size={11} />
                            <span>Set Cover</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(imgSrc)}
                          className="p-1.5 rounded-lg bg-rose-600/80 text-white hover:bg-rose-600 shadow-md cursor-pointer"
                          title="Hapus dari galeri"
                        >
                          <Icons.Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Title & Metadata Strip */}
        <div className="px-6 pt-4 pb-2 space-y-2">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul Kartu / Halaman..."
            className="w-full bg-transparent border-none text-2xl sm:text-3xl font-extrabold text-white placeholder:text-slate-600 focus:outline-none tracking-tight"
          />
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Sub-judul / Gelar Singkat (opsional)..."
            className="w-full bg-transparent border-none text-xs text-slate-400 placeholder:text-slate-600 focus:outline-none font-medium"
          />
        </div>

        {/* Segmented Mode Tabs */}
        <div className="flex border-b border-[#383838] bg-[#1e1e1e] px-6 gap-6 text-xs font-semibold text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'content'
                ? 'border-[#0d99ff] text-white font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Icons.FileText size={14} className={activeTab === 'content' ? 'text-[#0d99ff]' : ''} />
            <span>Catatan Lore</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'properties'
                ? 'border-[#0d99ff] text-white font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Icons.Sliders size={14} className={activeTab === 'properties' ? 'text-amber-400' : ''} />
            <span>Properti Infobox ({attributes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('relations')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'relations'
                ? 'border-[#0d99ff] text-white font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Icons.GitCommit size={14} className={activeTab === 'relations' ? 'text-purple-400' : ''} />
            <span>Relasi Hubungan ({cardConnections.length})</span>
          </button>
        </div>

        {/* Editor Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          
          {/* TAB 1: CATATAN LORE */}
          {activeTab === 'content' && (
            <div className="space-y-4">
              {/* Summary Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Ringkasan Singkat (Summary)</label>
                <textarea
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Ringkasan singkat 1-2 kalimat..."
                  className="w-full bg-[#1e1e1e] border border-[#383838] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0d99ff] leading-relaxed resize-none"
                />
              </div>

              {/* Main Content Markdown */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400 block">
                    Catatan Lore & Penjelasan Lengkap
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">Mentions: Ketik @JudulKartu</span>
                </div>

                <textarea
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tuliskan catatan lore, mitologi, sejarah, atau deskripsi lengkap di sini. Gunakan @JudulKartu untuk merujuk kartu lain..."
                  className="w-full bg-[#1e1e1e] border border-[#383838] rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0d99ff] leading-relaxed custom-scrollbar"
                />

                {/* Live Mention Segment Preview */}
                {content && (
                  <div className="p-3 rounded-xl bg-[#1e1e1e] border border-[#383838] space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Preview Link Kartu:
                    </span>
                    <div className="text-xs text-slate-200 leading-relaxed">
                      {parseMentions(content, allCards).map((seg, idx) =>
                        seg.isMention && seg.cardId ? (
                          <span
                            key={idx}
                            onClick={() => onNavigateToCard && onNavigateToCard(seg.cardId!)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-[#0d99ff]/15 text-[#0d99ff] border border-[#0d99ff]/30 font-semibold cursor-pointer hover:underline"
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

              {/* Tags Section */}
              <div className="space-y-2 pt-2 border-t border-[#383838]">
                <label className="text-xs font-semibold text-slate-400 block">Tag (#tag)</label>
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
                    placeholder="Ketik tag lalu tekan Enter..."
                    className="flex-1 bg-[#1e1e1e] border border-[#383838] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3.5 py-1.5 bg-[#1e1e1e] hover:bg-[#383838] text-white border border-[#383838] rounded-lg text-xs font-bold cursor-pointer"
                  >
                    + Tag
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full bg-[#1e1e1e] text-slate-300 border border-[#383838] text-xs font-semibold flex items-center gap-1.5"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROPERTI INFOBOX */}
          {activeTab === 'properties' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Atribut Kustom (Infobox)</h4>
                  <p className="text-xs text-slate-400">Daftar properti spesifik kategori (mis. Spesies, Afiliasi, Senjata).</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddAttribute('', '')}
                  className="px-3 py-1.5 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Icons.Plus size={14} />
                  <span>+ Properti Baru</span>
                </button>
              </div>

              {attributes.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#1e1e1e] border border-dashed border-[#383838] text-center space-y-3">
                  <p className="text-xs text-slate-400">Belum ada atribut kustom ditambahkan.</p>
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saran:</span>
                    {(SUGGESTED_ATTRIBUTES_BY_CATEGORY[category] || []).map((suggKey) => (
                      <button
                        key={suggKey}
                        type="button"
                        onClick={() => handleAddAttribute(suggKey, '')}
                        className="text-xs px-2.5 py-1 rounded-lg bg-[#2c2c2c] border border-[#383838] text-slate-200 font-semibold hover:border-[#0d99ff] hover:text-[#0d99ff] transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Icons.Plus size={11} className="text-[#0d99ff]" />
                        <span>{suggKey}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {attributes.map((attr) => (
                    <div key={attr.id} className="flex items-center gap-2 bg-[#1e1e1e] p-2.5 rounded-xl border border-[#383838]">
                      <input
                        type="text"
                        value={attr.key}
                        onChange={(e) => handleUpdateAttribute(attr.id, e.target.value, attr.value)}
                        placeholder="Nama Properti (mis. Spesies)"
                        className="w-1/3 bg-[#2c2c2c] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff] font-semibold"
                      />
                      <span className="text-slate-500 font-bold">:</span>
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => handleUpdateAttribute(attr.id, attr.key, e.target.value)}
                        placeholder="Nilai (mis. Manusia)"
                        className="flex-1 bg-[#2c2c2c] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff] font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAttribute(attr.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-[#383838] transition-colors cursor-pointer"
                        title="Hapus Properti"
                      >
                        <Icons.Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RELASI HUBUNGAN */}
          {activeTab === 'relations' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-[#1e1e1e] border border-[#383838] space-y-3">
                <h4 className="text-xs font-bold uppercase text-[#0d99ff]">
                  Hubungkan dengan Halaman Kartu Lain
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Pilih Kartu Target:</label>
                    <select
                      value={targetCardId}
                      onChange={(e) => setTargetCardId(e.target.value)}
                      className="w-full bg-[#2c2c2c] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
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
                    <label className="block text-[11px] text-slate-400 mb-1">Label Hubungan:</label>
                    <input
                      type="text"
                      value={relationLabel}
                      onChange={(e) => setRelationLabel(e.target.value)}
                      placeholder="mis. Musuh Bebentukan"
                      className="w-full bg-[#2c2c2c] border border-[#383838] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={!targetCardId}
                      onClick={handleCreateConnection}
                      className="w-full py-1.5 bg-[#0d99ff] hover:bg-[#0b85de] disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Icons.Link size={14} />
                      <span>Buat Hubungan</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">
                  Daftar Hubungan Aktif
                </h4>
                {cardConnections.length === 0 ? (
                  <div className="text-center py-6 bg-[#1e1e1e] rounded-xl border border-[#383838] text-slate-400 text-xs">
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
                          className="flex items-center justify-between p-3 rounded-xl bg-[#1e1e1e] border border-[#383838]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#2c2c2c] text-[#0d99ff] text-[10px] font-bold border border-[#383838]">
                              {conn.label}
                            </span>
                            <span className="text-xs text-white font-semibold">
                              → {otherCard.title}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onNavigateToCard && onNavigateToCard(otherCard.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#2c2c2c] hover:bg-[#383838] text-[#0d99ff] text-xs font-bold border border-[#383838] transition-colors cursor-pointer"
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

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#383838] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseRequest}
              className="px-4 py-2 rounded-xl border border-[#383838] bg-[#1e1e1e] hover:bg-[#383838] text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
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
          <div className="bg-[#2c2c2c] border border-[#383838] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 modal-animate-appear text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center">
              <Icons.AlertTriangle size={24} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-white">Simpan atau Buang Kartu?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
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
                className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-colors"
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
                className="w-full py-2 rounded-xl bg-[#1e1e1e] border border-[#383838] hover:bg-[#383838] text-white text-xs font-bold transition-colors"
              >
                Simpan Kartu Kosong
              </button>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-2 rounded-xl text-xs text-slate-400 hover:text-white font-bold transition-colors"
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

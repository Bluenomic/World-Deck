import React, { useState } from 'react';
import type { WorldCard, CardCategory, CustomAttribute, CardConnection } from '../types';
import { CATEGORY_CONFIGS, PRIMARY_CATEGORIES } from '../data/categoryConfig';
import { generateId } from '../utils/helpers';
import { isTauriAvailable, saveImageAsset } from '../utils/tauriStorage';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

const SUGGESTED_ATTRIBUTES_BY_CATEGORY: Record<string, { id: string[]; en: string[] }> = {
  character: {
    id: ['Umur', 'Peran', 'Senjata', 'Afiliasi', 'Status', 'Hobi', 'Tinggi Badan', 'Spesies'],
    en: ['Age', 'Role', 'Weapon', 'Affiliation', 'Status', 'Hobby', 'Height', 'Species'],
  },
  faction: {
    id: ['Pemimpin', 'Markas Besar', 'Jumlah Anggota', 'Ideologi', 'Aliansi', 'Kekuatan Utama'],
    en: ['Leader', 'Headquarters', 'Member Count', 'Ideology', 'Alliance', 'Primary Strength'],
  },
  location: {
    id: ['Wilayah', 'Iklim', 'Populasi', 'Bahasa Utama', 'Tingkat Bahaya', 'Penguasa'],
    en: ['Region', 'Climate', 'Population', 'Primary Language', 'Danger Level', 'Ruler'],
  },
  lore: {
    id: ['Asal Usul', 'Elemen', 'Periode Era', 'Dampak Utama', 'Tokoh Kunci'],
    en: ['Origin', 'Element', 'Era Period', 'Primary Impact', 'Key Figure'],
  },
  timeline: {
    id: ['Tanggal / Era', 'Lokasi Kejadian', 'Pihak Terlibat', 'Hasil / Dampak', 'Tingkat Skala'],
    en: ['Date / Era', 'Location', 'Parties Involved', 'Outcome / Impact', 'Scale'],
  },
  item: {
    id: ['Tipe Item', 'Pemilik', 'Kelangkaan', 'Efek / Sihir', 'Bahan Pembuatan'],
    en: ['Item Type', 'Owner', 'Rarity', 'Effect / Magic', 'Crafting Material'],
  },
  realm: {
    id: ['Ibu Kota', 'Bentuk Pemerintahan', 'Mata Uang', 'Agama Mayoritas', 'Penguasa Utama'],
    en: ['Capital', 'Government Form', 'Currency', 'Majority Religion', 'Primary Ruler'],
  },
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
  const { language, t, getCategoryLabel } = useLanguage();
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
  const [relationLabel, setRelationLabel] = useState<string>(language === 'en' ? 'Related To' : 'Berhubungan Dengan');

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

  const [imageHeight] = useState<number | undefined>(card.imageHeight);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSave({
      ...card,
      title: title.trim() || t.common.untitled,
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

  const isCardEmpty = () => {
    return (
      !title.trim() &&
      !subtitle.trim() &&
      !summary.trim() &&
      !content.trim() &&
      !imageUrl.trim() &&
      attributes.length === 0 &&
      tags.length === 0
    );
  };

  const handleCloseRequest = () => {
    if (isCardEmpty()) {
      setShowExitConfirm(true);
    } else {
      handleSubmit();
      onClose();
    }
  };

  const existingConnections = connections.filter(
    (c) => c.sourceId === card.id || c.targetId === card.id
  );

  const suggestedAttributesList = SUGGESTED_ATTRIBUTES_BY_CATEGORY[category]
    ? (language === 'en' ? SUGGESTED_ATTRIBUTES_BY_CATEGORY[category].en : SUGGESTED_ATTRIBUTES_BY_CATEGORY[category].id)
    : [];

  const categoryConfig = CATEGORY_CONFIGS[category] || CATEGORY_CONFIGS.character;
  const CategoryIcon = (Icons as any)[categoryConfig.iconName] || Icons.HelpCircle;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 z-[150] animate-in fade-in duration-200 select-none cursor-pointer"
      onClick={handleCloseRequest}
    >
      <div
        className="bg-[#1e1e1e] border border-[#383838] w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white transition-all cursor-default relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Navigation Bar */}
        <div className="px-6 py-3 border-b border-[#383838] bg-[#1e1e1e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="bg-[#2c2c2c] border border-[#383838] hover:border-[#0d99ff] rounded-lg px-2.5 py-1 flex items-center gap-2 text-xs font-bold text-white cursor-pointer transition-colors"
              >
                <CategoryIcon size={14} style={{ color: categoryConfig.color }} className="shrink-0" />
                <span>{getCategoryLabel(category)}</span>
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
                            <span>{getCategoryLabel(cat)}</span>
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
            <span className="text-white font-bold truncate max-w-[200px]">{title || t.common.untitled}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="px-2.5 py-1 rounded-lg text-rose-400 hover:bg-rose-500/10 font-semibold transition-colors cursor-pointer"
            >
              {t.common.delete}
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
                {t.cardEditor.changeCover}
              </button>
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="px-3 py-1 bg-rose-950/80 backdrop-blur-md rounded-lg text-xs text-rose-300 border border-rose-500/30 font-semibold hover:bg-rose-900"
              >
                {t.cardEditor.removeCover}
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
                <span>+ {t.cardEditor.addCover}</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-[#1e1e1e] border border-[#383838] space-y-2 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{t.cardEditor.coverImage}</span>
                  <button
                    type="button"
                    onClick={() => setShowCoverInput(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    {t.common.close}
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
                    placeholder="https://..."
                    className="flex-1 w-full bg-[#2c2c2c] border border-[#383838] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff] font-mono"
                  />
                  <span className="text-xs text-slate-500">{t.cardEditor.or}</span>
                  <label className="px-3 py-1.5 rounded-lg bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                    <Icons.Upload size={13} />
                    <span>{t.cardEditor.uploadFile}</span>
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

        {/* Galeri Gambar Kartu & Picker */}
        <div className="px-6 pt-3 pb-1">
          <div className="p-3 rounded-xl bg-[#1e1e1e] border border-[#383838] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
                <Icons.Image size={14} className="text-[#0d99ff]" />
                <span>{t.cardReader.imageGallery} ({images.length})</span>
              </div>
              <label className="px-2.5 py-1 rounded-lg bg-[#0d99ff]/20 text-[#0d99ff] border border-[#0d99ff]/30 text-xs font-bold hover:bg-[#0d99ff]/30 transition-all cursor-pointer flex items-center gap-1">
                <Icons.Plus size={12} />
                <span>+ {t.cardEditor.addImage}</span>
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
                {t.cardEditor.noImages}
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
                            title={t.cardEditor.setThumbnail}
                          >
                            <Icons.Star size={11} />
                            <span>Cover</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(imgSrc)}
                          className="p-1.5 rounded-lg bg-rose-600/80 text-white hover:bg-rose-600 shadow-md cursor-pointer"
                          title={t.common.delete}
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
            placeholder={t.cardEditor.titlePlaceholder}
            className="w-full bg-transparent text-2xl md:text-3xl font-extrabold text-white placeholder-slate-600 focus:outline-none tracking-tight"
          />
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder={t.cardEditor.subtitlePlaceholder}
            className="w-full bg-transparent text-xs text-slate-300 italic placeholder-slate-600 focus:outline-none font-medium"
          />
        </div>

        {/* Tab Navigation Segment */}
        <div className="px-6 border-b border-[#383838] flex items-center gap-2 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'content'
                ? 'border-[#0d99ff] text-[#0d99ff] font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Icons.FileText size={14} />
            <span>{t.cardEditor.tabContent}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'properties'
                ? 'border-[#0d99ff] text-[#0d99ff] font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Icons.Sliders size={14} />
            <span>{t.cardEditor.tabAttributes} ({attributes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('relations')}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'relations'
                ? 'border-[#0d99ff] text-[#0d99ff] font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Icons.GitCommit size={14} />
            <span>{t.cardEditor.tabRelations} ({existingConnections.length})</span>
          </button>
        </div>

        {/* Form Body Form / Tab Contents */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {activeTab === 'content' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>{t.cardEditor.summary}</span>
                  <span className="text-[10px] text-slate-500 font-normal">{t.cardEditor.summaryHint}</span>
                </label>
                <textarea
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder={t.cardEditor.summaryHint}
                  className="w-full bg-[#2c2c2c] border border-[#383838] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0d99ff] leading-relaxed resize-none font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>{t.cardEditor.loreNotes}</span>
                  <span className="text-[10px] text-slate-500 font-normal">Format Markdown & Mention Kartu @Judul</span>
                </label>
                <textarea
                  rows={10}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t.cardEditor.contentPlaceholder}
                  className="w-full bg-[#2c2c2c] border border-[#383838] rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0d99ff] leading-relaxed resize-y font-sans custom-scrollbar"
                />
              </div>

              {/* Tags Input */}
              <div className="space-y-2 pt-2 border-t border-[#383838]">
                <label className="text-xs font-bold text-slate-300">{t.common.tags}</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-[#2c2c2c] text-slate-300 border border-[#383838] text-xs font-medium flex items-center gap-1.5"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-rose-400 cursor-pointer"
                      >
                        <Icons.X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
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
                    placeholder={t.cardEditor.addTagPlaceholder}
                    className="flex-1 bg-[#2c2c2c] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 rounded-xl bg-[#2c2c2c] hover:bg-[#383838] text-white text-xs font-bold border border-[#383838] transition-colors cursor-pointer"
                  >
                    + {t.cardEditor.addTag}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'properties' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">{t.cardEditor.attributes}</h4>
                  <p className="text-[11px] text-slate-400">{t.cardEditor.attributesDesc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddAttribute()}
                  className="px-3 py-1.5 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Icons.Plus size={13} />
                  <span>+ {t.cardEditor.addAttribute}</span>
                </button>
              </div>

              {/* Rekomendasi Atribut Kategori */}
              {suggestedAttributesList.length > 0 && (
                <div className="p-3 rounded-xl bg-[#1e1e1e] border border-[#383838] space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {t.cardEditor.suggestedAttributes} ({getCategoryLabel(category)}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedAttributesList.map((sugg) => {
                      const isAdded = attributes.some((a) => a.key.toLowerCase() === sugg.toLowerCase());
                      return (
                        <button
                          key={sugg}
                          type="button"
                          disabled={isAdded}
                          onClick={() => handleAddAttribute(sugg, '')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                            isAdded
                              ? 'bg-[#2c2c2c] border-[#383838] text-slate-600 cursor-not-allowed'
                              : 'bg-[#2c2c2c] border-[#383838] text-slate-300 hover:text-white hover:border-[#0d99ff]'
                          }`}
                        >
                          + {sugg}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Attribute List Table */}
              {attributes.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs italic border border-dashed border-[#383838] rounded-xl">
                  {t.cardEditor.noAttributes}
                </div>
              ) : (
                <div className="space-y-2">
                  {attributes.map((attr) => (
                    <div key={attr.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={attr.key}
                        onChange={(e) => handleUpdateAttribute(attr.id, e.target.value, attr.value)}
                        placeholder={t.cardEditor.attributeNamePlaceholder}
                        className="flex-1 bg-[#2c2c2c] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                      />
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => handleUpdateAttribute(attr.id, attr.key, e.target.value)}
                        placeholder={t.cardEditor.attributeValuePlaceholder}
                        className="flex-1 bg-[#2c2c2c] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAttribute(attr.id)}
                        className="p-2 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title={t.common.delete}
                      >
                        <Icons.Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'relations' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Form Tambah Relasi Garis */}
              <div className="p-4 rounded-xl bg-[#1e1e1e] border border-[#383838] space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Icons.GitCommit size={14} className="text-[#0d99ff]" />
                  <span>{t.cardEditor.addRelationTitle}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">{t.cardEditor.connectToTargetCard}</label>
                    <select
                      value={targetCardId}
                      onChange={(e) => setTargetCardId(e.target.value)}
                      className="w-full bg-[#2c2c2c] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                    >
                      <option value="">{t.cardEditor.selectCardPlaceholder}</option>
                      {allCards
                        .filter((c) => c.id !== card.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            [{getCategoryLabel(c.category)}] {c.title || t.common.untitled}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">{t.cardEditor.relationLabelHeader}</label>
                    <input
                      type="text"
                      value={relationLabel}
                      onChange={(e) => setRelationLabel(e.target.value)}
                      placeholder={t.cardEditor.relationLabelPlaceholder}
                      className="w-full bg-[#2c2c2c] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0d99ff]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={!targetCardId}
                    onClick={handleCreateConnection}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      targetCardId
                        ? 'bg-[#0d99ff] hover:bg-[#0b85de] text-white cursor-pointer shadow-md'
                        : 'bg-[#2c2c2c] text-slate-500 cursor-not-allowed border border-[#383838]'
                    }`}
                  >
                    {t.cardEditor.createRelationButton}
                  </button>
                </div>
              </div>

              {/* Daftar Relasi Terpasang */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white">{t.cardEditor.activeRelations}</h4>

                {existingConnections.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center border border-dashed border-[#383838] rounded-xl">
                    {t.cardEditor.noRelations}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {existingConnections.map((conn) => {
                      const isSource = conn.sourceId === card.id;
                      const otherCardId = isSource ? conn.targetId : conn.sourceId;
                      const otherCard = allCards.find((c) => c.id === otherCardId);
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
                              → {otherCard.title || t.common.untitled}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onNavigateToCard && onNavigateToCard(otherCard.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#2c2c2c] hover:bg-[#383838] text-[#0d99ff] text-xs font-bold border border-[#383838] transition-colors cursor-pointer"
                          >
                            {t.sidebar.focusOnCanvas}
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
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Icons.Save size={15} />
              <span>{t.common.save}</span>
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
              <h4 className="text-base font-bold text-white">
                {language === 'en' ? 'Save or Discard Card?' : 'Simpan atau Buang Kartu?'}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {language === 'en'
                  ? 'This new card is empty. Do you want to discard it or save it as an empty card?'
                  : 'Kartu baru ini masih kosong. Apakah Anda ingin membuang kartu ini atau tetap menyimpannya di canvas?'}
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
                {t.common.delete}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSave({
                    ...card,
                    title: t.common.untitled,
                    updatedAt: Date.now(),
                  });
                }}
                className="w-full py-2 rounded-xl bg-[#1e1e1e] border border-[#383838] hover:bg-[#383838] text-white text-xs font-bold transition-colors"
              >
                {language === 'en' ? 'Save Empty Card' : 'Simpan Kartu Kosong'}
              </button>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-2 rounded-xl text-xs text-slate-400 hover:text-white font-bold transition-colors"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

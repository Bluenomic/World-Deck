import React, { useState, useEffect } from 'react';
import type { WorldCard, CardConnection, WorldDeck } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import { parseMentions } from '../utils/helpers';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

interface CardReaderSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  card: WorldCard | null;
  allCards: WorldCard[];
  connections: CardConnection[];
  decks: WorldDeck[];
  onEditCard: (card: WorldCard) => void;
  onSelectCard: (cardId: string) => void;
  initialFullPage?: boolean;
}

export const CardReaderSidebar: React.FC<CardReaderSidebarProps> = ({
  isOpen,
  onClose,
  card,
  allCards,
  connections,
  decks,
  onEditCard,
  onSelectCard,
  initialFullPage = false,
}) => {
  const { language, t, getCategoryLabel } = useLanguage();
  const [isExpanded, setIsExpanded] = useState<boolean>(initialFullPage);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [displayedCard, setDisplayedCard] = useState<WorldCard | null>(card);

  useEffect(() => {
    if (card) {
      setDisplayedCard(card);
    }
  }, [card]);

  useEffect(() => {
    if (isOpen) {
      setIsExpanded(initialFullPage);
      setPreviewImageIndex(null);
    }
  }, [isOpen, initialFullPage, card?.id]);

  const activeCard = card || displayedCard;

  const cardImages: string[] = Array.from(new Set([
    ...(activeCard?.imageUrl ? [activeCard.imageUrl] : []),
    ...(activeCard?.images || []),
  ])).filter(Boolean);

  // Keyboard navigation for image carousel lightbox
  useEffect(() => {
    if (previewImageIndex === null || cardImages.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setPreviewImageIndex((prev) => (prev === null || prev <= 0 ? cardImages.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setPreviewImageIndex((prev) => (prev === null || prev >= cardImages.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') {
        setPreviewImageIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImageIndex, cardImages.length]);

  if (!activeCard) return null;

  const cfg = CATEGORY_CONFIGS[activeCard.category] || CATEGORY_CONFIGS.character;
  const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle || (() => null);

  const assignedDeck = decks.find(
    (d) => d.id === activeCard.deckId || (d.cardIds || []).includes(activeCard.id)
  );

  // Find all connections related to this card
  const relatedConnections = connections.filter(
    (c) => c.sourceId === activeCard.id || c.targetId === activeCard.id
  );

  // Helper for staggered animation classes in fullpage mode (opening and closing)
  const getStaggerClass = (step: number) => {
    if (!isExpanded) return '';
    if (isOpen) {
      if (step === 1) return 'fullpage-animate-stagger-1';
      if (step === 2) return 'fullpage-animate-stagger-2';
      if (step === 3) return 'fullpage-animate-stagger-3';
      return 'fullpage-animate-stagger-4';
    } else {
      if (step === 1) return 'fullpage-animate-stagger-exit-1';
      if (step === 2) return 'fullpage-animate-stagger-exit-2';
      if (step === 3) return 'fullpage-animate-stagger-exit-3';
      return 'fullpage-animate-stagger-exit-4';
    }
  };

  // Format date helper
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const articleContent = (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
      {/* Section 1: Hero / Wiki Intro (Side-by-side Layout) */}
      <div className={`flex flex-col md:flex-row gap-5 items-start justify-between ${getStaggerClass(2)}`}>
        <div className="flex-1 space-y-2.5">
          <h1 className="text-2xl font-extrabold app-text-main leading-tight tracking-tight">
            {activeCard.title || t.common.untitled}
          </h1>

          {activeCard.subtitle && (
            <p className="text-xs font-medium app-text-muted italic">
              {activeCard.subtitle}
            </p>
          )}

          {/* Paragraf Intro / Summary Text (No container box) */}
          {activeCard.summary ? (
            <p className="text-xs app-text-main leading-relaxed">
              {activeCard.summary}
            </p>
          ) : (
            <p className="text-xs app-text-muted italic">
              {t.cardReader.noSummary}
            </p>
          )}
        </div>

        {/* Cover Image / Wiki Infobox Picture */}
        {activeCard.imageUrl && (
          <div
            onClick={() => {
              const idx = cardImages.indexOf(activeCard.imageUrl!);
              setPreviewImageIndex(idx !== -1 ? idx : 0);
            }}
            className="w-full md:w-36 h-48 rounded-xl overflow-hidden border app-border shadow-lg shrink-0 relative bg-slate-900/40 cursor-zoom-in group/img transition-transform hover:scale-[1.02]"
            title={t.cardReader.zoomImage}
          >
            <img
              src={activeCard.imageUrl}
              alt={activeCard.title}
              className="w-full h-full object-cover group-hover/img:brightness-110 transition-all"
              style={{ objectPosition: `${activeCard.imageFocalX ?? 50}% ${activeCard.imageFocalY ?? 20}%` }}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
              <Icons.ZoomIn size={14} />
              <span>{t.cardReader.zoomImage}</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Wiki Infobox Custom Attributes */}
      {activeCard.attributes && activeCard.attributes.length > 0 && (
        <div className={`space-y-2 ${getStaggerClass(3)}`}>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider app-accent-text">
            <Icons.Sliders size={14} />
            <span>{t.cardReader.attributes}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 py-1">
            {activeCard.attributes.map((attr) => (
              <div
                key={attr.id || attr.key}
                className="flex items-center justify-between gap-2 py-1 border-b app-border text-xs"
              >
                <span className="font-semibold app-text-muted truncate">{attr.key}:</span>
                <span className="font-bold app-text-main truncate">{attr.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Catatan & Penjelasan Lengkap (Only rendered if activeCard.content is non-empty) */}
      {activeCard.content && activeCard.content.trim() !== '' && (
        <div className={`space-y-2.5 pt-2 border-t app-border ${getStaggerClass(4)}`}>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider app-accent-text">
            <Icons.BookOpen size={14} />
            <span>{t.cardReader.content}</span>
          </div>

          <div className="text-xs app-text-main leading-relaxed whitespace-pre-wrap font-sans space-y-2 py-1">
            {parseMentions(activeCard.content, allCards).map((seg, idx) =>
              seg.isMention && seg.cardId ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectCard(seg.cardId!)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md app-bg-secondary app-accent-text border app-border font-semibold hover:border-blue-400 cursor-pointer transition-all hover:scale-105"
                >
                  <Icons.FileText size={11} />
                  <span>{seg.text.substring(1)}</span>
                </button>
              ) : (
                <span key={idx}>{seg.text}</span>
              )
            )}
          </div>
        </div>
      )}

      {/* Section 4: Tags */}
      {activeCard.tags && activeCard.tags.length > 0 && (
        <div className={`space-y-2 pt-2 border-t app-border ${getStaggerClass(4)}`}>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider app-accent-text">
            <Icons.Tag size={14} />
            <span>{t.common.tags}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {activeCard.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg app-bg-secondary app-text-muted border app-border text-xs font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Relasi Hubungan (Connections on Canvas) */}
      {relatedConnections.length > 0 && (
        <div className={`space-y-2.5 pt-2 border-t app-border ${getStaggerClass(4)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider app-accent-text">
              <Icons.GitCommit size={14} />
              <span>{t.cardReader.connections} ({relatedConnections.length})</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {relatedConnections.map((conn) => {
              const isSource = conn.sourceId === activeCard.id;
              const otherCardId = isSource ? conn.targetId : conn.sourceId;
              const otherCard = allCards.find((c) => c.id === otherCardId);

              if (!otherCard) return null;
              const otherCfg = CATEGORY_CONFIGS[otherCard.category] || CATEGORY_CONFIGS.character;

              return (
                <div
                  key={conn.id}
                  onClick={() => onSelectCard(otherCard.id)}
                  className="p-2.5 rounded-xl app-bg-secondary border app-border hover:border-blue-400 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded app-bg-main app-accent-text border app-border shrink-0">
                      {conn.label || (isSource ? (language === 'en' ? 'To' : 'Menuju') : (language === 'en' ? 'From' : 'Berasal Dari'))}
                    </span>
                    <span className="text-xs font-bold app-text-main truncate group-hover:text-blue-400 transition-colors">
                      {otherCard.title || t.common.untitled}
                    </span>
                  </div>

                  <div
                    className="text-[10px] px-2 py-0.5 rounded font-medium border shrink-0"
                    style={{
                      borderColor: otherCfg.borderColor,
                      color: otherCfg.color,
                    }}
                  >
                    {getCategoryLabel(otherCard.category)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 6: Galeri Gambar Kartu */}
      {cardImages.length > 0 && (
        <div className={`space-y-3 pt-3 border-t app-border ${getStaggerClass(4)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider app-accent-text">
              <Icons.Image size={14} />
              <span>{t.cardReader.imageGallery} ({cardImages.length})</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {cardImages.map((imgSrc, idx) => {
              const isThumbnail = activeCard.imageUrl === imgSrc;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setPreviewImageIndex(idx);
                  }}
                  className="relative rounded-xl overflow-hidden border app-border hover:border-[#0d99ff] group bg-black/40 aspect-video cursor-pointer transition-all hover:scale-[1.02] shadow-sm"
                >
                  <img
                    src={imgSrc}
                    alt={`Galeri ${idx + 1}`}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: `${activeCard.imageFocalX ?? 50}% ${activeCard.imageFocalY ?? 20}%` }}
                  />
                  {isThumbnail && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#0d99ff] text-white text-[9px] font-bold shadow-xs">
                      Thumbnail
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Icons.Maximize2 size={16} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 7: Metadata & Timestamps */}
      <div className={`pt-4 border-t app-border text-[11px] app-text-muted flex items-center justify-between font-mono ${getStaggerClass(4)}`}>
        <span>{t.common.created}: {formatDate(activeCard.createdAt)}</span>
        <span>{t.common.updated}: {formatDate(activeCard.updatedAt)}</span>
      </div>
    </div>
  );

  const headerBar = (
    <div className={`px-5 py-4 border-b app-border app-bg-secondary flex items-center justify-between gap-3 shrink-0 ${getStaggerClass(1)}`}>
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.bgGradient} ${cfg.borderColor}`}
          style={{ color: cfg.color }}
        >
          <IconComp size={14} />
          <span>{getCategoryLabel(activeCard.category)}</span>
        </div>

        {assignedDeck && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 truncate max-w-[180px]"
            style={{
              borderColor: assignedDeck.color || '#3b82f6',
              color: assignedDeck.color || '#60a5fa',
              backgroundColor: `${assignedDeck.color || '#3b82f6'}15`,
            }}
          >
            <Icons.Folder size={12} />
            <span className="truncate">{assignedDeck.name}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onEditCard(activeCard)}
          className="px-3 py-1.5 rounded-xl app-accent-bg text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Icons.Edit3 size={13} />
          <span>{t.sidebar.editCard}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-xl app-text-muted hover:app-bg-hover hover:app-text-main transition-colors cursor-pointer border app-border"
          title={isExpanded ? (language === 'en' ? 'Minimize to Sidebar' : 'Kecilkan ke Sidebar') : t.library.openFullscreen}
        >
          {isExpanded ? <Icons.Minimize2 size={15} /> : <Icons.Maximize2 size={15} />}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl app-text-muted hover:app-bg-hover hover:app-text-main transition-colors cursor-pointer"
          title={t.common.close}
        >
          <Icons.X size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isExpanded ? (
        <div
          className={`fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 transition-all duration-300 ease-in-out ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        >
          <div
            className={`w-full max-w-4xl h-full max-h-[90vh] app-bg-main border app-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
              isOpen ? 'fullpage-container-expand' : 'fullpage-container-shrink'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {headerBar}
            {articleContent}
          </div>
        </div>
      ) : (
        <>
          {/* Backdrop overlay covering the left side to close sidebar on click */}
          <div
            className={`fixed inset-0 z-[115] bg-black/20 backdrop-blur-[0.5px] transition-opacity duration-300 ease-in-out cursor-pointer ${
              isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={onClose}
          />
          {/* Sidebar Panel with exact CSS transform transition matching left sidebar */}
          <aside
            style={{
              transform: isOpen ? 'translateX(0%)' : 'translateX(100%)',
            }}
            className="sidebar-panel-transition fixed inset-y-0 right-0 z-[120] w-full max-w-lg bg-[#2c2c2c] border-l border-[#383838] shadow-2xl flex flex-col text-white"
          >
            {headerBar}
            {articleContent}
          </aside>
        </>
      )}

      {/* Fullscreen Carousel Lightbox Preview Modal */}
      {previewImageIndex !== null && cardImages.length > 0 && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200 select-none"
          onClick={() => setPreviewImageIndex(null)}
        >
          {/* Top Bar: Counter & Close */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-20">
            <span className="text-xs font-mono font-bold bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
              {previewImageIndex + 1} / {cardImages.length}
            </span>
            <button
              type="button"
              onClick={() => setPreviewImageIndex(null)}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer backdrop-blur-md"
              title="Tutup Preview (Escape)"
            >
              <Icons.X size={20} />
            </button>
          </div>

          {/* Left Arrow (Looping) */}
          {cardImages.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImageIndex((prev) => (prev === null || prev <= 0 ? cardImages.length - 1 : prev - 1));
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white bg-black/60 hover:bg-black/90 border border-white/20 rounded-full transition-all cursor-pointer z-30 hover:scale-110 shadow-2xl"
              title="Gambar Sebelumnya (Panah Kiri)"
            >
              <Icons.ChevronLeft size={24} />
            </button>
          )}

          {/* Main Image */}
          <div
            className="relative max-w-5xl max-h-[85vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={cardImages[previewImageIndex]}
              alt={`Preview ${previewImageIndex + 1}`}
              className="max-w-full max-h-[82vh] object-contain rounded-2xl border border-white/10 shadow-2xl transition-all"
            />
          </div>

          {/* Right Arrow (Looping) */}
          {cardImages.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImageIndex((prev) => (prev === null || prev >= cardImages.length - 1 ? 0 : prev + 1));
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white bg-black/60 hover:bg-black/90 border border-white/20 rounded-full transition-all cursor-pointer z-30 hover:scale-110 shadow-2xl"
              title="Gambar Selanjutnya (Panah Kanan)"
            >
              <Icons.ChevronRight size={24} />
            </button>
          )}
        </div>
      )}
    </>
  );
};

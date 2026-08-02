import React, { useState, useEffect } from 'react';
import type { WorldCard, CardConnection, WorldDeck } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import { parseMentions } from '../utils/helpers';
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
  const [isExpanded, setIsExpanded] = useState<boolean>(initialFullPage);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsExpanded(initialFullPage);
      setPreviewImageUrl(null);
    }
  }, [isOpen, initialFullPage, card?.id]);

  if (!isOpen || !card) return null;

  const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
  const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle || (() => null);

  const assignedDeck = decks.find(
    (d) => d.id === card.deckId || (d.cardIds || []).includes(card.id)
  );

  // Find all connections related to this card
  const relatedConnections = connections.filter(
    (c) => c.sourceId === card.id || c.targetId === card.id
  );

  // Format date helper
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleDateString('id-ID', {
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
      <div className="flex flex-col md:flex-row gap-5 items-start justify-between">
        <div className="flex-1 space-y-2.5">
          <h1 className="text-2xl font-extrabold app-text-main leading-tight tracking-tight">
            {card.title || 'Kartu Tanpa Judul'}
          </h1>

          {card.subtitle && (
            <p className="text-xs font-medium app-text-muted italic">
              {card.subtitle}
            </p>
          )}

          {/* Paragraf Intro / Summary Callout Box */}
          <div className="notion-callout app-bg-secondary p-3.5 rounded-xl border app-border text-xs app-text-main leading-relaxed shadow-xs">
            {card.summary || 'Belum ada ringkasan intro untuk kartu ini...'}
          </div>
        </div>

        {/* Cover Image / Wiki Infobox Picture */}
        {card.imageUrl && (
          <div
            onClick={() => setPreviewImageUrl(card.imageUrl!)}
            className="w-full md:w-36 h-48 rounded-xl overflow-hidden border app-border shadow-lg shrink-0 relative bg-slate-900/40 cursor-zoom-in group/img transition-transform hover:scale-[1.02]"
            title="Klik untuk memperbesar gambar"
          >
            <img
              src={card.imageUrl}
              alt={card.title}
              className="w-full h-full object-cover group-hover/img:brightness-110 transition-all"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
              <Icons.ZoomIn size={14} />
              <span>Perbesar</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Wiki Infobox Custom Attributes */}
      {card.attributes && card.attributes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider app-accent-text">
            <Icons.Sliders size={14} />
            <span>Atribut & Properti Utama</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3.5 app-bg-secondary rounded-xl border app-border shadow-2xs">
            {card.attributes.map((attr) => (
              <div
                key={attr.id || attr.key}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg app-bg-main border app-border text-xs"
              >
                <span className="font-semibold app-text-muted truncate">{attr.key}:</span>
                <span className="font-bold app-text-main truncate">{attr.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Catatan & Penjelasan Lengkap (Full Article Text) */}
      <div className="space-y-2.5 pt-2 border-t app-border">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider app-accent-text">
          <Icons.BookOpen size={14} />
          <span>Catatan Lengkap & Detail Lore</span>
        </div>

        {card.content ? (
          <div className="app-bg-secondary p-4 rounded-xl border app-border text-xs app-text-main leading-relaxed whitespace-pre-wrap font-sans space-y-2">
            {parseMentions(card.content, allCards).map((seg, idx) =>
              seg.isMention && seg.cardId ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectCard(seg.cardId!)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md app-bg-main app-accent-text border app-border font-semibold hover:border-blue-400 cursor-pointer transition-all hover:scale-105"
                >
                  <Icons.FileText size={11} />
                  <span>{seg.text.substring(1)}</span>
                </button>
              ) : (
                <span key={idx}>{seg.text}</span>
              )
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl app-bg-secondary border border-dashed app-border text-xs app-text-muted text-center italic">
            Belum ada catatan detail. Klik "Edit Kartu" di atas untuk menambahkan penjelasan lengkap.
          </div>
        )}
      </div>

      {/* Section 4: Tags */}
      {card.tags && card.tags.length > 0 && (
        <div className="space-y-2 pt-2 border-t app-border">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider app-accent-text">
            <Icons.Tag size={14} />
            <span>Tags</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {card.tags.map((tag, i) => (
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
        <div className="space-y-2.5 pt-2 border-t app-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider app-accent-text">
              <Icons.GitCommit size={14} />
              <span>Relasi & Hubungan ({relatedConnections.length})</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {relatedConnections.map((conn) => {
              const isSource = conn.sourceId === card.id;
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
                      {conn.label || (isSource ? 'Menuju' : 'Berasal Dari')}
                    </span>
                    <span className="text-xs font-bold app-text-main truncate group-hover:text-blue-400 transition-colors">
                      {otherCard.title || 'Kartu Tanpa Judul'}
                    </span>
                  </div>

                  <div
                    className="text-[10px] px-2 py-0.5 rounded font-medium border shrink-0"
                    style={{
                      borderColor: otherCfg.borderColor,
                      color: otherCfg.color,
                    }}
                  >
                    {otherCfg.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 6: Metadata & Timestamps */}
      <div className="pt-4 border-t app-border text-[11px] app-text-muted flex items-center justify-between font-mono">
        <span>Dibuat: {formatDate(card.createdAt)}</span>
        <span>Diperbarui: {formatDate(card.updatedAt)}</span>
      </div>
    </div>
  );

  const headerBar = (
    <div className="px-5 py-4 border-b app-border app-bg-secondary flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.bgGradient} ${cfg.borderColor}`}
          style={{ color: cfg.color }}
        >
          <IconComp size={14} />
          <span>{cfg.label}</span>
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
          onClick={() => onEditCard(card)}
          className="px-3 py-1.5 rounded-xl app-accent-bg text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Icons.Edit3 size={13} />
          <span>Edit Kartu</span>
        </button>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-xl app-text-muted hover:app-bg-hover hover:app-text-main transition-colors cursor-pointer border app-border"
          title={isExpanded ? 'Kecilkan ke Sidebar' : 'Buka Kartu (Layar Penuh)'}
        >
          {isExpanded ? <Icons.Minimize2 size={15} /> : <Icons.Maximize2 size={15} />}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl app-text-muted hover:app-bg-hover hover:app-text-main transition-colors cursor-pointer"
          title="Tutup Panel Reader"
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
          className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in zoom-in-95 duration-200"
          onClick={onClose}
        >
          <div
            className="w-full max-w-4xl h-full max-h-[90vh] app-bg-main border app-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200"
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
            className="fixed inset-0 z-[115] bg-black/20 backdrop-blur-[0.5px] transition-opacity animate-in fade-in duration-200 cursor-pointer"
            onClick={onClose}
          />
          <div className="fixed inset-y-0 right-0 z-[120] w-full max-w-lg app-bg-main border-l app-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {headerBar}
            {articleContent}
          </div>
        </>
      )}

      {/* Image Fullscreen Lightbox Preview Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              title="Tutup Preview Gambar"
            >
              <Icons.X size={20} />
            </button>
            <img
              src={previewImageUrl}
              alt="Preview Full resolution"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-white/10 shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
};

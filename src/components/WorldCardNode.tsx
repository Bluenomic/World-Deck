import React, { useRef } from 'react';
import type { WorldCard } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

interface WorldCardNodeProps {
  card: WorldCard;
  isSelected: boolean;
  isConnectingSource: boolean;
  isDimmed?: boolean;
  isCategoryHighlighted?: boolean;
  zoom?: number;
  onSelect: (card: WorldCard, e: React.MouseEvent | React.TouchEvent) => void;
  onDoubleClick: (card: WorldCard) => void;
  onStartConnection: (cardId: string, e: React.MouseEvent | React.TouchEvent) => void;
  connectionCount: number;
  onMeasureHeight?: (cardId: string, height: number) => void;
  onUpdateDimensions?: (cardId: string, width: number, height: number) => void;
  onUpdateImageHeight?: (cardId: string, imageHeight: number) => void;
  onAdjustImageFocalPointRequest?: (card: WorldCard) => void;
}

export const WorldCardNode: React.FC<WorldCardNodeProps> = ({
  card,
  isSelected,
  isConnectingSource,
  isDimmed = false,
  isCategoryHighlighted = false,
  zoom = 1,
  onSelect,
  onDoubleClick,
  onStartConnection,
  connectionCount,
  onMeasureHeight,
  onUpdateDimensions,
  onUpdateImageHeight,
  onAdjustImageFocalPointRequest,
}) => {
  const { t, getCategoryLabel } = useLanguage();
  const nodeRef = useRef<HTMLDivElement>(null);
  const config = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
  const IconComponent = (Icons as any)[config.iconName] || Icons.HelpCircle || (() => null);

  const width = card.width || 288;
  const height = card.height;

  // Determine Level of Detail (LOD) based on card height & width
  // Compact LOD: height < 140px or width < 240px
  // Detailed LOD: height >= 260px or width >= 340px
  const isCompact = (height && height < 140) || width < 240;
  const isDetailed = (height && height >= 260) || width >= 340;

  // Drag Resize Handler
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startW = width;
    const startH = height || nodeRef.current?.offsetHeight || 180;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;

      const deltaX = (moveX - clientX) / (zoom || 1);
      const deltaY = (moveY - clientY) / (zoom || 1);

      const newWidth = Math.round(Math.max(220, Math.min(650, startW + deltaX)));
      const newHeight = Math.round(Math.max(110, Math.min(800, startH + deltaY)));

      onUpdateDimensions?.(card.id, newWidth, newHeight);
    };

    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);
  };

  // Drag Resize Handler for Cover Image Height
  const handleImageResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const defaultImgH = isDetailed ? 144 : 96;
    const startImgH = card.imageHeight || defaultImgH;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
      const deltaY = (moveY - clientY) / (zoom || 1);

      const newImageHeight = Math.round(Math.max(48, Math.min(500, startImgH + deltaY)));
      onUpdateImageHeight?.(card.id, newImageHeight);
    };

    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);
  };

  return (
    <div
      data-card-id={card.id}
      ref={(el) => {
        (nodeRef as any).current = el;
        if (el) {
          onMeasureHeight?.(card.id, el.offsetHeight);
        }
      }}
      style={{
        transform: `translate(${card.x}px, ${card.y}px)`,
        width: `${width}px`,
        height: height ? `${height}px` : undefined,
      }}
      className={`absolute rounded-xl bg-[#2c2c2c] border transition-[border-color,box-shadow,opacity] cursor-grab active:cursor-grabbing group select-none flex flex-col overflow-visible ${
        isDimmed ? 'opacity-20 pointer-events-none grayscale-[40%]' : 'opacity-100 pointer-events-auto'
      } ${
        isSelected
          ? 'border-[#0d99ff] ring-2 ring-[#0d99ff]/60 shadow-2xl z-30'
          : isConnectingSource
          ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-xl z-30'
          : isCategoryHighlighted
          ? 'border-[#0d99ff]/80 ring-2 ring-[#0d99ff]/30 shadow-md z-20'
          : 'border-[#383838] hover:border-[#0d99ff]/60 z-10'
      }`}
      onMouseDown={(e) => !isDimmed && onSelect(card, e)}
      onTouchStart={(e) => !isDimmed && onSelect(card, e)}
      onDoubleClick={() => !isDimmed && onDoubleClick(card)}
    >
      {/* Cover Image Preview (Hidden in compact view) */}
      {!isCompact && (
        card.imageUrl ? (
          <div
            style={{ height: card.imageHeight ? `${card.imageHeight}px` : undefined }}
            className={`w-full overflow-hidden relative rounded-t-xl shrink-0 group/img ${
              !card.imageHeight ? (isDetailed ? 'h-36' : 'h-24') : ''
            }`}
          >
            <img
              src={card.imageUrl}
              alt={card.title}
              className="w-full h-full object-cover opacity-90 group-hover/img:opacity-100 transition-opacity pointer-events-none select-none"
              style={{ objectPosition: `${card.imageFocalX ?? 50}% ${card.imageFocalY ?? 20}%` }}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              loading="lazy"
            />

            {/* Quick Focal Point Adjustment Button */}
            {onAdjustImageFocalPointRequest && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjustImageFocalPointRequest(card);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white hover:text-[#0d99ff] hover:bg-black/90 opacity-0 group-hover/img:opacity-100 transition-all z-20 cursor-pointer shadow-md"
                title="Atur Fokus Gambar"
              >
                <Icons.Focus size={13} />
              </button>
            )}

            {/* Image Height Drag Resize Handle */}
            {onUpdateImageHeight && (
              <div
                className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity cursor-ns-resize flex items-center justify-center z-20 group/imghandle"
                onMouseDown={handleImageResizeStart}
                onTouchStart={handleImageResizeStart}
              >
                <div className="w-12 h-1 rounded-full bg-white/70 group-hover/imghandle:bg-[#0d99ff] group-hover/imghandle:scale-x-125 transition-all shadow-md" />
              </div>
            )}
          </div>
        ) : (
          <div className="h-2 w-full rounded-t-xl shrink-0" style={{ backgroundColor: config.color, opacity: 0.8 }} />
        )
      )}

      {/* Card Content Body */}
      <div className="p-3 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
        
        {/* Category Pill & Connection Badge */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${config.bgGradient} ${config.borderColor}`}
            style={{ color: config.color }}
          >
            <IconComponent size={12} />
            <span>{getCategoryLabel(card.category)}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md app-bg-main app-text-muted border app-border font-mono">
            <Icons.GitCommit size={11} className="app-text-muted" />
            <span>{connectionCount}</span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-0.5">
          <h3 className={`text-sm font-bold leading-snug line-clamp-1 transition-colors ${
            card.title ? 'app-text-main group-hover:text-blue-400' : 'app-text-muted opacity-60'
          }`}>
            {card.title || t.common.untitled}
          </h3>
          {card.subtitle && !isCompact && (
            <p className="text-[11px] app-text-muted line-clamp-1 italic">
              {card.subtitle}
            </p>
          )}
        </div>

        {/* Summary Description */}
        <p className={`text-[11px] leading-relaxed ${isCompact ? 'line-clamp-1' : isDetailed ? 'line-clamp-4' : 'line-clamp-2'} ${
          card.summary ? 'app-text-muted' : 'app-text-muted opacity-50'
        }`}>
          {card.summary || t.cardReader.noSummary}
        </p>

        {/* Extended Details for Large / Expanded Card Size */}
        {isDetailed && (
          <>
            {/* Custom Attributes Table */}
            {card.attributes && card.attributes.length > 0 && (
              <div className="pt-2 border-t app-border space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider app-accent-text block">
                  {t.cardReader.attributes}
                </span>
                <div className="grid grid-cols-1 gap-1">
                  {card.attributes.map((attr) => (
                    <div key={attr.id || attr.key} className="flex items-center justify-between text-[11px] app-bg-main px-2 py-1 rounded border app-border">
                      <span className="font-semibold app-text-muted truncate">{attr.key}:</span>
                      <span className="font-bold app-text-main truncate">{attr.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full Written Lore / Content Preview */}
            {card.content && (
              <div className="pt-2 border-t app-border space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider app-accent-text block">
                  {t.categories.lore}
                </span>
                <div className="text-[11px] app-bg-main p-2 rounded border app-border app-text-main leading-relaxed whitespace-pre-wrap font-sans max-h-40 overflow-y-auto custom-scrollbar">
                  {card.content}
                </div>
              </div>
            )}
          </>
        )}

        {/* Property Rows for Standard View */}
        {!isDetailed && card.attributes && card.attributes.length > 0 && (
          <div className="pt-1.5 border-t app-border space-y-1">
            {card.attributes.slice(0, 2).map((attr) => (
              <div key={attr.id || attr.key} className="flex items-center justify-between text-[10px] app-text-muted">
                <span className="truncate max-w-[100px] opacity-70">{attr.key}:</span>
                <span className="truncate max-w-[130px] font-medium app-text-main app-bg-main px-1.5 py-0.2 rounded border app-border">
                  {attr.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        {card.tags && card.tags.length > 0 && !isCompact && (
          <div className="pt-1 flex flex-wrap gap-1">
            {card.tags.slice(0, isDetailed ? 6 : 3).map((tag, idx) => (
              <span
                key={idx}
                className="text-[10px] px-1.5 py-0.5 rounded app-bg-main app-text-muted border app-border"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom-Right Drag Resize Handle */}
      {onUpdateDimensions && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-end p-1 text-slate-400 hover:text-blue-400 z-40 group-hover:opacity-100 opacity-40 transition-opacity"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
        >
          <Icons.GripVertical size={13} className="rotate-45" />
        </div>
      )}

      {/* 4 Directional Connection Handles */}
      {/* Right */}
      <button
        type="button"
        className="connection-handle-trigger right-0 top-1/2 -translate-y-1/2 translate-x-1/2"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnection(card.id, e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onStartConnection(card.id, e);
        }}
      >
        <div className="connection-handle-visual">
          <Icons.Plus size={13} strokeWidth={3} />
        </div>
      </button>

      {/* Left */}
      <button
        type="button"
        className="connection-handle-trigger left-0 top-1/2 -translate-y-1/2 -translate-x-1/2"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnection(card.id, e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onStartConnection(card.id, e);
        }}
      >
        <div className="connection-handle-visual">
          <Icons.Plus size={13} strokeWidth={3} />
        </div>
      </button>

      {/* Top */}
      <button
        type="button"
        className="connection-handle-trigger left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnection(card.id, e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onStartConnection(card.id, e);
        }}
      >
        <div className="connection-handle-visual">
          <Icons.Plus size={13} strokeWidth={3} />
        </div>
      </button>

      {/* Bottom */}
      <button
        type="button"
        className="connection-handle-trigger left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnection(card.id, e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onStartConnection(card.id, e);
        }}
      >
        <div className="connection-handle-visual">
          <Icons.Plus size={13} strokeWidth={3} />
        </div>
      </button>
    </div>
  );
};

import React from 'react';
import type { WorldCard } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import * as Icons from 'lucide-react';

interface WorldCardNodeProps {
  card: WorldCard;
  isSelected: boolean;
  isConnectingSource: boolean;
  isDimmed?: boolean;
  isCategoryHighlighted?: boolean;
  onSelect: (card: WorldCard, e: React.MouseEvent | React.TouchEvent) => void;
  onDoubleClick: (card: WorldCard) => void;
  onStartConnection: (cardId: string, e: React.MouseEvent | React.TouchEvent) => void;
  connectionCount: number;
}

export const WorldCardNode: React.FC<WorldCardNodeProps> = ({
  card,
  isSelected,
  isConnectingSource,
  isDimmed = false,
  isCategoryHighlighted = false,
  onSelect,
  onDoubleClick,
  onStartConnection,
  connectionCount,
}) => {
  const config = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
  const IconComponent = (Icons as any)[config.iconName] || Icons.HelpCircle || (() => null);

  return (
    <div
      data-card-id={card.id}
      style={{
        transform: `translate(${card.x}px, ${card.y}px)`,
      }}
      className={`absolute w-72 rounded-xl app-bg-secondary border transition-all cursor-grab active:cursor-grabbing group select-none ${
        isDimmed ? 'opacity-20 pointer-events-none grayscale-[40%]' : 'opacity-100 pointer-events-auto'
      } ${
        isSelected
          ? 'border-purple-500 ring-2 ring-purple-500/40 shadow-xl z-30 scale-[1.02]'
          : isConnectingSource
          ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-xl z-30'
          : isCategoryHighlighted
          ? 'border-purple-400 ring-2 ring-purple-400/40 shadow-lg z-20 scale-[1.01]'
          : 'app-border hover:border-purple-400 z-10'
      }`}
      onMouseDown={(e) => !isDimmed && onSelect(card, e)}
      onTouchStart={(e) => !isDimmed && onSelect(card, e)}
      onDoubleClick={() => !isDimmed && onDoubleClick(card)}
    >
      {/* Cover Image Preview */}
      {card.imageUrl ? (
        <div className="h-28 w-full overflow-hidden relative rounded-t-xl">
          <img
            src={card.imageUrl}
            alt={card.title}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none select-none"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      ) : (
        <div className="h-2.5 w-full rounded-t-xl" style={{ backgroundColor: config.color, opacity: 0.8 }} />
      )}

      {/* Card Content Body */}
      <div className="p-3.5 space-y-2">
        
        {/* Category Pill & Connection Badge */}
        <div className="flex items-center justify-between gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${config.bgGradient} ${config.borderColor}`}
            style={{ color: config.color }}
          >
            <IconComponent size={12} />
            <span>{config.label}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md app-bg-main app-text-muted border app-border font-mono">
            <Icons.GitCommit size={11} className="app-text-muted" />
            <span>{connectionCount}</span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-0.5">
          <h3 className={`text-sm font-bold leading-snug line-clamp-1 transition-colors ${
            card.title ? 'app-text-main group-hover:text-purple-400' : 'app-text-muted opacity-60'
          }`}>
            {card.title || 'Tanpa Judul'}
          </h3>
          {card.subtitle ? (
            <p className="text-[11px] app-text-muted line-clamp-1">
              {card.subtitle}
            </p>
          ) : null}
        </div>

        {/* Summary Description */}
        <p className={`text-[11px] line-clamp-2 leading-relaxed ${
          card.summary ? 'app-text-muted' : 'app-text-muted opacity-50'
        }`}>
          {card.summary || 'Belum ada ringkasan.'}
        </p>

        {/* Property Rows */}
        {card.attributes && card.attributes.length > 0 && (
          <div className="pt-1.5 border-t app-border space-y-1">
            {card.attributes.slice(0, 2).map((attr) => (
              <div key={attr.id} className="flex items-center justify-between text-[10px] app-text-muted">
                <span className="truncate max-w-[100px] opacity-70">{attr.key}:</span>
                <span className="truncate max-w-[130px] font-medium app-text-main app-bg-main px-1.5 py-0.2 rounded border app-border">
                  {attr.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div className="pt-1 flex flex-wrap gap-1">
            {card.tags.slice(0, 3).map((tag, idx) => (
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

      {/* 4 Directional Connection Handles */}
      {/* Right */}
      <button
        type="button"
        title="Tarik koneksi (Kanan)"
        className="connection-handle-trigger -right-5 top-1/2 -translate-y-1/2"
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
        title="Tarik koneksi (Kiri)"
        className="connection-handle-trigger -left-5 top-1/2 -translate-y-1/2"
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
        title="Tarik koneksi (Atas)"
        className="connection-handle-trigger left-1/2 -top-5 -translate-x-1/2"
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
        title="Tarik koneksi (Bawah)"
        className="connection-handle-trigger left-1/2 -bottom-5 -translate-x-1/2"
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

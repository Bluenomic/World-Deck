import React, { useState, useRef } from 'react';
import type { WorldCard } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

interface ImageFocalAdjusterModalProps {
  card: WorldCard;
  onSave: (cardId: string, focalX: number, focalY: number) => void;
  onClose: () => void;
}

export const ImageFocalAdjusterModal: React.FC<ImageFocalAdjusterModalProps> = ({
  card,
  onSave,
  onClose,
}) => {
  const { language, t } = useLanguage();
  const imageUrl = card.imageUrl || (card.images && card.images[0]);
  
  // Focal point percentages (0 - 100)
  const [focalX, setFocalX] = useState<number>(card.imageFocalX ?? 50);
  const [focalY, setFocalY] = useState<number>(card.imageFocalY ?? 20);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPosRef = useRef<{ x: number; y: number; startFocalX: number; startFocalY: number }>({
    x: 0,
    y: 0,
    startFocalX: 50,
    startFocalY: 20,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    setIsDragging(true);

    dragStartPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      startFocalX: focalX,
      startFocalY: focalY,
    };

    const container = containerRef.current;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current || !container) return;
      const rect = container.getBoundingClientRect();

      const deltaX = moveEvent.clientX - dragStartPosRef.current.x;
      const deltaY = moveEvent.clientY - dragStartPosRef.current.y;

      // Smooth 1:1 Mouse Panning Physics:
      // Multiplier factor (0.22) prevents hyper-sensitivity and matches 1:1 physical mouse distance
      const sensitivity = 0.22;
      const deltaFocalX = (deltaX / rect.width) * 100 * sensitivity;
      const deltaFocalY = (deltaY / rect.height) * 100 * sensitivity;

      const newFocalX = Math.max(0, Math.min(100, Math.round(dragStartPosRef.current.startFocalX - deltaFocalX)));
      const newFocalY = Math.max(0, Math.min(100, Math.round(dragStartPosRef.current.startFocalY - deltaFocalY)));

      setFocalX(newFocalX);
      setFocalY(newFocalY);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleSave = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onSave(card.id, focalX, focalY);
    onClose();
  };

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-[#1e1e1e] border border-[#383838] rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col space-y-4 p-6 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#383838] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#0d99ff]/20 text-[#0d99ff]">
              <Icons.Focus size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Adjust Cover</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-[#383838] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Live Card Banner Drag Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold px-1">
            <span>{language === 'en' ? 'Card Cover Preview:' : 'Pratinjau Foto Sampul:'}</span>
            <span className="font-mono text-[11px] text-slate-400">
              {focalX}% X, {focalY}% Y
            </span>
          </div>

          {/* Enlarge height vertically (h-72 = 288px) for spacious vertical view & smooth 1:1 mouse panning */}
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            className={`h-72 w-full relative overflow-hidden rounded-2xl border-2 transition-all shadow-inner bg-black ${
              isDragging
                ? 'border-[#0d99ff] cursor-grabbing'
                : 'border-[#383838] hover:border-[#0d99ff]/70 cursor-grab'
            }`}
          >
            <img
              src={imageUrl}
              alt={card.title}
              className="w-full h-full object-cover pointer-events-none select-none transition-all duration-75"
              style={{ objectPosition: `${focalX}% ${focalY}%` }}
              draggable={false}
            />

            {/* Subtle Hint Overlay */}
            <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md text-xs text-white font-bold flex items-center gap-1.5 border border-white/10 pointer-events-none shadow-md">
              <Icons.Move size={14} className="text-[#0d99ff]" />
              <span>
                {language === 'en'
                  ? 'Drag image to adjust cover view'
                  : 'Geser gambar untuk mengatur tampilan sampul'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-[#383838] gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            {t.common.cancel}
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <Icons.Check size={14} />
            <span>{language === 'en' ? 'Save Position' : 'Simpan Posisi'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

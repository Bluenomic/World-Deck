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
    isDraggingRef.current = true;

    dragStartPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      startFocalX: focalX,
      startFocalY: focalY,
    };

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    // Directly set focal point based on click position relative to container
    const newX = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const newY = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));

    setFocalX(newX);
    setFocalY(newY);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current || !container) return;
      const currentRect = container.getBoundingClientRect();

      const moveX = Math.max(0, Math.min(100, Math.round(((moveEvent.clientX - currentRect.left) / currentRect.width) * 100)));
      const moveY = Math.max(0, Math.min(100, Math.round(((moveEvent.clientY - currentRect.top) / currentRect.height) * 100)));

      setFocalX(moveX);
      setFocalY(moveY);
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleResetToFace = () => {
    setFocalX(50);
    setFocalY(20);
  };

  const handleSave = () => {
    onSave(card.id, focalX, focalY);
    onClose();
  };

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-[#1e1e1e] border border-[#383838] rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col space-y-4 p-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#383838] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#0d99ff]/20 text-[#0d99ff]">
              <Icons.Focus size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                {language === 'en' ? 'Adjust Image Focus' : 'Atur Fokus Gambar'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === 'en'
                  ? 'Drag or click anywhere on the image to position key subject focus (such as face)'
                  : 'Tarik atau klik pada area gambar untuk menentukan posisi fokus (seperti wajah)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[#383838] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Live Card Banner Drag Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold px-1">
            <span>{language === 'en' ? 'Card Banner Preview:' : 'Pratinjau Banner Kartu:'}</span>
            <span className="font-mono text-[11px] text-slate-400">
              {language === 'en' ? 'Focus:' : 'Posisi Fokus:'} {focalX}% X, {focalY}% Y
            </span>
          </div>

          {/* Interactive Drag Banner Container */}
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            className="h-44 w-full relative overflow-hidden rounded-2xl border-2 border-dashed border-[#0d99ff]/70 hover:border-[#0d99ff] cursor-crosshair bg-black group transition-all shadow-inner"
          >
            <img
              src={imageUrl}
              alt={card.title}
              className="w-full h-full object-cover pointer-events-none select-none"
              style={{ objectPosition: `${focalX}% ${focalY}%` }}
              draggable={false}
            />

            {/* Target Reticle Overlay Indicator */}
            <div
              className="absolute w-8 h-8 -ml-4 -mt-4 pointer-events-none flex items-center justify-center transition-all duration-75"
              style={{ left: `${focalX}%`, top: `${focalY}%` }}
            >
              <div className="w-8 h-8 rounded-full border-2 border-white bg-[#0d99ff]/40 shadow-[0_0_12px_rgba(13,153,255,0.8)] animate-pulse flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            </div>

            {/* Hint Overlay */}
            <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] text-white font-bold flex items-center gap-1.5 border border-white/10 pointer-events-none">
              <Icons.Move size={12} className="text-[#0d99ff]" />
              <span>
                {language === 'en'
                  ? 'Drag or click anywhere to move focus'
                  : 'Geser atau klik di mana saja untuk memindahkan fokus'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#383838]">
          <button
            type="button"
            onClick={handleResetToFace}
            className="px-3 py-1.5 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Icons.RotateCcw size={13} />
            <span>
              {language === 'en'
                ? 'Reset (Face Focus 50% / 20%)'
                : 'Reset (Fokus Wajah 50% / 20%)'}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              {t.common.cancel}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Icons.Check size={14} />
              <span>{language === 'en' ? 'Save Position' : 'Simpan Posisi'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

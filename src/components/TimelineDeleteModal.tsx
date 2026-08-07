import React, { useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

export type DeleteTargetType = 'node' | 'track' | 'branch' | 'clear_all';

export interface TimelineDeleteTarget {
  type: DeleteTargetType;
  id?: string;
  title: string;
  subtitle?: string;
  itemCount?: number;
}

interface TimelineDeleteModalProps {
  isOpen: boolean;
  target: TimelineDeleteTarget | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const TimelineDeleteModal: React.FC<TimelineDeleteModalProps> = ({
  isOpen,
  target,
  onClose,
  onConfirm,
}) => {
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen || !target) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, target, onClose, onConfirm]);

  if (!isOpen || !target) return null;

  const getHeaderInfo = () => {
    switch (target.type) {
      case 'node':
        return {
          icon: <Icons.Trash2 size={20} className="text-rose-400" />,
          badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          title: t.timeline.deleteNodeTitle,
          desc: t.timeline.deleteNodeDesc,
          confirmText: t.timeline.deleteEvent,
        };
      case 'branch':
        return {
          icon: <Icons.GitBranch size={20} className="text-cyan-400" />,
          badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
          title: t.timeline.deleteBranchTitle,
          desc: t.timeline.deleteBranchDesc,
          confirmText: t.timeline.deleteTimeBranch,
        };
      case 'track':
        return {
          icon: <Icons.AlertTriangle size={20} className="text-amber-400" />,
          badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          title: t.timeline.deleteTrackTitle,
          desc: t.timeline.deleteTrackDesc,
          confirmText: t.timeline.deleteTimeline,
        };
      case 'clear_all':
        return {
          icon: <Icons.AlertOctagon size={20} className="text-rose-500" />,
          badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          title: t.timeline.clearAllTitle,
          desc: t.timeline.clearAllDesc,
          confirmText: t.canvas.clearCanvas,
        };
    }
  };

  const info = getHeaderInfo();

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md app-bg-secondary border app-border rounded-2xl p-5 shadow-2xl app-text-main modal-animate-appear cursor-default space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b app-border pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${info.badgeClass}`}>
              {info.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold app-text-main leading-snug">{info.title}</h3>
              <p className="text-[11px] app-text-muted mt-0.5">{info.desc}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg app-text-muted hover:app-text-main hover:app-bg-hover transition-colors"
          >
            <Icons.X size={16} />
          </button>
        </div>

        {/* Item Content Preview */}
        <div className="p-3.5 rounded-xl app-bg-main border app-border space-y-1">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider app-text-muted">
            {target.subtitle || t.timeline.deletionTarget}
          </div>
          <div className="text-sm font-bold app-text-main truncate">
            {target.title}
          </div>
          {target.itemCount !== undefined && (
            <div className="text-[11px] app-text-muted">
              {t.timeline.totalEventsAffected} <span className="font-bold app-text-main">{target.itemCount}</span>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="pt-2 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl app-bg-main app-text-main border app-border font-semibold hover:app-bg-hover transition-colors cursor-pointer"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-lg hover:shadow-rose-600/30 cursor-pointer flex items-center gap-1.5"
          >
            <Icons.Trash2 size={14} />
            <span>{info.confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

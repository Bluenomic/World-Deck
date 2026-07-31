import React from 'react';
import type { WorldCard, CardConnection } from '../types';
import * as Icons from 'lucide-react';

interface TimelineViewProps {
  cards: WorldCard[];
  connections: CardConnection[];
  onCardClick: (card: WorldCard) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  cards,
  connections,
  onCardClick,
}) => {
  const timelineCards = cards
    .filter((c) => c.category === 'timeline' || c.tags.includes('peristiwa') || c.tags.includes('sejarah'))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex-1 app-bg-main p-6 overflow-y-auto app-text-main transition-colors">
      <div className="max-w-4xl mx-auto space-y-5">
        
        {/* Header */}
        <div className="border-b app-border pb-3">
          <h2 className="text-lg font-bold app-text-main flex items-center gap-2">
            <Icons.Clock className="text-rose-400" size={20} />
            <span>Notion Timeline View</span>
          </h2>
          <p className="text-xs app-text-muted">
            Urutan peristiwa sejarah dan kronologi alur cerita dunia.
          </p>
        </div>

        {timelineCards.length === 0 ? (
          <div className="text-center py-16 app-bg-secondary rounded-xl border app-border app-text-muted text-xs">
            Belum ada peristiwa timeline. Buat kartu dengan kategori "Peristiwa Timeline".
          </div>
        ) : (
          <div className="relative border-l app-border ml-4 md:ml-6 pl-6 md:pl-8 space-y-6 py-2">
            {timelineCards.map((card) => {
              const relatedConns = connections.filter(
                (c) => c.sourceId === card.id || c.targetId === card.id
              );

              const yearAttr = card.attributes?.find((a) =>
                a.key.toLowerCase().includes('tahun') || a.key.toLowerCase().includes('waktu')
              );

              return (
                <div key={card.id} className="relative group">
                  <div className="absolute -left-[31px] md:-left-[39px] top-2 w-4 h-4 rounded-full bg-rose-500 border-2 border-slate-900 shadow" />

                  <div
                    onClick={() => onCardClick(card)}
                    className="app-bg-secondary border app-border hover:border-rose-400 p-4 rounded-xl shadow-sm transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60 text-[11px] font-mono font-medium">
                        {yearAttr ? yearAttr.value : 'Peristiwa Utama'}
                      </span>
                      <span className="text-[10px] app-text-muted font-mono">
                        {relatedConns.length} Terlibat
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold app-text-main group-hover:text-rose-400 transition-colors">
                        {card.title}
                      </h3>
                      {card.subtitle && (
                        <p className="text-xs app-text-muted mt-0.5">{card.subtitle}</p>
                      )}
                    </div>

                    <p className="text-xs app-text-main opacity-90 leading-relaxed">
                      {card.summary}
                    </p>

                    {relatedConns.length > 0 && (
                      <div className="pt-2 border-t app-border flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] uppercase font-bold app-text-muted">
                          Terkait:
                        </span>
                        {relatedConns.map((conn) => {
                          const otherId = conn.sourceId === card.id ? conn.targetId : conn.sourceId;
                          const otherCard = cards.find((c) => c.id === otherId);
                          if (!otherCard) return null;

                          return (
                            <span
                              key={conn.id}
                              className="text-[10px] px-1.5 py-0.5 rounded app-bg-main border app-border app-text-main"
                            >
                              📄 {otherCard.title} ({conn.label})
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

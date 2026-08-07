import React from 'react';
import type { WorldCard, CardConnection } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

interface RelationListViewProps {
  connections: CardConnection[];
  cards: WorldCard[];
  onEditConnection: (conn: CardConnection) => void;
  onDeleteConnection: (id: string) => void;
  onNavigateToCard: (cardId: string) => void;
}

export const RelationListView: React.FC<RelationListViewProps> = ({
  connections,
  cards,
  onEditConnection,
  onDeleteConnection,
  onNavigateToCard,
}) => {
  const { language, t, getCategoryLabel } = useLanguage();

  return (
    <div className="flex-1 app-bg-main p-6 overflow-y-auto app-text-main transition-colors">
      <div className="max-w-5xl mx-auto space-y-5">
        
        {/* Header */}
        <div className="border-b app-border pb-3">
          <h2 className="text-lg font-bold app-text-main flex items-center gap-2">
            <Icons.GitCommit className="app-accent-text" size={20} />
            <span>{language === 'en' ? 'Card Relationship Table View' : 'Tabel Relasi Hubungan Kartu'}</span>
          </h2>
          <p className="text-xs app-text-muted">
            {language === 'en'
              ? 'Database table listing spatial connections between card pages.'
              : 'Daftar tabel database hubungan spasial antar halaman kartu.'}
          </p>
        </div>

        {connections.length === 0 ? (
          <div className="text-center py-16 app-bg-secondary rounded-xl border app-border app-text-muted text-xs">
            {language === 'en'
              ? 'No card connections yet. Drag connecting lines between cards on the Canvas.'
              : 'Belum ada hubungan kartu. Tarik garis penghubung antar kartu pada Canvas.'}
          </div>
        ) : (
          <div className="app-bg-secondary border app-border rounded-xl overflow-hidden shadow-md">
            <table className="w-full text-left text-xs app-text-main">
              <thead className="app-bg-main app-text-muted uppercase font-mono text-[10px] border-b app-border">
                <tr>
                  <th className="p-3">{language === 'en' ? 'Source Card' : 'Halaman Asal (Source)'}</th>
                  <th className="p-3">{language === 'en' ? 'Relationship Label' : 'Label Hubungan'}</th>
                  <th className="p-3">{language === 'en' ? 'Target Card' : 'Halaman Tujuan (Target)'}</th>
                  <th className="p-3 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y app-border">
                {connections.map((conn) => {
                  const sourceCard = cards.find((c) => c.id === conn.sourceId);
                  const targetCard = cards.find((c) => c.id === conn.targetId);

                  if (!sourceCard || !targetCard) return null;

                  return (
                    <tr key={conn.id} className="app-bg-hover transition-colors">
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => onNavigateToCard(sourceCard.id)}
                          className="font-medium app-text-main hover:app-accent-text transition-colors flex items-center gap-1.5 text-left"
                        >
                          <Icons.FileText size={13} className="app-text-muted" />
                          <span>{sourceCard.title || t.common.untitled}</span>
                          <span className="text-[10px] app-text-muted">
                            ({getCategoryLabel(sourceCard.category)})
                          </span>
                        </button>
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded app-bg-main app-accent-text font-semibold border app-border text-[11px]">
                          {conn.label}
                        </span>
                      </td>

                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => onNavigateToCard(targetCard.id)}
                          className="font-medium app-text-main hover:app-accent-text transition-colors flex items-center gap-1.5 text-left"
                        >
                          <Icons.FileText size={13} className="app-text-muted" />
                          <span>{targetCard.title || t.common.untitled}</span>
                          <span className="text-[10px] app-text-muted">
                            ({getCategoryLabel(targetCard.category)})
                          </span>
                        </button>
                      </td>

                      <td className="p-3 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => onEditConnection(conn)}
                          className="px-2.5 py-1 rounded app-bg-main app-text-main border app-border text-[11px]"
                        >
                          {t.common.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteConnection(conn.id)}
                          className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900 text-rose-300 border border-rose-900/40 text-[11px]"
                        >
                          {t.common.delete}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

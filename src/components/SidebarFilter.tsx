import React, { useState, useRef } from 'react';
import type { WorldCard, CardCategory, WorldCanvas } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import { loadWorkspacePreferences, saveWorkspacePreferences } from '../utils/storage';
import * as Icons from 'lucide-react';

interface SidebarFilterProps {
  cards: WorldCard[];
  selectedCategory: CardCategory | 'all';
  onCategorySelect: (cat: CardCategory | 'all') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCardId: string | null;
  onCardClick: (card: WorldCard) => void;
  isOpen: boolean;
  onToggle: () => void;
  
  // Canvases Props
  canvases: WorldCanvas[];
  activeCanvasId: string;
  onCanvasSelect: (id: string) => void;
  onCreateCanvasRequest: () => void;
  onCanvasRenameRequest: (id: string, name: string) => void;
  onCanvasDelete: (id: string) => void;
}

export const SidebarFilter: React.FC<SidebarFilterProps> = ({
  cards,
  selectedCategory,
  onCategorySelect,
  searchQuery,
  onSearchChange,
  selectedCardId,
  onCardClick,
  isOpen,
  onToggle,
  canvases,
  activeCanvasId,
  onCanvasSelect,
  onCreateCanvasRequest,
  onCanvasRenameRequest,
  onCanvasDelete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Resizable Panel Heights in percentage & Sidebar Width in px from preferences
  const [categoriesHeight, setCategoriesHeight] = useState<number>(() => loadWorkspacePreferences().categoriesHeight);
  const [canvasesHeight, setCanvasesHeight] = useState<number>(() => loadWorkspacePreferences().canvasesHeight);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => loadWorkspacePreferences().sidebarWidth);

  const filteredCards = cards.filter((card) => {
    const matchesCategory =
      selectedCategory === 'all' || card.category === selectedCategory;
    const matchesSearch =
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleMouseDownResize = (divider: 'first' | 'second') => (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startCatHeight = categoriesHeight;
    const startCanHeight = canvasesHeight;
    const containerHeight = containerRef.current?.getBoundingClientRect().height || 500;

    let currentCat = startCatHeight;
    let currentCan = startCanHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaPercent = (deltaY / containerHeight) * 100;

      if (divider === 'first') {
        const newCatHeight = Math.max(15, Math.min(50, startCatHeight + deltaPercent));
        currentCat = newCatHeight;
        setCategoriesHeight(newCatHeight);
      } else {
        const newCanHeight = Math.max(15, Math.min(50, startCanHeight + deltaPercent));
        if (startCatHeight + newCanHeight < 80) {
          currentCan = newCanHeight;
          setCanvasesHeight(newCanHeight);
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      saveWorkspacePreferences({
        categoriesHeight: currentCat,
        canvasesHeight: currentCan,
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDownWidthResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let currentWidth = startWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(220, Math.min(500, startWidth + deltaX));
      currentWidth = newWidth;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      saveWorkspacePreferences({ sidebarWidth: currentWidth });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        type="button"
        onClick={onToggle}
        className="md:hidden fixed top-16 left-3 z-40 p-2 rounded-lg app-bg-secondary border app-border app-text-main shadow-lg cursor-pointer"
      >
        <Icons.Menu size={18} />
      </button>

      {/* Sidebar Panel */}
      <aside
        style={{
          width: typeof window !== 'undefined' && window.innerWidth < 768 ? undefined : `${sidebarWidth}px`,
        }}
        className={`sidebar-panel-transition transform absolute top-0 left-0 h-full app-bg-secondary border-r app-border flex flex-col z-30 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full shadow-none'
        }`}
      >
        {/* Right Edge Resizer Handle for Sidebar Width */}
        <div
          onMouseDown={handleMouseDownWidthResize}
          className="hidden md:block absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-[var(--accent)]/40 transition-colors z-40 group -mr-1"
          title="Drag untuk mengubah lebar Sidebar"
        >
          <div className="w-[2px] h-full bg-transparent group-hover:bg-[var(--accent)] mx-auto" />
        </div>

        {/* Sidebar Header / Search */}
        <div className="p-3 border-b app-border space-y-2.5 shrink-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider app-text-muted">
              Workspace Navigation
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.2 rounded app-bg-main app-text-muted font-mono border app-border">
                {filteredCards.length}
              </span>
              <button
                type="button"
                onClick={onToggle}
                className="p-1 rounded hover:app-bg-hover app-text-muted hover:app-text-main transition-colors cursor-pointer"
                title="Sembunyikan Sidebar (Ctrl + \)"
              >
                <Icons.PanelLeftClose size={14} />
              </button>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="relative">
            <Icons.Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 app-text-muted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari kartu, #tag, lore..."
              className="w-full app-bg-main border app-border rounded-lg pl-8 pr-12 py-1.5 text-xs app-text-main placeholder-slate-500 focus:outline-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono app-text-muted px-1 app-bg-secondary rounded border app-border">
              Ctrl K
            </span>
          </div>
        </div>

        {/* Resizable Panels Container */}
        <div ref={containerRef} className="flex-1 flex flex-col min-h-0 select-none">
          
          {/* Categories Section */}
          <div 
            style={{ height: `${categoriesHeight}%` }} 
            className="flex flex-col min-h-[60px] overflow-hidden border-b app-border"
          >
            <div className="p-2 flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
              <span className="text-[10px] uppercase font-bold app-text-muted px-2 block my-1">
                Kategori
              </span>

              <button
                type="button"
                onClick={() => onCategorySelect('all')}
                className={`w-full px-2.5 py-1.5 rounded-md text-xs text-left flex items-center justify-between transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'app-bg-main app-text-main font-semibold border app-border'
                    : 'app-text-muted hover:app-text-main app-bg-hover'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icons.Layers size={13} className="app-text-muted" />
                  <span>Semua Kategori</span>
                </div>
                <span className="text-[10px] font-mono app-text-muted">{cards.length}</span>
              </button>

              {(Object.keys(CATEGORY_CONFIGS) as CardCategory[]).map((cat) => {
                const cfg = CATEGORY_CONFIGS[cat];
                const IconComp = (Icons as any)[cfg.iconName] || Icons.HelpCircle;
                const count = cards.filter((c) => c.category === cat).length;
                const isSelected = selectedCategory === cat;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onCategorySelect(cat)}
                    className={`w-full px-2.5 py-1.5 rounded-md text-xs text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'app-bg-main app-text-main font-semibold border app-border'
                        : 'app-text-muted hover:app-text-main app-bg-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <IconComp size={13} style={{ color: cfg.color }} />
                      <span>{cfg.label}</span>
                    </div>
                    <span className="text-[10px] font-mono app-text-muted">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider 1 */}
          <div 
            onMouseDown={handleMouseDownResize('first')}
            className="h-[5px] min-h-[5px] w-full app-bg-secondary hover:bg-[var(--accent)] cursor-ns-resize transition-all flex items-center justify-center group relative z-10"
            title="Seret untuk mengubah ukuran panel"
          >
            <div className="w-8 h-[1px] app-border group-hover:bg-[var(--accent)] opacity-50" />
          </div>

          {/* Canvases Section */}
          <div 
            style={{ height: `${canvasesHeight}%` }} 
            className="flex flex-col min-h-[60px] overflow-hidden border-b app-border"
          >
            <div className="p-2 flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
              <div className="flex items-center justify-between px-2 my-1">
                <span className="text-[10px] uppercase font-bold app-text-muted">
                  Kanvas
                </span>
                <button
                  type="button"
                  onClick={onCreateCanvasRequest}
                  className="p-1 rounded hover:app-bg-hover text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  title="Tambah Kanvas Baru"
                >
                  <Icons.Plus size={12} strokeWidth={2.5} />
                </button>
              </div>

              {canvases.map((c) => {
                const isActive = activeCanvasId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`group w-full px-2.5 py-1 rounded-md text-xs flex items-center justify-between transition-colors ${
                      isActive
                        ? 'app-bg-main app-text-main font-semibold border app-border'
                        : 'app-text-muted hover:app-text-main app-bg-hover'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onCanvasSelect(c.id)}
                      className="flex-1 text-left truncate py-0.5 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Icons.Layout size={13} className="shrink-0 app-text-muted" />
                      <span className="truncate">{c.name}</span>
                    </button>

                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onCanvasRenameRequest(c.id, c.name)}
                        className="p-0.5 rounded hover:app-bg-main app-text-muted hover:app-text-main transition-colors cursor-pointer"
                        title="Ubah Nama"
                      >
                        <Icons.Edit2 size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCanvasDelete(c.id)}
                        disabled={canvases.length <= 1}
                        className={`p-0.5 rounded hover:app-bg-main transition-colors cursor-pointer ${
                          canvases.length <= 1 ? 'opacity-30 cursor-not-allowed text-slate-600' : 'text-rose-500 hover:text-rose-400'
                        }`}
                        title="Hapus Kanvas"
                      >
                        <Icons.Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divider 2 */}
          <div 
            onMouseDown={handleMouseDownResize('second')}
            className="h-[5px] min-h-[5px] w-full app-bg-secondary hover:bg-[var(--accent)] cursor-ns-resize transition-all flex items-center justify-center group relative z-10"
            title="Seret untuk mengubah ukuran panel"
          >
            <div className="w-8 h-[1px] app-border group-hover:bg-[var(--accent)] opacity-50" />
          </div>

          {/* Cards Section */}
          <div 
            style={{ height: `${100 - categoriesHeight - canvasesHeight}%` }} 
            className="flex flex-col min-h-[60px] overflow-hidden"
          >
            <div className="p-2 flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
              <span className="text-[10px] uppercase font-bold app-text-muted px-2 block my-1">
                Halaman Kartu (Fokus)
              </span>

              {filteredCards.length === 0 ? (
                <div className="text-center py-6 app-text-muted text-xs select-none">
                  Belum ada kartu.
                </div>
              ) : (
                filteredCards.map((card) => {
                  const isSelected = selectedCardId === card.id;
                  const cfg = CATEGORY_CONFIGS[card.category];

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onCardClick(card)}
                      className={`w-full px-2.5 py-1.5 rounded-md text-left transition-colors flex items-center gap-2 text-xs cursor-pointer ${
                        isSelected
                          ? 'app-bg-main app-text-main font-semibold border-l-2 border-blue-500'
                          : 'app-text-muted hover:app-text-main app-bg-hover'
                      }`}
                    >
                      <Icons.FileText size={13} className="shrink-0 app-text-muted" />
                      <span className="truncate flex-1">{card.title}</span>
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: cfg.color }}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </aside>
    </>
  );
};

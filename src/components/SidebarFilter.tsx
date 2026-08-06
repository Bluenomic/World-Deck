import React, { useState, useRef, useEffect } from 'react';
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
  onDuplicateCanvas?: (id: string) => void;

  // Card Context Menu Actions
  onRemoveCardFromCanvas?: (cardId: string) => void;
  onDeleteCardRequest?: (cardId: string) => void;
  onEditCardRequest?: (card: WorldCard) => void;
  onFocusCardOnCanvas?: (card: WorldCard) => void;
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
  onDuplicateCanvas,
  onRemoveCardFromCanvas,
  onDeleteCardRequest,
  onEditCardRequest,
  onFocusCardOnCanvas,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Resizable Panel Heights in percentage & Sidebar Width in px from preferences
  const [categoriesHeight, setCategoriesHeight] = useState<number>(() => loadWorkspacePreferences().categoriesHeight);
  const [canvasesHeight, setCanvasesHeight] = useState<number>(() => loadWorkspacePreferences().canvasesHeight);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => loadWorkspacePreferences().sidebarWidth);

  // Sidebar Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetCanvasId?: string | null;
    targetCanvasName?: string | null;
    targetCard?: WorldCard | null;
    isNearBottom?: boolean;
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetCanvasId: null,
    targetCanvasName: null,
    targetCard: null,
    isNearBottom: false,
  });

  // Auto-close context menu on window scroll/wheel
  useEffect(() => {
    const handleCloseMenu = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('wheel', handleCloseMenu, { passive: true });
    window.addEventListener('scroll', handleCloseMenu, { passive: true });
    window.addEventListener('click', handleCloseMenu);
    return () => {
      window.removeEventListener('wheel', handleCloseMenu);
      window.removeEventListener('scroll', handleCloseMenu);
      window.removeEventListener('click', handleCloseMenu);
    };
  }, [contextMenu.visible]);

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

  const handleCanvasContextMenu = (e: React.MouseEvent, canvasId: string, canvasName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isNearBottom = e.clientY > window.innerHeight - 180;
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetCanvasId: canvasId,
      targetCanvasName: canvasName,
      targetCard: null,
      isNearBottom,
    });
  };

  const handleCardContextMenu = (e: React.MouseEvent, card: WorldCard) => {
    e.preventDefault();
    e.stopPropagation();
    const isNearBottom = e.clientY > window.innerHeight - 200;
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetCanvasId: null,
      targetCanvasName: null,
      targetCard: card,
      isNearBottom,
    });
  };

  const handleEmptyCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isNearBottom = e.clientY > window.innerHeight - 120;
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetCanvasId: null,
      targetCanvasName: null,
      targetCard: null,
      isNearBottom,
    });
  };

  return (
    <>
      {/* Toggle Floating Button when Closed */}
      {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          className="fixed top-14 left-3 z-30 p-2 rounded-xl bg-[#1e1e1e] border border-[#383838] text-slate-300 hover:text-white shadow-xl hover:scale-105 transition-all cursor-pointer"
          title="Buka Sidebar Navigasi"
        >
          <Icons.PanelLeftOpen size={16} />
        </button>
      )}

      {/* Main Sidebar Drawer Panel */}
      <aside
        style={{ width: isOpen ? `${sidebarWidth}px` : '0px' }}
        className={`h-full app-bg-secondary border-r app-border flex flex-col transition-all duration-200 ease-in-out relative z-20 shrink-0 select-none overflow-hidden ${
          !isOpen ? 'border-none' : ''
        }`}
      >
        {/* Resize Handle (Right Border) */}
        {isOpen && (
          <div
            onMouseDown={handleMouseDownWidthResize}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[var(--accent)] transition-colors z-30 group flex items-center justify-center"
            title="Seret untuk mengubah lebar sidebar"
          >
            <div className="w-[1px] h-8 app-border group-hover:bg-[var(--accent)]" />
          </div>
        )}

        {/* Sidebar Header Strip */}
        <div className="p-3 border-b app-border flex items-center justify-between app-bg-main shrink-0">
          <div className="flex items-center gap-2">
            <Icons.Layers size={16} className="text-[#0d99ff]" />
            <span className="text-xs font-bold app-text-main tracking-tight">Navigasi Kanvas</span>
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded-lg app-text-muted hover:app-text-main hover:app-bg-hover transition-colors cursor-pointer"
            title="Tutup Sidebar"
          >
            <Icons.PanelLeftClose size={15} />
          </button>
        </div>

        {/* Search Filter Input */}
        <div className="p-2.5 border-b app-border app-bg-main shrink-0">
          <div className="relative">
            <Icons.Search size={13} className="absolute left-2.5 top-2.5 app-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari kartu / tag di kanvas..."
              className="w-full pl-8 pr-7 py-1.5 text-xs app-bg-secondary border app-border rounded-lg app-text-main placeholder:app-text-muted focus:outline-none focus:border-[#0d99ff]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-2 app-text-muted hover:app-text-main cursor-pointer"
              >
                <Icons.X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Resizable 3-Section Container */}
        <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Categories Section */}
          <div 
            style={{ height: `${categoriesHeight}%` }} 
            className="flex flex-col min-h-[60px] overflow-hidden border-b app-border"
          >
            <div className="p-2 flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
              <span className="text-[10px] uppercase font-bold app-text-muted px-2 block my-1">
                Kategori Kartu
              </span>

              <button
                type="button"
                onClick={() => onCategorySelect('all')}
                className={`w-full px-2.5 py-1.5 rounded-md text-left transition-colors flex items-center justify-between text-xs cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'app-bg-main app-text-main font-semibold border-l-2 border-blue-500'
                    : 'app-text-muted hover:app-text-main app-bg-hover'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icons.Folder size={13} />
                  <span>Semua Kategori</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded app-bg-main border app-border">
                  {cards.length}
                </span>
              </button>

              {Object.entries(CATEGORY_CONFIGS).map(([key, cfg]) => {
                const count = cards.filter((c) => c.category === key).length;
                const isSelected = selectedCategory === key;
                const CategoryIcon = (Icons as any)[cfg.iconName] || Icons.HelpCircle;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onCategorySelect(key as CardCategory)}
                    className={`w-full px-2.5 py-1.5 rounded-md text-left transition-colors flex items-center justify-between text-xs cursor-pointer ${
                      isSelected
                        ? 'app-bg-main app-text-main font-semibold border-l-2 border-blue-500'
                        : 'app-text-muted hover:app-text-main app-bg-hover'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <CategoryIcon size={14} style={{ color: cfg.color }} className="shrink-0" />
                      <span className="truncate">{cfg.label}</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded app-bg-main border app-border">
                      {count}
                    </span>
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
            onContextMenu={handleEmptyCanvasContextMenu}
          >
            <div className="p-2 flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
              <div className="flex items-center justify-between px-2 my-1">
                <span className="text-[10px] uppercase font-bold app-text-muted">
                  Kanvas ({canvases.length})
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
                    onContextMenu={(e) => handleCanvasContextMenu(e, c.id, c.name)}
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
                      <Icons.Layout size={13} className={`shrink-0 ${isActive ? 'text-[#0d99ff]' : 'app-text-muted'}`} />
                      <span className="truncate">{c.name}</span>
                    </button>

                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onCanvasRenameRequest(c.id, c.name)}
                        className="p-0.5 rounded hover:app-bg-main app-text-muted hover:app-text-main transition-colors cursor-pointer"
                        title="Ubah Nama Kanvas"
                      >
                        <Icons.Edit2 size={11} />
                      </button>
                      {onDuplicateCanvas && (
                        <button
                          type="button"
                          onClick={() => onDuplicateCanvas(c.id)}
                          className="p-0.5 rounded hover:app-bg-main text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                          title="Duplikat Kanvas"
                        >
                          <Icons.Copy size={11} />
                        </button>
                      )}
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
                Kartu Di Kanvas ({filteredCards.length})
              </span>

              {filteredCards.length === 0 ? (
                <div className="text-center py-6 app-text-muted text-xs select-none">
                  Belum ada kartu di kanvas ini.
                </div>
              ) : (
                filteredCards.map((card) => {
                  const isSelected = selectedCardId === card.id;
                  const cfg = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
                  const CardCategoryIcon = (Icons as any)[cfg.iconName] || Icons.HelpCircle;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onCardClick(card)}
                      onContextMenu={(e) => handleCardContextMenu(e, card)}
                      className={`w-full px-2.5 py-1.5 rounded-md text-left transition-colors flex items-center gap-2 text-xs cursor-pointer ${
                        isSelected
                          ? 'app-bg-main app-text-main font-semibold border-l-2 border-blue-500'
                          : 'app-text-muted hover:app-text-main app-bg-hover'
                      }`}
                    >
                      <CardCategoryIcon size={13} style={{ color: cfg.color }} className="shrink-0" />
                      <span className="truncate flex-1">{card.title || 'Kartu Tanpa Judul'}</span>
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

      {/* Sidebar Context Menu Popup */}
      {contextMenu.visible && (
        <div
          className="fixed bg-[#1e1e1e] border border-[#383838] rounded-xl shadow-2xl py-1.5 w-56 z-[200] text-xs text-white animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#383838]"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            transform: `translate(0, ${contextMenu.isNearBottom ? '-100%' : '0'})`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.targetCanvasId ? (
            /* CANVAS ITEM CONTEXT MENU */
            <>
              <div className="px-3 py-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none truncate">
                🗺️ {contextMenu.targetCanvasName || 'Kanvas'}
              </div>

              <div className="py-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onCanvasSelect(contextMenu.targetCanvasId!);
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors font-bold text-[#0d99ff] cursor-pointer"
                >
                  <Icons.Layout size={14} />
                  <span>Buka / Alihkan Kanvas</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCanvasRenameRequest(contextMenu.targetCanvasId!, contextMenu.targetCanvasName || '');
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors font-semibold text-slate-200 cursor-pointer"
                >
                  <Icons.Edit2 size={14} />
                  <span>Ubah Nama Kanvas</span>
                </button>

                {onDuplicateCanvas && (
                  <button
                    type="button"
                    onClick={() => {
                      onDuplicateCanvas(contextMenu.targetCanvasId!);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors font-semibold text-emerald-400 cursor-pointer"
                  >
                    <Icons.Copy size={14} />
                    <span>Duplikat Kanvas Board</span>
                  </button>
                )}
              </div>

              {canvases.length > 1 && (
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onCanvasDelete(contextMenu.targetCanvasId!);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors text-rose-400 font-medium cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>Hapus Kanvas</span>
                  </button>
                </div>
              )}
            </>
          ) : contextMenu.targetCard ? (
            /* CARD ITEM CONTEXT MENU */
            <>
              <div className="px-3 py-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider select-none truncate">
                📄 {contextMenu.targetCard.title || 'Kartu Tanpa Judul'}
              </div>

              <div className="py-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onCardClick(contextMenu.targetCard!);
                    if (onFocusCardOnCanvas) {
                      onFocusCardOnCanvas(contextMenu.targetCard!);
                    }
                    setContextMenu((prev) => ({ ...prev, visible: false }));
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors font-bold text-[#0d99ff] cursor-pointer"
                >
                  <Icons.Focus size={14} />
                  <span>Fokus Ke Kartu Di Canvas</span>
                </button>

                {onEditCardRequest && (
                  <button
                    type="button"
                    onClick={() => {
                      onEditCardRequest(contextMenu.targetCard!);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors font-semibold text-slate-200 cursor-pointer"
                  >
                    <Icons.Edit3 size={14} />
                    <span>Edit Kartu</span>
                  </button>
                )}
              </div>

              <div className="py-1 space-y-0.5">
                {onRemoveCardFromCanvas && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveCardFromCanvas(contextMenu.targetCard!.id);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors text-amber-400 font-medium cursor-pointer"
                  >
                    <Icons.MinusCircle size={14} />
                    <span>Lepas dari Kanvas Ini</span>
                  </button>
                )}

                {onDeleteCardRequest && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteCardRequest(contextMenu.targetCard!.id);
                      setContextMenu((prev) => ({ ...prev, visible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors text-rose-400 font-medium cursor-pointer"
                  >
                    <Icons.Trash2 size={14} />
                    <span>Hapus Kartu Permanen</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* EMPTY CANVAS PANEL CONTEXT MENU */
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  onCreateCanvasRequest();
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full px-3 py-2 text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors font-semibold text-emerald-400 cursor-pointer"
              >
                <Icons.Plus size={14} strokeWidth={2.5} />
                <span>+ Buat Kanvas Baru</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

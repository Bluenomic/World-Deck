import React, { useState, useEffect } from 'react';
import type { WorldProject, WorldCard, CardConnection, ViewMode, CardCategory, AppTheme } from './types';
import { SAMPLE_WORLD } from './data/sampleWorld';
import { generateId, downloadProjectJson } from './utils/helpers';
import { saveAppState, loadAppState } from './utils/storage';
import {
  connectLocalFileOnDisk,
  openLocalFileFromDisk,
  writeToLocalFileHandle,
} from './utils/localFileStorage';
import { Navbar } from './components/Navbar';
import { SidebarFilter } from './components/SidebarFilter';
import { Canvas } from './components/Canvas';
import { LibraryView } from './components/LibraryView';
import { TimelineView } from './components/TimelineView';
import { RelationListView } from './components/RelationListView';
import { CardEditorModal } from './components/CardEditorModal';
import { ConnectionModal } from './components/ConnectionModal';
import { HelpGuideModal } from './components/HelpGuideModal';
import { WorldManagerModal } from './components/WorldManagerModal';
import { DeleteCardModal } from './components/DeleteCardModal';
import confetti from 'canvas-confetti';

const STORAGE_THEME_KEY = 'worldarchive_theme_v1';

export const App: React.FC = () => {
  // Theme State
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY) || localStorage.getItem('worldweaver_theme_v1');
      if (saved) return saved as AppTheme;
    } catch (e) {}
    return 'notion-dark';
  });

  useEffect(() => {
    document.body.className = `theme-${currentTheme}`;
    try {
      localStorage.setItem(STORAGE_THEME_KEY, currentTheme);
    } catch (e) {}
  }, [currentTheme]);

  // Storage Loading Flag
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Native Local Disk File System Handle State
  const [localFileHandle, setLocalFileHandle] = useState<any>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);

  // Worlds & Active World State
  const [worlds, setWorlds] = useState<WorldProject[]>([SAMPLE_WORLD]);
  const [activeWorldId, setActiveWorldId] = useState<string>(SAMPLE_WORLD.id);

  // Async Load State on Startup from IndexedDB & LocalStorage
  useEffect(() => {
    loadAppState().then((savedState) => {
      if (savedState && savedState.worlds && savedState.worlds.length > 0) {
        setWorlds(savedState.worlds);
        setActiveWorldId(savedState.activeWorldId);
      }
      setIsLoaded(true);
    });
  }, []);

  // Derived Active World
  const activeWorld = worlds.find((w) => w.id === activeWorldId) || worlds[0] || SAMPLE_WORLD;

  // Auto save Worlds to IndexedDB & LocalStorage
  useEffect(() => {
    if (!isLoaded) return;
    saveAppState(worlds, activeWorldId);
  }, [worlds, activeWorldId, isLoaded]);

  // Auto save directly to linked physical Disk File on Hard Drive (.json)
  useEffect(() => {
    if (!isLoaded || !localFileHandle) return;
    writeToLocalFileHandle(localFileHandle, activeWorld);
  }, [activeWorld, localFileHandle, isLoaded]);

  // Disk File System Action Handlers
  const handleConnectLocalFile = async () => {
    try {
      const result = await connectLocalFileOnDisk(activeWorld);
      if (result) {
        setLocalFileHandle(result.fileHandle);
        setLocalFileName(result.fileName);
        confetti({ particleCount: 80, spread: 60 });
        alert(`Berhasil terhubung ke berkas disk fisik: ${result.fileName}\n\nProyek ini tersimpan ke hard drive Anda.`);
      }
    } catch (err) {
      alert('Gagal menghubungkan berkas disk lokal.');
    }
  };

  const handleOpenLocalFile = async () => {
    try {
      const result = await openLocalFileFromDisk();
      if (result) {
        const imported = result.project;
        setWorlds((prev) => {
          const exists = prev.some((w) => w.id === imported.id);
          if (exists) {
            return prev.map((w) => (w.id === imported.id ? imported : w));
          }
          return [...prev, imported];
        });
        setActiveWorldId(imported.id);
        setLocalFileHandle(result.fileHandle);
        setLocalFileName(result.fileName);
        confetti({ particleCount: 100, spread: 70 });
        alert(`Berhasil membuka berkas disk fisik: ${result.fileName}`);
      }
    } catch (err) {
      alert('Gagal membaca berkas disk lokal.');
    }
  };

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [editingCard, setEditingCard] = useState<WorldCard | null>(null);
  const [editingConnection, setEditingConnection] = useState<CardConnection | null>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showWorldManager, setShowWorldManager] = useState<boolean>(false);
  const [cardsToDelete, setCardsToDelete] = useState<WorldCard[] | null>(null);

  // Undo & Redo History State
  const [historyStack, setHistoryStack] = useState<WorldProject[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Helper to update active world in worlds array with history recording
  const updateActiveWorld = (updater: (prevWorld: WorldProject) => WorldProject) => {
    setWorlds((prevWorlds) => {
      const currentActive = prevWorlds.find((w) => w.id === activeWorldId);
      if (currentActive) {
        setHistoryStack((prevStack) => {
          const sliced = prevStack.slice(0, historyIndex + 1);
          if (sliced.length >= 50) sliced.shift();
          return [...sliced, currentActive];
        });
        setHistoryIndex((prevIdx) => Math.min(49, prevIdx + 1));
      }
      return prevWorlds.map((w) => (w.id === activeWorldId ? updater(w) : w));
    });
  };

  const handleUndo = () => {
    if (historyIndex >= 0 && historyStack[historyIndex]) {
      const targetState = historyStack[historyIndex];
      const currentActive = worlds.find((w) => w.id === activeWorldId);

      if (currentActive && historyIndex === historyStack.length - 1) {
        setHistoryStack((prev) => [...prev, currentActive]);
      }

      setWorlds((prevWorlds) =>
        prevWorlds.map((w) => (w.id === activeWorldId ? targetState : w))
      );
      setHistoryIndex((prev) => prev - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIndex = historyIndex + 1;
      const targetState = historyStack[nextIndex];
      if (targetState) {
        setWorlds((prevWorlds) =>
          prevWorlds.map((w) => (w.id === activeWorldId ? targetState : w))
        );
        setHistoryIndex(nextIndex);
      }
    }
  };

  // Global Keyboard Shortcuts for Undo (Ctrl+Z) & Redo (Ctrl+Y / Ctrl+Shift+Z) and Toggle Sidebar (Ctrl+\ / Ctrl+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA'].includes(tag)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '\\' || e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, historyStack, activeWorldId]);

  // Card Position Updates
  const handleUpdateCardPosition = (id: string, x: number, y: number) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => (c.id === id ? { ...c, x, y } : c)),
    }));
  };

  // Add New Blank Card
  const handleAddCardAtPosition = (x: number = 300, y: number = 300) => {
    const newCard: WorldCard = {
      id: generateId('card'),
      title: '',
      subtitle: '',
      category: selectedCategory === 'all' ? 'character' : selectedCategory,
      summary: '',
      content: '',
      tags: [],
      attributes: [],
      x,
      y,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: [...prev.cards, newCard],
    }));

    setEditingCard(newCard);
  };

  // Save Card from Editor
  const handleSaveCard = (updatedCard: WorldCard) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => (c.id === updatedCard.id ? updatedCard : c)),
    }));
    setEditingCard(null);
  };

  // Request Delete Cards (Triggers custom DeleteCardModal)
  const handleRequestDeleteCards = (cardIds: string[]) => {
    const matched = activeWorld.cards.filter((c) => cardIds.includes(c.id));
    if (matched.length > 0) {
      setCardsToDelete(matched);
    }
  };

  // Confirm Delete Cards Execution
  const handleConfirmDeleteCards = () => {
    if (!cardsToDelete || cardsToDelete.length === 0) return;
    const deleteIds = cardsToDelete.map((c) => c.id);

    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.filter((c) => !deleteIds.includes(c.id)),
      connections: prev.connections.filter(
        (conn) => !deleteIds.includes(conn.sourceId) && !deleteIds.includes(conn.targetId)
      ),
    }));

    if (selectedCardId && deleteIds.includes(selectedCardId)) {
      setSelectedCardId(null);
    }
    if (editingCard && deleteIds.includes(editingCard.id)) {
      setEditingCard(null);
    }
    setCardsToDelete(null);
  };

  // Delete Single Card via editor
  const handleDeleteCard = (cardId: string) => {
    handleRequestDeleteCards([cardId]);
  };

  // Discard Card Instantly without double confirmation (for newly created blank cards)
  const handleDiscardCard = (cardId: string) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.filter((c) => c.id !== cardId),
      connections: prev.connections.filter(
        (conn) => conn.sourceId !== cardId && conn.targetId !== cardId
      ),
    }));
    if (selectedCardId === cardId) {
      setSelectedCardId(null);
    }
    setEditingCard(null);
  };

  // Add Connection between 2 cards
  const handleAddConnection = (sourceId: string, targetId: string, label: string = 'Terhubung') => {
    const existing = activeWorld.connections.find(
      (c) => (c.sourceId === sourceId && c.targetId === targetId) || (c.sourceId === targetId && c.targetId === sourceId)
    );
    if (existing) {
      alert('Dua kartu ini sudah saling terhubung!');
      return;
    }

    const newConn: CardConnection = {
      id: generateId('conn'),
      sourceId,
      targetId,
      label,
    };

    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      connections: [...prev.connections, newConn],
    }));
  };

  // Save Connection
  const handleSaveConnection = (updatedConnection: CardConnection) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      connections: prev.connections.map((c) =>
        c.id === updatedConnection.id ? updatedConnection : c
      ),
    }));
    setEditingConnection(null);
  };

  // Delete Connection
  const handleDeleteConnection = (connId: string) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      connections: prev.connections.filter((c) => c.id !== connId),
    }));
    if (editingConnection?.id === connId) setEditingConnection(null);
  };

  // World Manager Actions
  const handleCreateWorld = (newWorld: WorldProject) => {
    setWorlds((prev) => [...prev, newWorld]);
    setActiveWorldId(newWorld.id);
    confetti({ particleCount: 70, spread: 60 });
  };

  const handleDeleteWorld = (worldId: string) => {
    if (worlds.length <= 1) {
      alert('Anda harus memiliki setidaknya satu dunia.');
      return;
    }
    if (window.confirm('Hapus dunia ini secara permanen dari daftar dunia Anda?')) {
      const remaining = worlds.filter((w) => w.id !== worldId);
      setWorlds(remaining);
      if (activeWorldId === worldId) {
        setActiveWorldId(remaining[0].id);
      }
    }
  };

  const handleDuplicateWorld = (worldId: string) => {
    const target = worlds.find((w) => w.id === worldId);
    if (!target) return;

    const duplicated: WorldProject = {
      ...target,
      id: generateId('world'),
      name: `${target.name} (Salinan)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setWorlds((prev) => [...prev, duplicated]);
    confetti({ particleCount: 50, spread: 50 });
  };

  const handleUpdateWorldInfo = (worldId: string, name: string, description: string, author: string) => {
    setWorlds((prev) =>
      prev.map((w) =>
        w.id === worldId
          ? { ...w, name, description, author, updatedAt: Date.now() }
          : w
      )
    );
  };

  // Export JSON
  const handleExport = () => {
    downloadProjectJson(activeWorld);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.1 } });
  };

  // Import JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData && Array.isArray(importedData.cards)) {
          const newWorld: WorldProject = {
            ...importedData,
            id: generateId('world'),
            name: importedData.name || 'Dunia Impor',
            updatedAt: Date.now(),
          };
          setWorlds((prev) => [...prev, newWorld]);
          setActiveWorldId(newWorld.id);
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.2 } });
          alert(`Berhasil mengimpor dunia: ${newWorld.name}`);
        } else {
          alert('Format berkas JSON tidak valid.');
        }
      } catch (err) {
        alert('Gagal membaca berkas JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Reset active world
  const handleResetWorld = () => {
    if (window.confirm('Bersihkan semua kartu pada dunia ini dan mulai canvas kosong?')) {
      updateActiveWorld((prev) => ({
        ...prev,
        cards: [],
        connections: [],
        updatedAt: Date.now(),
      }));
      confetti({ particleCount: 80, spread: 60 });
    }
  };

  // Navigate to Card
  const handleNavigateToCard = (cardId: string) => {
    setSelectedCardId(cardId);
    if (viewMode !== 'canvas') setViewMode('canvas');
  };

  return (
    <div className="h-screen w-screen flex flex-col app-bg-main app-text-main overflow-hidden font-sans">
      
      {/* Top Navbar */}
      <Navbar
        projectName={activeWorld.name}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        onAddCard={() => handleAddCardAtPosition(400, 300)}
        onExport={handleExport}
        onImport={handleImport}
        onResetWorld={handleResetWorld}
        onOpenHelp={() => setShowHelpModal(true)}
        onOpenWorldManager={() => setShowWorldManager(true)}
        totalCards={activeWorld.cards.length}
        totalConnections={activeWorld.connections.length}
        localFileName={localFileName}
        onConnectLocalFile={handleConnectLocalFile}
        onOpenLocalFile={handleOpenLocalFile}
        canUndo={historyIndex >= 0}
        canRedo={historyIndex < historyStack.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={viewMode === 'canvas' ? () => setIsSidebarOpen(!isSidebarOpen) : undefined}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Sidebar Filter (Visible in Canvas view) */}
        {viewMode === 'canvas' && (
          <SidebarFilter
            cards={activeWorld.cards}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCardId={selectedCardId}
            onCardClick={(card) => {
              setSelectedCardId(card.id);
            }}
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        )}

        {/* View Component Switcher */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {viewMode === 'canvas' && (
            <Canvas
              cards={activeWorld.cards.filter(
                (c) =>
                  c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  c.summary.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              selectedCategory={selectedCategory}
              connections={activeWorld.connections}
              selectedCardId={selectedCardId}
              onSelectCard={(card) => setSelectedCardId(card ? card.id : null)}
              onDoubleClickCard={(card) => setEditingCard(card)}
              onUpdateCardPosition={handleUpdateCardPosition}
              onAddConnection={(src, tgt) => handleAddConnection(src, tgt, 'Terhubung')}
              onEditConnection={(conn) => setEditingConnection(conn)}
              onAddCardAtPosition={handleAddCardAtPosition}
              onDeleteCardsRequest={handleRequestDeleteCards}
            />
          )}

          {viewMode === 'library' && (
            <LibraryView
              cards={activeWorld.cards}
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
              onCardClick={(card) => setEditingCard(card)}
              onAddCard={() => handleAddCardAtPosition()}
            />
          )}

          {viewMode === 'timeline' && (
            <TimelineView
              cards={activeWorld.cards}
              connections={activeWorld.connections}
              onCardClick={(card) => setEditingCard(card)}
            />
          )}

          {viewMode === 'relations' && (
            <RelationListView
              connections={activeWorld.connections}
              cards={activeWorld.cards}
              onEditConnection={(conn) => setEditingConnection(conn)}
              onDeleteConnection={handleDeleteConnection}
              onNavigateToCard={handleNavigateToCard}
            />
          )}
        </main>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {cardsToDelete && (
        <DeleteCardModal
          isOpen={!!cardsToDelete}
          cardsToDelete={cardsToDelete}
          onClose={() => setCardsToDelete(null)}
          onConfirm={handleConfirmDeleteCards}
        />
      )}

      {/* World Manager Modal (Main Menu Dashboard) */}
      {showWorldManager && (
        <WorldManagerModal
          worlds={worlds}
          activeWorldId={activeWorldId}
          onSelectWorld={(id) => setActiveWorldId(id)}
          onCreateWorld={handleCreateWorld}
          onDeleteWorld={handleDeleteWorld}
          onDuplicateWorld={handleDuplicateWorld}
          onUpdateWorldInfo={handleUpdateWorldInfo}
          onClose={() => setShowWorldManager(false)}
          onImportWorld={handleImport}
        />
      )}

      {/* Card Editor Modal */}
      {editingCard && (
        <CardEditorModal
          card={editingCard}
          allCards={activeWorld.cards}
          connections={activeWorld.connections}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onClose={() => setEditingCard(null)}
          onNavigateToCard={handleNavigateToCard}
          onAddConnection={handleAddConnection}
          onDiscard={handleDiscardCard}
        />
      )}

      {/* Connection Editor Modal */}
      {editingConnection && (
        <ConnectionModal
          connection={editingConnection}
          sourceCard={
            activeWorld.cards.find((c) => c.id === editingConnection.sourceId) ||
            activeWorld.cards[0]
          }
          targetCard={
            activeWorld.cards.find((c) => c.id === editingConnection.targetId) ||
            activeWorld.cards[0]
          }
          onSave={handleSaveConnection}
          onDelete={handleDeleteConnection}
          onClose={() => setEditingConnection(null)}
        />
      )}

      {/* Help & Packaging Guide Modal */}
      {showHelpModal && <HelpGuideModal onClose={() => setShowHelpModal(false)} />}
    </div>
  );
};

export default App;

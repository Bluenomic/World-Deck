import React, { useState, useEffect } from 'react';
import type { WorldProject, WorldCard, WorldDeck, CardConnection, ViewMode, CardCategory, AppTheme } from './types';
import { SAMPLE_WORLD } from './data/sampleWorld';
import { generateId, downloadProjectJson } from './utils/helpers';
import { saveLocalFileHandle, loadLocalFileHandle, loadWorkspacePreferences, saveWorkspacePreferences } from './utils/storage';
import * as Icons from 'lucide-react';
import {
  readAllProjectsFromDirectory,
  writeProjectToDirectory,
  deleteProjectFromDirectory,
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
import { CanvasModal } from './components/CanvasModal';
import { DeckModal } from './components/DeckModal';
import { CardReaderSidebar } from './components/CardReaderSidebar';


const STORAGE_THEME_KEY = 'worlddeck_theme_v1';

export const App: React.FC = () => {
  // Theme State
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return 'dark';
  });

  useEffect(() => {
    document.body.className = `theme-${currentTheme}`;
    try {
      localStorage.setItem(STORAGE_THEME_KEY, currentTheme);
    } catch (e) {}
  }, [currentTheme]);

  // Storage Loading Flag
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Native Local Disk Folder Workspace State
  const [localDirectoryHandle, setLocalDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [localDirectoryName, setLocalDirectoryName] = useState<string | null>(null);
  const [needDirectoryPermission, setNeedDirectoryPermission] = useState<boolean>(false);

  // Worlds & Active World State
  const [worlds, setWorlds] = useState<WorldProject[]>([SAMPLE_WORLD]);
  const [activeWorldId, setActiveWorldId] = useState<string>(SAMPLE_WORLD.id);

  // UI State initialized from workspace preferences
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadWorkspacePreferences().viewMode || 'canvas');
  const [activeCanvasId, setActiveCanvasId] = useState<string>('default');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => loadWorkspacePreferences().isSidebarOpen);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      saveWorkspacePreferences({ isSidebarOpen: next });
      return next;
    });
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setReaderCardId(null);
    saveWorkspacePreferences({ viewMode: mode });
  };

  // Modals & Reader Sidebars
  const [editingCard, setEditingCard] = useState<WorldCard | null>(null);
  const [readerCardId, setReaderCardId] = useState<string | null>(null);
  const [isReaderFullPage, setIsReaderFullPage] = useState<boolean>(false);

  // Close reader sidebar automatically when changing views, worlds, or canvases
  useEffect(() => {
    setReaderCardId(null);
  }, [viewMode, activeWorldId, activeCanvasId]);
  const [editingDeck, setEditingDeck] = useState<WorldDeck | null>(null);
  const [showDeckModal, setShowDeckModal] = useState<boolean>(false);
  const [editingConnection, setEditingConnection] = useState<CardConnection | null>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showWorldManager, setShowWorldManager] = useState<boolean>(false);
  const [cardsToDelete, setCardsToDelete] = useState<WorldCard[] | null>(null);
  const [canvasModalConfig, setCanvasModalConfig] = useState<{
    isOpen: boolean;
    mode: 'create' | 'rename';
    canvasId?: string;
    title: string;
    submitLabel: string;
    initialValue: string;
  }>({
    isOpen: false,
    mode: 'create',
    title: 'Buat Kanvas Baru',
    submitLabel: 'Buat Kanvas',
    initialValue: '',
  });

  // Undo & Redo History State
  const [historyStack, setHistoryStack] = useState<WorldProject[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Async Load State on Startup from IndexedDB & LocalStorage
  useEffect(() => {
    // Load persisted local directory handle from IndexedDB
    loadLocalFileHandle().then(async (handle) => {
      if (handle) {
        try {
          const options = { mode: 'readwrite' };
          const permission = await (handle as any).queryPermission(options);
          if (permission === 'granted') {
            setLocalDirectoryHandle(handle);
            setLocalDirectoryName(handle.name);
            // Load projects from directory
            const projects = await readAllProjectsFromDirectory(handle);
            if (projects.length > 0) {
              setWorlds(projects);
              const savedActiveId = localStorage.getItem('worlddeck_active_id_v2');
              if (savedActiveId && projects.some((p) => p.id === savedActiveId)) {
                setActiveWorldId(savedActiveId);
              } else {
                setActiveWorldId(projects[0].id);
              }
            } else {
              // Write default sample world if directory is empty
              await writeProjectToDirectory(handle, SAMPLE_WORLD);
              setWorlds([SAMPLE_WORLD]);
              setActiveWorldId(SAMPLE_WORLD.id);
            }
          } else {
            // Need user interaction to restore access permission
            setLocalDirectoryHandle(handle);
            setLocalDirectoryName(handle.name);
            setNeedDirectoryPermission(true);
          }
        } catch (e) {
          console.warn('Gagal memuat izin directory handle:', e);
        }
      }
      setIsLoaded(true);
    });
  }, []);

  // Derived Active World
  const activeWorld = worlds.find((w) => w.id === activeWorldId) || worlds[0] || SAMPLE_WORLD;

  // Derived active canvas cards and connections
  const activeWorldCanvases = activeWorld.canvases && activeWorld.canvases.length > 0
    ? activeWorld.canvases
    : [{ id: 'default', name: 'Kanvas Utama', createdAt: Date.now() }];

  const activeCanvasCards = activeWorld.cards.filter((c) => c.canvasId === activeCanvasId);
  const activeCanvasCardIds = activeCanvasCards.map((c) => c.id);
  const activeCanvasConnections = activeWorld.connections.filter(
    (conn) => activeCanvasCardIds.includes(conn.sourceId) && activeCanvasCardIds.includes(conn.targetId)
  );

  // Auto save activeWorldId to LocalStorage
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('worlddeck_active_id_v2', activeWorldId);
  }, [activeWorldId, isLoaded]);

  // Auto save active world directly to linked local directory
  useEffect(() => {
    if (!isLoaded || !localDirectoryHandle || needDirectoryPermission) return;
    writeProjectToDirectory(localDirectoryHandle, activeWorld);
  }, [activeWorld, localDirectoryHandle, isLoaded, needDirectoryPermission]);

  // Folder Directory Actions
  const handleSelectWorkspaceDirectory = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert('Browser Anda tidak mendukung File System Access API. Silakan gunakan Chrome, Edge, atau Opera.');
        return;
      }
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      if (handle) {
        setLocalDirectoryHandle(handle);
        setLocalDirectoryName(handle.name);
        setNeedDirectoryPermission(false);
        await saveLocalFileHandle(handle);

        const projects = await readAllProjectsFromDirectory(handle);
        if (projects.length > 0) {
          setWorlds(projects);
          const savedActiveId = localStorage.getItem('worlddeck_active_id_v2');
          if (savedActiveId && projects.some((p) => p.id === savedActiveId)) {
            setActiveWorldId(savedActiveId);
          } else {
            setActiveWorldId(projects[0].id);
          }
        } else {
          await writeProjectToDirectory(handle, SAMPLE_WORLD);
          setWorlds([SAMPLE_WORLD]);
          setActiveWorldId(SAMPLE_WORLD.id);
        }

      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert('Gagal membuka direktori folder.');
      }
    }
  };

  const handleRequestDirectoryPermission = async () => {
    if (!localDirectoryHandle) return;
    try {
      const options = { mode: 'readwrite' };
      const permission = await (localDirectoryHandle as any).requestPermission(options);
      if (permission === 'granted') {
        setNeedDirectoryPermission(false);
        const projects = await readAllProjectsFromDirectory(localDirectoryHandle);
        if (projects.length > 0) {
          setWorlds(projects);
          const savedActiveId = localStorage.getItem('worlddeck_active_id_v2');
          if (savedActiveId && projects.some((p) => p.id === savedActiveId)) {
            setActiveWorldId(savedActiveId);
          } else {
            setActiveWorldId(projects[0].id);
          }
        } else {
          await writeProjectToDirectory(localDirectoryHandle, SAMPLE_WORLD);
          setWorlds([SAMPLE_WORLD]);
          setActiveWorldId(SAMPLE_WORLD.id);
        }

      }
    } catch (err) {
      alert('Gagal mengaktifkan kembali izin akses folder.');
    }
  };

  // Helper to update active world in worlds array with history recording
  const updateActiveWorld = (updater: (prevWorld: WorldProject) => WorldProject) => {
    setWorlds((prevWorlds) => {
      const currentWorld = prevWorlds.find((w) => w.id === activeWorldId);
      if (!currentWorld) return prevWorlds;

      // Record snapshot to history stack
      setHistoryStack((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, currentWorld];
      });
      setHistoryIndex((prev) => prev + 1);

      const updatedWorld = updater(currentWorld);
      return prevWorlds.map((w) => (w.id === activeWorldId ? updatedWorld : w));
    });
  };

  // Undo / Redo Actions
  const handleUndo = () => {
    if (historyIndex < 0) return;
    const targetSnapshot = historyStack[historyIndex];
    setHistoryIndex((prev) => prev - 1);

    setWorlds((prevWorlds) =>
      prevWorlds.map((w) => (w.id === activeWorldId ? targetSnapshot : w))
    );
  };

  const handleRedo = () => {
    if (historyIndex >= historyStack.length - 1) return;
    const nextIndex = historyIndex + 1;
    const targetSnapshot = historyStack[nextIndex];
    setHistoryIndex(nextIndex);

    setWorlds((prevWorlds) =>
      prevWorlds.map((w) => (w.id === activeWorldId ? targetSnapshot : w))
    );
  };

  // Hotkey Undo/Redo & Shortcuts
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
        handleToggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, historyStack, activeWorldId]);

  // Card Management Actions
  const handleUpdateCardPosition = (id: string, x: number, y: number) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => (c.id === id ? { ...c, x, y } : c)),
    }));
  };

  const handleUpdateCardDimensions = (id: string, width: number, height: number) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => (c.id === id ? { ...c, width, height } : c)),
    }));
  };

  // Add New Blank Card directly on Canvas
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
      canvasId: activeCanvasId,
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

  // Add New Card from Galeri / Deck (Stored in Galeri, NOT placed on canvas automatically)
  const handleAddCardFromLibrary = (deckId?: string) => {
    const newCard: WorldCard = {
      id: generateId('card'),
      title: '',
      subtitle: '',
      category: selectedCategory === 'all' ? 'character' : selectedCategory,
      summary: '',
      content: '',
      tags: [],
      attributes: [],
      x: 300,
      y: 300,
      canvasId: undefined, // Belongs to Galeri only until manually added to Canvas
      deckId,
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

  // Remove Cards from Canvas (Keep in Galeri)
  const handleRemoveCardsFromCanvas = (cardIds: string[]) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => (cardIds.includes(c.id) ? { ...c, canvasId: undefined } : c)),
      connections: prev.connections.filter(
        (conn) => !cardIds.includes(conn.sourceId) && !cardIds.includes(conn.targetId)
      ),
    }));
  };

  // Add Multiple Cards to Canvas from Gallery at Position
  const handleAddCardsToCanvasAtPosition = (cardIds: string[], position: { x: number; y: number }) => {
    const COLS = 3;
    const SPACING_X = 260;
    const SPACING_Y = 220;

    updateActiveWorld((prev) => {
      let index = 0;
      const updatedCards = prev.cards.map((c) => {
        if (cardIds.includes(c.id)) {
          const col = index % COLS;
          const row = Math.floor(index / COLS);
          index++;
          return {
            ...c,
            canvasId: activeCanvasId,
            x: position.x + col * SPACING_X,
            y: position.y + row * SPACING_Y,
          };
        }
        return c;
      });

      return {
        ...prev,
        updatedAt: Date.now(),
        cards: updatedCards,
      };
    });


  };

  // Deck Management Actions
  const handleSaveDeck = (name: string, description: string, color: string) => {
    updateActiveWorld((prev) => {
      const existingDecks = prev.decks || [];
      if (editingDeck) {
        return {
          ...prev,
          updatedAt: Date.now(),
          decks: existingDecks.map((d) =>
            d.id === editingDeck.id ? { ...d, name, description, color, updatedAt: Date.now() } : d
          ),
        };
      } else {
        const newDeck: WorldDeck = {
          id: generateId('deck'),
          name,
          description,
          color,
          cardIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return {
          ...prev,
          updatedAt: Date.now(),
          decks: [...existingDecks, newDeck],
        };
      }
    });
    setEditingDeck(null);
    setShowDeckModal(false);
  };

  const handleDeleteDeck = (deckId: string) => {
    if (window.confirm('Hapus Deck ini? Kartu di dalamnya tidak akan terhapus.')) {
      updateActiveWorld((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        decks: (prev.decks || []).filter((d) => d.id !== deckId),
        cards: prev.cards.map((c) => (c.deckId === deckId ? { ...c, deckId: undefined } : c)),
      }));
    }
  };

  const handleAssignCardToDeck = (cardId: string, deckId?: string) => {
    updateActiveWorld((prev) => {
      const updatedCards = prev.cards.map((c) => (c.id === cardId ? { ...c, deckId } : c));
      const updatedDecks = (prev.decks || []).map((d) => {
        const cleanCardIds = (d.cardIds || []).filter((id) => id !== cardId);
        if (d.id === deckId) {
          return { ...d, cardIds: [...cleanCardIds, cardId] };
        }
        return { ...d, cardIds: cleanCardIds };
      });

      return {
        ...prev,
        updatedAt: Date.now(),
        cards: updatedCards,
        decks: updatedDecks,
      };
    });
  };

  // Reorder cards in gallery
  const handleReorderCards = (orderedCardIds: string[]) => {
    updateActiveWorld((prev) => {
      const cardMap = new Map(prev.cards.map((c) => [c.id, c]));
      // Start with the ordered cards
      const reordered: WorldCard[] = [];
      for (const id of orderedCardIds) {
        const card = cardMap.get(id);
        if (card) {
          reordered.push(card);
          cardMap.delete(id);
        }
      }
      // Append any remaining cards that weren't in the ordered list
      const remaining = prev.cards.filter((c) => cardMap.has(c.id));
      return {
        ...prev,
        updatedAt: Date.now(),
        cards: [...reordered, ...remaining],
      };
    });
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

  // Delete Multiple Connections
  const handleDeleteConnections = (connIds: string[]) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      connections: prev.connections.filter((c) => !connIds.includes(c.id)),
    }));
    if (editingConnection && connIds.includes(editingConnection.id)) {
      setEditingConnection(null);
    }
  };

  // World Manager Actions
  const handleCreateWorld = (newWorld: WorldProject) => {
    setWorlds((prev) => [...prev, newWorld]);
    setActiveWorldId(newWorld.id);

  };

  const handleDeleteWorld = (worldId: string) => {
    if (worlds.length <= 1) {
      alert('Anda harus memiliki setidaknya satu dunia.');
      return;
    }
    if (window.confirm('Hapus dunia ini secara permanen dari daftar dunia Anda?')) {
      const remaining = worlds.filter((w) => w.id !== worldId);
      setWorlds(remaining);
      
      // Delete project file from local directory
      if (localDirectoryHandle) {
        deleteProjectFromDirectory(localDirectoryHandle, worldId);
      }

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

  };

  // Canvas Management Actions
  const handleCreateCanvas = (name: string) => {
    const newCanvasId = generateId('canvas');
    const newCanvas = {
      id: newCanvasId,
      name: name || 'Kanvas Baru',
      createdAt: Date.now(),
    };
    updateActiveWorld((prev) => ({
      ...prev,
      canvases: [...(prev.canvases || [{ id: 'default', name: 'Kanvas Utama', createdAt: Date.now() }]), newCanvas],
      updatedAt: Date.now(),
    }));
    setActiveCanvasId(newCanvasId);
  };

  const handleRenameCanvas = (canvasId: string, newName: string) => {
    updateActiveWorld((prev) => {
      const canvases = prev.canvases && prev.canvases.length > 0
        ? prev.canvases
        : [{ id: 'default', name: 'Kanvas Utama', createdAt: Date.now() }];
      return {
        ...prev,
        canvases: canvases.map((c) => (c.id === canvasId ? { ...c, name: newName } : c)),
        updatedAt: Date.now(),
      };
    });
  };

  const handleTriggerCreateCanvas = () => {
    setCanvasModalConfig({
      isOpen: true,
      mode: 'create',
      title: 'Buat Kanvas Baru',
      submitLabel: 'Buat Kanvas',
      initialValue: '',
    });
  };

  const handleTriggerRenameCanvas = (canvasId: string, currentName: string) => {
    setCanvasModalConfig({
      isOpen: true,
      mode: 'rename',
      canvasId,
      title: 'Ubah Nama Kanvas',
      submitLabel: 'Simpan Nama',
      initialValue: currentName,
    });
  };

  const handleCanvasModalSubmit = (name: string) => {
    if (canvasModalConfig.mode === 'create') {
      handleCreateCanvas(name);
    } else if (canvasModalConfig.mode === 'rename' && canvasModalConfig.canvasId) {
      handleRenameCanvas(canvasModalConfig.canvasId, name);
    }
  };

  const handleDeleteCanvas = (canvasId: string) => {
    const canvases = activeWorld.canvases && activeWorld.canvases.length > 0
      ? activeWorld.canvases
      : [{ id: 'default', name: 'Kanvas Utama', createdAt: Date.now() }];
    if (canvases.length <= 1) {
      alert('Anda harus menyisakan setidaknya satu kanvas.');
      return;
    }
    if (window.confirm('Hapus kanvas ini beserta semua kartu di dalamnya secara permanen?')) {
      updateActiveWorld((prev) => {
        const remainingCanvases = (prev.canvases || []).filter((c) => c.id !== canvasId);
        return {
          ...prev,
          canvases: remainingCanvases,
          cards: prev.cards.filter((c) => (c.canvasId || 'default') !== canvasId),
          connections: prev.connections.filter((conn) => {
            const sourceCard = prev.cards.find((c) => c.id === conn.sourceId);
            const targetCard = prev.cards.find((c) => c.id === conn.targetId);
            return (
              sourceCard && (sourceCard.canvasId || 'default') !== canvasId &&
              targetCard && (targetCard.canvasId || 'default') !== canvasId
            );
          }),
          updatedAt: Date.now(),
        };
      });
      // Switch active canvas
      const remaining = canvases.filter((c) => c.id !== canvasId);
      setActiveCanvasId(remaining[0].id);
    }
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

    }
  };

  // Navigate to Card
  const handleNavigateToCard = (cardId: string) => {
    setSelectedCardId(cardId);
    if (viewMode !== 'canvas') setViewMode('canvas');
  };

  if (isLoaded && (!localDirectoryHandle || needDirectoryPermission)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center app-bg-main app-text-main font-sans relative overflow-hidden">
        {/* Background Decorative Gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />

        <div className="w-full max-w-md p-8 rounded-2xl app-bg-secondary border app-border shadow-2xl space-y-6 text-center z-10 animate-in zoom-in-95 duration-300">
          <div className="mx-auto w-16 h-16 rounded-2xl app-accent-bg flex items-center justify-center text-white font-bold shadow-lg">
            <Icons.Folder size={32} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold app-text-main tracking-tight">World Deck Workspace</h2>
            <p className="text-xs app-text-muted leading-relaxed px-2">
              {!localDirectoryHandle
                ? "Pilih folder lokal di komputer Anda untuk menyimpan seluruh proyek dunia Anda. Semua perubahan akan disimpan secara otomatis ke folder tersebut."
                : `Aplikasi membutuhkan izin untuk mengakses kembali folder: "${localDirectoryName}".`}
            </p>
          </div>

          <div className="pt-2">
            {!localDirectoryHandle ? (
              <button
                type="button"
                onClick={handleSelectWorkspaceDirectory}
                className="w-full py-3 rounded-xl app-accent-bg hover:opacity-90 text-white text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icons.FolderOpen size={16} />
                <span>Pilih Folder Workspace</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestDirectoryPermission}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icons.Unlock size={16} />
                <span>Izinkan Akses Folder</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col app-bg-main app-text-main overflow-hidden font-sans">
      
      {/* Top Navbar */}
      <Navbar
        projectName={activeWorld.name}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        onExport={handleExport}
        onImport={handleImport}
        onResetWorld={handleResetWorld}
        onOpenHelp={() => setShowHelpModal(true)}
        onOpenWorldManager={() => setShowWorldManager(true)}
        localDirectoryName={localDirectoryName}
        onChangeDirectory={handleSelectWorkspaceDirectory}
        canUndo={historyIndex >= 0}
        canRedo={historyIndex < historyStack.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={viewMode === 'canvas' ? handleToggleSidebar : undefined}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Sidebar Filter (Visible in Canvas view) */}
        {viewMode === 'canvas' && (
          <SidebarFilter
            cards={activeCanvasCards}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCardId={selectedCardId}
            onCardClick={(card) => {
              setSelectedCardId(card.id);
            }}
            isOpen={isSidebarOpen}
            onToggle={handleToggleSidebar}
            canvases={activeWorldCanvases}
            activeCanvasId={activeCanvasId}
            onCanvasSelect={setActiveCanvasId}
            onCreateCanvasRequest={handleTriggerCreateCanvas}
            onCanvasRenameRequest={handleTriggerRenameCanvas}
            onCanvasDelete={handleDeleteCanvas}
          />
        )}

        {/* View Component Switcher */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {viewMode === 'canvas' && (
            <Canvas
              activeCanvasId={activeCanvasId}
              cards={activeCanvasCards}
              allWorldCards={activeWorld.cards}
              allWorldDecks={activeWorld.decks || []}
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
              connections={activeCanvasConnections}
              selectedCardId={selectedCardId}
              onSelectCard={(card) => setSelectedCardId(card ? card.id : null)}
              onDoubleClickCard={(card) => {
                setReaderCardId(card.id);
                setIsReaderFullPage(false);
              }}
              onEditCardRequest={(card) => setEditingCard(card)}
              onOpenCardFullPageRequest={(card) => {
                setReaderCardId(card.id);
                setIsReaderFullPage(true);
              }}
              onUpdateCardPosition={handleUpdateCardPosition}
              onAddConnection={(src, tgt) => handleAddConnection(src, tgt, 'Terhubung')}
              onEditConnection={(conn) => setEditingConnection(conn)}
              onAddCardAtPosition={handleAddCardAtPosition}
              onAddCardsToCanvasAtPosition={handleAddCardsToCanvasAtPosition}
              onRemoveCardsFromCanvas={handleRemoveCardsFromCanvas}
              onDeleteCardsRequest={handleRequestDeleteCards}
              onDeleteConnection={handleDeleteConnection}
              onDeleteConnections={handleDeleteConnections}
              onUpdateCardDimensions={handleUpdateCardDimensions}
            />
          )}

          {viewMode === 'library' && (
            <LibraryView
              cards={activeWorld.cards}
              decks={activeWorld.decks || []}
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
              onCardClick={(card) => setEditingCard(card)}
              onAddCard={(deckId) => handleAddCardFromLibrary(deckId)}
              onCreateDeckRequest={() => {
                setEditingDeck(null);
                setShowDeckModal(true);
              }}
              onEditDeckRequest={(deck) => {
                setEditingDeck(deck);
                setShowDeckModal(true);
              }}
              onDeleteDeckRequest={handleDeleteDeck}
              onAssignCardToDeck={handleAssignCardToDeck}
              onReorderCards={handleReorderCards}
            />
          )}

          {viewMode === 'timeline' && (
            <TimelineView
              cards={activeCanvasCards}
              connections={activeCanvasConnections}
              onCardClick={(card) => setReaderCardId(card.id)}
              activeWorldId={activeWorldId}
            />
          )}

          {viewMode === 'relations' && (
            <RelationListView
              connections={activeCanvasConnections}
              cards={activeCanvasCards}
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
          onRemoveFromCanvas={() => {
            if (cardsToDelete) {
              handleRemoveCardsFromCanvas(cardsToDelete.map((c) => c.id));
              setCardsToDelete(null);
            }
          }}
          onPermanentDelete={handleConfirmDeleteCards}
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

      {/* Wiki Card Reader Sidebar & Full-Page Modal */}
      <CardReaderSidebar
        isOpen={!!readerCardId}
        onClose={() => setReaderCardId(null)}
        card={activeWorld.cards.find((c) => c.id === readerCardId) || null}
        allCards={activeWorld.cards}
        connections={activeWorld.connections}
        decks={activeWorld.decks || []}
        initialFullPage={isReaderFullPage}
        onEditCard={(cardToEdit) => {
          setEditingCard(cardToEdit);
          setReaderCardId(null);
        }}
        onSelectCard={(targetCardId) => {
          setReaderCardId(targetCardId);
          setSelectedCardId(targetCardId);
        }}
      />

      {/* Card Editor Modal */}
      {editingCard && (
        <CardEditorModal
          card={editingCard}
          allCards={activeCanvasCards}
          connections={activeCanvasConnections}
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
            activeCanvasCards.find((c) => c.id === editingConnection.sourceId) ||
            activeWorld.cards.find((c) => c.id === editingConnection.sourceId)
          }
          targetCard={
            activeCanvasCards.find((c) => c.id === editingConnection.targetId) ||
            activeWorld.cards.find((c) => c.id === editingConnection.targetId)
          }
          allCards={activeWorld.cards}
          onSave={handleSaveConnection}
          onDelete={handleDeleteConnection}
          onClose={() => setEditingConnection(null)}
        />
      )}

      {/* Help & Packaging Guide Modal */}
      {showHelpModal && <HelpGuideModal onClose={() => setShowHelpModal(false)} />}

      {/* Canvas Creator / Renamer Modal */}
      <CanvasModal
        isOpen={canvasModalConfig.isOpen}
        title={canvasModalConfig.title}
        submitLabel={canvasModalConfig.submitLabel}
        initialValue={canvasModalConfig.initialValue}
        onClose={() => setCanvasModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={handleCanvasModalSubmit}
      />

      {/* Deck Creator / Editor Modal */}
      <DeckModal
        isOpen={showDeckModal}
        onClose={() => {
          setShowDeckModal(false);
          setEditingDeck(null);
        }}
        deck={editingDeck}
        onSaveDeck={handleSaveDeck}
      />
    </div>
  );
};

export default App;

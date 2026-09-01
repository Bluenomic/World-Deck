import React, { useState, useEffect, useRef } from 'react';
import type { WorldProject, WorldCard, WorldDeck, CardConnection, ViewMode, CardCategory, AppTheme, WorldDocument, WorldCanvas, WorldMap } from './types';
import { SAMPLE_WORLD } from './data/sampleWorld';
import { generateId, downloadProjectJson, getCardCanvasIds, isCardOnCanvas, getCardPositionOnCanvas } from './utils/helpers';
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
import { ImageFocalAdjusterModal } from './components/ImageFocalAdjusterModal';
import { TimelineView } from './components/TimelineView';
import { DocumentsView } from './components/DocumentsView';
import { MapView } from './components/MapView';
import { CardEditorModal } from './components/CardEditorModal';
import { ConnectionModal } from './components/ConnectionModal';
import { HelpGuideModal } from './components/HelpGuideModal';
import { WorldManagerModal } from './components/WorldManagerModal';
import { DeleteCardModal } from './components/DeleteCardModal';
import { CanvasModal } from './components/CanvasModal';
import { DeckModal } from './components/DeckModal';
import { CardReaderSidebar } from './components/CardReaderSidebar';
import { WorkspaceLandingScreen } from './components/WorkspaceLandingScreen';
import {
  isTauriAvailable,
  saveProjectToFolder,
  listProjectsInFolder,
  deleteProjectFromFolder,
  openWorkspaceFolderDialog,
} from './utils/tauriStorage';
import { ConfirmModal } from './components/ConfirmModal';
import type { ConfirmModalConfig } from './components/ConfirmModal';
import { useLanguage } from './i18n/LanguageContext';


const STORAGE_THEME_KEY = 'worlddeck_theme_v1';

export const App: React.FC = () => {
  const { language, t } = useLanguage();

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
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string | null>(() => {
    try {
      return localStorage.getItem('worlddeck_selected_workspace_path') || null;
    } catch {
      return null;
    }
  });
  const [localDirectoryHandle, setLocalDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [localDirectoryName, setLocalDirectoryName] = useState<string | null>(null);
  const [needDirectoryPermission, setNeedDirectoryPermission] = useState<boolean>(false);

  // Worlds & Active World State (Starts empty until folder is loaded)
  const [worlds, setWorlds] = useState<WorldProject[]>([]);
  const [activeWorldId, setActiveWorldId] = useState<string>('');

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
  const [adjustFocalCard, setAdjustFocalCard] = useState<WorldCard | null>(null);

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
    title: language === 'en' ? 'Create New Canvas' : 'Buat Kanvas Baru',
    submitLabel: language === 'en' ? 'Create Canvas' : 'Buat Kanvas',
    initialValue: '',
  });

  // Undo & Redo History State
  const [historyStack, setHistoryStack] = useState<WorldProject[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const isUndoRedoRef = useRef<boolean>(false);

  // Custom Confirm & Alert Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<ConfirmModalConfig | null>(null);

  const showAlertModal = (title: string, description: string, variant: 'danger' | 'warning' | 'info' | 'success' = 'info') => {
    setConfirmModalConfig({
      isOpen: true,
      title,
      description,
      isAlertOnly: true,
      variant,
      confirmLabel: language === 'en' ? 'Got it' : 'Mengerti',
      onConfirm: () => setConfirmModalConfig(null),
    });
  };

  // Async Load State on Startup from Selected Folder
  useEffect(() => {
    const initStorage = async () => {
      try {
        if (isTauriAvailable()) {
          const savedFolderPath = localStorage.getItem('worlddeck_selected_workspace_path');
          if (savedFolderPath) {
            const projects = await listProjectsInFolder(savedFolderPath);
            if (projects && projects.length > 0) {
              setSelectedWorkspacePath(savedFolderPath);
              setLocalDirectoryName(savedFolderPath.split(/[/\\]/).pop() || 'Workspace');
              setWorlds(projects);
              const savedActiveId = localStorage.getItem('worlddeck_active_id_v2');
              if (savedActiveId && projects.some((p) => p.id === savedActiveId)) {
                setActiveWorldId(savedActiveId);
              } else {
                setActiveWorldId(projects[0].id);
              }
            } else {
              setSelectedWorkspacePath(null);
            }
          }
          return;
        }

        const handle = await loadLocalFileHandle();
        if (handle) {
          try {
            const options = { mode: 'readwrite' };
            const permission = await (handle as any).queryPermission(options);
            if (permission === 'granted') {
              setLocalDirectoryHandle(handle);
              setLocalDirectoryName(handle.name);
              const projects = await readAllProjectsFromDirectory(handle);
              if (projects.length > 0) {
                setWorlds(projects);
                const savedActiveId = localStorage.getItem('worlddeck_active_id_v2');
                if (savedActiveId && projects.some((p) => p.id === savedActiveId)) {
                  setActiveWorldId(savedActiveId);
                } else {
                  setActiveWorldId(projects[0].id);
                }
              }
            } else {
              setLocalDirectoryHandle(handle);
              setLocalDirectoryName(handle.name);
              setNeedDirectoryPermission(true);
            }
          } catch (e) {
            console.warn('Gagal memuat izin directory handle:', e);
            setLocalDirectoryHandle(handle);
            setLocalDirectoryName(handle.name);
            setNeedDirectoryPermission(true);
          }
        }
      } catch (err) {
        console.error('Gagal inisialisasi storage:', err);
      } finally {
        setIsLoaded(true);
      }
    };

    initStorage();
  }, []);

  // Derived Active World
  const activeWorld = (worlds || []).filter(Boolean).find((w) => w && w.id === activeWorldId) || (worlds || []).filter(Boolean)[0] || (
    selectedWorkspacePath
      ? {
          id: 'temp_empty',
          name: localDirectoryName || 'Workspace Baru',
          description: '',
          version: '1.0.0',
          cards: [],
          canvases: [{ id: 'default', name: 'Kanvas Utama', createdAt: Date.now() }],
          connections: [],
          decks: [],
          timelineTracks: [],
          timelineNodes: [],
          documents: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      : SAMPLE_WORLD
  );

  // Derived active canvas cards and connections
  const activeWorldCanvases = activeWorld.canvases && activeWorld.canvases.length > 0
    ? activeWorld.canvases
    : [{ id: 'default', name: 'Kanvas Utama', createdAt: Date.now() }];

  const activeCanvasCards = activeWorld.cards
    .filter((c) => isCardOnCanvas(c, activeCanvasId))
    .map((c) => {
      const pos = getCardPositionOnCanvas(c, activeCanvasId);
      return {
        ...c,
        x: pos.x,
        y: pos.y,
      };
    });
  const activeCanvasCardIds = activeCanvasCards.map((c) => c.id);
  const activeCanvasConnections = activeWorld.connections.filter(
    (conn) => activeCanvasCardIds.includes(conn.sourceId) && activeCanvasCardIds.includes(conn.targetId)
  );

  // Auto save activeWorldId to LocalStorage
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('worlddeck_active_id_v2', activeWorldId);
  }, [activeWorldId, isLoaded]);

  const isSwitchingFolderRef = useRef<boolean>(false);

  // Auto save active world directly to linked local directory or Tauri workspace folder
  useEffect(() => {
    if (!isLoaded || !activeWorld || isSwitchingFolderRef.current) return;
    if (activeWorld.id === SAMPLE_WORLD.id) return;
    const isWorldInCurrentList = (worlds || []).some((w) => w && w.id === activeWorld.id);
    if (!isWorldInCurrentList) return;

    if (selectedWorkspacePath && isTauriAvailable()) {
      saveProjectToFolder(selectedWorkspacePath, activeWorld);
    }
    if (localDirectoryHandle && !needDirectoryPermission) {
      writeProjectToDirectory(localDirectoryHandle, activeWorld);
    }
  }, [activeWorld, selectedWorkspacePath, worlds, localDirectoryHandle, isLoaded, needDirectoryPermission]);

  // Create New Project explicitly in current workspace folder
  const handleCreateProjectInFolder = async (name: string, description: string) => {
    const newProject: WorldProject = {
      id: generateId('world'),
      name: name.trim(),
      description: description.trim(),
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cards: [],
      canvases: [{ id: 'default', name: 'Kanvas Utama', createdAt: Date.now() }],
      connections: [],
      decks: [],
      timelineTracks: [],
      timelineNodes: [],
      documents: [],
    };

    if (selectedWorkspacePath && isTauriAvailable()) {
      await saveProjectToFolder(selectedWorkspacePath, newProject);
      setWorlds([newProject]);
      setActiveWorldId(newProject.id);
    } else if (localDirectoryHandle) {
      await writeProjectToDirectory(localDirectoryHandle, newProject);
      setWorlds([newProject]);
      setActiveWorldId(newProject.id);
    }
  };

  // Folder Directory Actions (Mandatory Workspace Picker)
  const handleSelectWorkspaceDirectory = async () => {
    try {
      if (isTauriAvailable()) {
        isSwitchingFolderRef.current = true;
        const folderPath = await openWorkspaceFolderDialog();
        if (folderPath && typeof folderPath === 'string') {
          const folderName = folderPath.split(/[/\\]/).pop() || 'Workspace';

          // 1. Purge old worlds from state so they aren't written to the new folder
          setWorlds([]);
          setActiveWorldId('');

          // 2. Set new workspace path
          setSelectedWorkspacePath(folderPath);
          setLocalDirectoryName(folderName);
          localStorage.setItem('worlddeck_selected_workspace_path', folderPath);

          // 3. Read existing projects from new folder
          const projects = await listProjectsInFolder(folderPath);
          if (projects && projects.length > 0) {
            setWorlds(projects);
            setActiveWorldId(projects[0].id);
          } else {
            // Keep worlds empty and automatically open WorldManagerModal for user creation
            setWorlds([]);
            setActiveWorldId('');
            setShowWorldManager(true);
          }
        }
        isSwitchingFolderRef.current = false;
        return;
      }

      if (!('showDirectoryPicker' in window)) {
        alert('Browser Anda tidak mendukung File System Access API. Silakan gunakan Chrome, Edge, atau Opera.');
        return;
      }

      isSwitchingFolderRef.current = true;
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      if (handle) {
        setWorlds([]);
        setActiveWorldId('');
        setLocalDirectoryHandle(handle);
        setLocalDirectoryName(handle.name);
        setNeedDirectoryPermission(false);
        await saveLocalFileHandle(handle);

        const projects = await readAllProjectsFromDirectory(handle);
        if (projects.length > 0) {
          setWorlds(projects);
          setActiveWorldId(projects[0].id);
        } else {
          setWorlds([]);
          setActiveWorldId('');
        }
      }
      isSwitchingFolderRef.current = false;
    } catch (err: any) {
      isSwitchingFolderRef.current = false;
      if (err.name !== 'AbortError') {
        alert('Gagal membuka direktori folder workspace.');
      }
    }
  };

  // Initialize history stack when activeWorldId changes or on load
  useEffect(() => {
    const current = (worlds || []).filter(Boolean).find((w) => w.id === activeWorldId) || (worlds || []).filter(Boolean)[0];
    if (current && isLoaded) {
      setHistoryStack([JSON.parse(JSON.stringify(current))]);
      setHistoryIndex(0);
    }
  }, [activeWorldId, isLoaded]);

  // Helper to update active world in worlds array with history recording
  const updateActiveWorld = (updater: (prevWorld: WorldProject) => WorldProject) => {
    setWorlds((prevWorlds) => {
      const validWorlds = (prevWorlds || []).filter(Boolean);
      const currentWorld = validWorlds.find((w) => w.id === activeWorldId) || validWorlds[0];
      if (!currentWorld) return prevWorlds;

      const updatedWorld = updater(currentWorld);

      // Record snapshot if not an undo/redo action
      if (!isUndoRedoRef.current) {
        try {
          setHistoryStack((prevStack) => {
            const currentTop = prevStack[historyIndex];
            const isDuplicate =
              currentTop &&
              JSON.stringify(currentTop.cards) === JSON.stringify(updatedWorld.cards) &&
              JSON.stringify(currentTop.connections) === JSON.stringify(updatedWorld.connections) &&
              JSON.stringify(currentTop.canvases) === JSON.stringify(updatedWorld.canvases);

            if (isDuplicate) return prevStack;

            const snapshot = JSON.parse(JSON.stringify(updatedWorld));
            const sliced = prevStack.slice(0, historyIndex + 1);
            setHistoryIndex(sliced.length);
            return [...sliced, snapshot];
          });
        } catch (err) {
          console.warn('Failed to record history snapshot:', err);
        }
      }

      return validWorlds.map((w) => (w.id === activeWorldId ? updatedWorld : w));
    });
  };

  // Undo / Redo Actions for Canvas Card State
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyStack.length - 1;

  const handleUndo = () => {
    if (historyIndex <= 0 || historyStack.length === 0) return;
    const targetIndex = historyIndex - 1;
    const targetSnapshot = historyStack[targetIndex];
    if (!targetSnapshot || !targetSnapshot.id) return;

    isUndoRedoRef.current = true;
    const targetCopy = JSON.parse(JSON.stringify(targetSnapshot));
    setHistoryIndex(targetIndex);

    setWorlds((prevWorlds) =>
      (prevWorlds || []).filter(Boolean).map((w) => (w.id === activeWorldId ? targetCopy : w))
    );

    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 50);
  };

  const handleRedo = () => {
    if (historyIndex >= historyStack.length - 1 || historyStack.length === 0) return;
    const targetIndex = historyIndex + 1;
    const targetSnapshot = historyStack[targetIndex];
    if (!targetSnapshot || !targetSnapshot.id) return;

    isUndoRedoRef.current = true;
    const targetCopy = JSON.parse(JSON.stringify(targetSnapshot));
    setHistoryIndex(targetIndex);

    setWorlds((prevWorlds) =>
      (prevWorlds || []).filter(Boolean).map((w) => (w.id === activeWorldId ? targetCopy : w))
    );

    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 50);
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

  // Disable Default Web Browser Context Menu Globally Across Application
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleGlobalContextMenu);
    };
  }, []);

  // Card Management Actions
  const handleUpdateCardPosition = (id: string, x: number, y: number) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => {
        if (c.id !== id) return c;
        const currentPositions = c.canvasPositions || {};
        return {
          ...c,
          x,
          y,
          canvasPositions: {
            ...currentPositions,
            [activeCanvasId]: { x, y },
          },
        };
      }),
    }));
  };

  const handleUpdateCardPositionsBatch = (updates: { id: string; x: number; y: number }[]) => {
    if (updates.length === 0) return;
    const updateMap = new Map(updates.map((u) => [u.id, u]));
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => {
        const up = updateMap.get(c.id);
        if (!up) return c;
        const currentPositions = c.canvasPositions || {};
        return {
          ...c,
          x: up.x,
          y: up.y,
          canvasPositions: {
            ...currentPositions,
            [activeCanvasId]: { x: up.x, y: up.y },
          },
        };
      }),
    }));
  };

  const handleUpdateCardDimensions = (id: string, width: number, height: number) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => (c.id === id ? { ...c, width, height } : c)),
    }));
  };

  const handleUpdateCardImageHeight = (id: string, imageHeight: number) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => (c.id === id ? { ...c, imageHeight } : c)),
    }));
  };

  const handleUpdateCardImageFocalPoint = (id: string, imageFocalX: number, imageFocalY: number) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => (c.id === id ? { ...c, imageFocalX, imageFocalY } : c)),
    }));
  };

  // Add New Card directly on Canvas (or Duplicate Card)
  const handleAddCardAtPosition = (x: number = 300, y: number = 300, initialData?: Partial<WorldCard>) => {
    const newCard: WorldCard = {
      id: generateId('card'),
      title: initialData?.title || '',
      subtitle: initialData?.subtitle || '',
      category: initialData?.category || (selectedCategory === 'all' ? 'character' : selectedCategory),
      summary: initialData?.summary || '',
      content: initialData?.content || '',
      tags: initialData?.tags ? [...initialData.tags] : [],
      attributes: initialData?.attributes ? JSON.parse(JSON.stringify(initialData.attributes)) : [],
      imageUrl: initialData?.imageUrl || '',
      x,
      y,
      canvasId: activeCanvasId,
      canvasIds: [activeCanvasId],
      canvasPositions: { [activeCanvasId]: { x, y } },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: [...prev.cards, newCard],
    }));

    if (!initialData) {
      setEditingCard(newCard);
    }
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
      canvasIds: [],
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

  // Remove Cards from Canvas (Keep in Galeri / Other Canvases)
  const handleRemoveCardsFromCanvas = (cardIds: string[]) => {
    updateActiveWorld((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      cards: prev.cards.map((c) => {
        if (!cardIds.includes(c.id)) return c;
        const currentCanvasIds = getCardCanvasIds(c);
        const remainingCanvasIds = currentCanvasIds.filter((id) => id !== activeCanvasId);
        const nextPositions = { ...(c.canvasPositions || {}) };
        delete nextPositions[activeCanvasId];
        return {
          ...c,
          canvasId: remainingCanvasIds[0] || undefined,
          canvasIds: remainingCanvasIds,
          canvasPositions: nextPositions,
        };
      }),
      connections: prev.connections.filter((conn) => {
        if (!cardIds.includes(conn.sourceId) && !cardIds.includes(conn.targetId)) return true;
        const sourceCard = prev.cards.find((card) => card.id === conn.sourceId);
        const targetCard = prev.cards.find((card) => card.id === conn.targetId);
        if (!sourceCard || !targetCard) return false;
        const srcCanvases = getCardCanvasIds(sourceCard).filter((id) => id !== activeCanvasId);
        const tgtCanvases = getCardCanvasIds(targetCard).filter((id) => id !== activeCanvasId);
        return srcCanvases.some((id) => tgtCanvases.includes(id));
      }),
    }));
  };

  // Add Multiple Cards to Canvas from Gallery at Position (Preserving presence on existing canvases)
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
          const targetX = position.x + col * SPACING_X;
          const targetY = position.y + row * SPACING_Y;
          const currentCanvasIds = getCardCanvasIds(c);
          const newCanvasIds = Array.from(new Set([...currentCanvasIds, activeCanvasId]));
          const newPositions = {
            ...(c.canvasPositions || {}),
            [activeCanvasId]: { x: targetX, y: targetY },
          };
          return {
            ...c,
            canvasId: activeCanvasId,
            canvasIds: newCanvasIds,
            canvasPositions: newPositions,
            x: targetX,
            y: targetY,
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
    setConfirmModalConfig({
      isOpen: true,
      title: t.appPrompts.deleteDeckTitle,
      description: language === 'en'
        ? 'Are you sure you want to delete this Deck? Cards inside will not be deleted and will return to standalone cards.'
        : 'Apakah Anda yakin ingin menghapus Deck ini? Kartu-kartu di dalamnya tidak akan terhapus dan akan dikembalikan menjadi kartu mandiri.',
      confirmLabel: t.appPrompts.deleteDeckConfirm,
      cancelLabel: t.common.cancel,
      variant: 'danger',
      onConfirm: () => {
        updateActiveWorld((prev) => ({
          ...prev,
          updatedAt: Date.now(),
          decks: (prev.decks || []).filter((d) => d.id !== deckId),
          cards: prev.cards.map((c) => (c.deckId === deckId ? { ...c, deckId: undefined } : c)),
        }));
      },
    });
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

  // Timeline Data Management Handler
  const handleSaveTimeline = (tracks: any[], nodes: any[], branches: any[]) => {
    updateActiveWorld((prev) => ({
      ...prev,
      timelineTracks: tracks,
      timelineNodes: nodes,
      timelineBranches: branches,
      updatedAt: Date.now(),
    }));
  };

  // Document Management Handlers
  const handleSaveDocument = (updatedDoc: WorldDocument) => {
    updateActiveWorld((prev) => {
      const existingDocs = prev.documents || [];
      const exists = existingDocs.some((d) => d.id === updatedDoc.id);
      const docs = exists
        ? existingDocs.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
        : [...existingDocs, updatedDoc];
      return {
        ...prev,
        documents: docs,
        updatedAt: Date.now(),
      };
    });
  };

  const handleCreateDocument = (newDoc: WorldDocument) => {
    updateActiveWorld((prev) => ({
      ...prev,
      documents: [...(prev.documents || []), newDoc],
      updatedAt: Date.now(),
    }));
  };

  const handleDeleteDocument = (docId: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: t.appPrompts.deleteDocumentTitle,
      description: language === 'en'
        ? 'Are you sure you want to permanently delete this manuscript document?'
        : 'Apakah Anda yakin ingin menghapus dokumen naskah ini secara permanen?',
      confirmLabel: t.appPrompts.deleteDocumentConfirm,
      cancelLabel: t.common.cancel,
      variant: 'danger',
      onConfirm: () => {
        updateActiveWorld((prev) => ({
          ...prev,
          documents: (prev.documents || []).filter((d) => d.id !== docId),
          updatedAt: Date.now(),
        }));
      },
    });
  };

  const handleSaveMap = (updatedMap: WorldMap) => {
    updateActiveWorld((prev) => {
      const existingMaps = prev.worldMaps || [];
      const exists = existingMaps.some((m) => m.id === updatedMap.id);
      const newMaps = exists
        ? existingMaps.map((m) => (m.id === updatedMap.id ? updatedMap : m))
        : [...existingMaps, updatedMap];
      return {
        ...prev,
        worldMaps: newMaps,
        updatedAt: Date.now(),
      };
    });
  };

  const handleDeleteMap = (mapId: string) => {
    updateActiveWorld((prev) => ({
      ...prev,
      worldMaps: (prev.worldMaps || []).filter((m) => m.id !== mapId),
      updatedAt: Date.now(),
    }));
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
      showAlertModal(
        t.appPrompts.connectionExistsTitle,
        t.appPrompts.connectionExistsDesc,
        'warning'
      );
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
      showAlertModal(
        t.appPrompts.cannotDeleteWorldTitle,
        t.appPrompts.cannotDeleteWorldDesc,
        'warning'
      );
      return;
    }
    setConfirmModalConfig({
      isOpen: true,
      title: t.appPrompts.deleteWorldTitle,
      description: language === 'en'
        ? 'Are you sure you want to permanently delete this world from your world list?'
        : 'Apakah Anda yakin ingin menghapus dunia ini secara permanen dari daftar dunia Anda?',
      confirmLabel: t.appPrompts.deletePermanently,
      cancelLabel: t.common.cancel,
      variant: 'danger',
      onConfirm: () => {
        const remaining = worlds.filter((w) => w.id !== worldId);
        setWorlds(remaining);
        
        // Delete project file from local directory or Tauri folder
        if (selectedWorkspacePath && isTauriAvailable()) {
          deleteProjectFromFolder(selectedWorkspacePath, worldId);
        }
        if (localDirectoryHandle) {
          deleteProjectFromDirectory(localDirectoryHandle, worldId);
        }

        if (activeWorldId === worldId) {
          setActiveWorldId(remaining[0].id);
        }
      },
    });
  };

  const handleDuplicateWorld = (worldId: string) => {
    const target = worlds.find((w) => w.id === worldId);
    if (!target) return;

    const duplicated: WorldProject = {
      ...target,
      id: generateId('world'),
      name: `${target.name} ${t.documents.copySuffix}`,
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
      name: name || t.appPrompts.newCanvasDefault,
      createdAt: Date.now(),
    };
    updateActiveWorld((prev) => ({
      ...prev,
      canvases: [...(prev.canvases || [{ id: 'default', name: t.appPrompts.mainCanvasDefault, createdAt: Date.now() }]), newCanvas],
      updatedAt: Date.now(),
    }));
    setActiveCanvasId(newCanvasId);
  };

  const handleRenameCanvas = (canvasId: string, newName: string) => {
    updateActiveWorld((prev) => {
      const canvases = prev.canvases && prev.canvases.length > 0
        ? prev.canvases
        : [{ id: 'default', name: t.appPrompts.mainCanvasDefault, createdAt: Date.now() }];
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
      title: t.appPrompts.createCanvasTitle,
      submitLabel: t.appPrompts.createCanvasSubmit,
      initialValue: '',
    });
  };

  const handleTriggerRenameCanvas = (canvasId: string, currentName: string) => {
    setCanvasModalConfig({
      isOpen: true,
      mode: 'rename',
      canvasId,
      title: t.appPrompts.renameCanvasTitle,
      submitLabel: t.appPrompts.saveName,
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
      : [{ id: 'default', name: t.appPrompts.mainCanvasDefault, createdAt: Date.now() }];
    if (canvases.length <= 1) {
      showAlertModal(
        t.appPrompts.cannotDeleteCanvasTitle,
        t.appPrompts.cannotDeleteCanvasDesc,
        'warning'
      );
      return;
    }
    setConfirmModalConfig({
      isOpen: true,
      title: t.appPrompts.deleteCanvasTitle,
      description: language === 'en'
        ? 'Are you sure you want to delete this canvas? Cards will remain safely stored in your Library.'
        : 'Apakah Anda yakin ingin menghapus kanvas ini? Kartu akan tetap tersimpan dengan aman di Galeri / Library.',
      confirmLabel: t.appPrompts.deleteCanvasConfirm,
      cancelLabel: t.common.cancel,
      variant: 'danger',
      onConfirm: () => {
        updateActiveWorld((prev) => {
          const remainingCanvases = (prev.canvases || []).filter((c) => c.id !== canvasId);
          const updatedCards = prev.cards.map((c) => {
            const currentCanvasIds = getCardCanvasIds(c);
            if (!currentCanvasIds.includes(canvasId)) return c;
            const remainingIds = currentCanvasIds.filter((id) => id !== canvasId);
            const nextPositions = { ...(c.canvasPositions || {}) };
            delete nextPositions[canvasId];
            return {
              ...c,
              canvasId: remainingIds[0] || undefined,
              canvasIds: remainingIds,
              canvasPositions: nextPositions,
            };
          });
          return {
            ...prev,
            canvases: remainingCanvases,
            cards: updatedCards,
            updatedAt: Date.now(),
          };
        });
        const remaining = canvases.filter((c) => c.id !== canvasId);
        setActiveCanvasId(remaining[0].id);
      },
    });
  };

  const handleDuplicateCanvas = (canvasId: string) => {
    updateActiveWorld((prev) => {
      const sourceCanvas = (prev.canvases || []).find((c) => c.id === canvasId);
      if (!sourceCanvas) return prev;
      const newCanvasId = generateId('canvas');
      const newCanvas: WorldCanvas = {
        id: newCanvasId,
        name: `${sourceCanvas.name} (${t.appPrompts.copySuffix})`,
        createdAt: Date.now(),
      };

      const updatedCards = prev.cards.map((c) => {
        if (!isCardOnCanvas(c, canvasId)) return c;
        const currentCanvasIds = getCardCanvasIds(c);
        const newCanvasIds = Array.from(new Set([...currentCanvasIds, newCanvasId]));
        const pos = getCardPositionOnCanvas(c, canvasId);
        const newPositions = {
          ...(c.canvasPositions || {}),
          [newCanvasId]: pos,
        };
        return {
          ...c,
          canvasIds: newCanvasIds,
          canvasPositions: newPositions,
        };
      });

      return {
        ...prev,
        updatedAt: Date.now(),
        canvases: [...(prev.canvases || [{ id: 'default', name: t.appPrompts.mainCanvasDefault, createdAt: Date.now() }]), newCanvas],
        cards: updatedCards,
      };
    });
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
            name: importedData.name || t.appPrompts.importedWorldDefault,
            updatedAt: Date.now(),
          };
          setWorlds((prev) => [...prev, newWorld]);
          setActiveWorldId(newWorld.id);

          showAlertModal(
            t.appPrompts.worldImportSuccessTitle,
            `${t.appPrompts.worldImportSuccessDesc} ${newWorld.name}`,
            'success'
          );
        } else {
          showAlertModal(
            t.appPrompts.importFailedTitle,
            t.appPrompts.importFailedDesc,
            'danger'
          );
        }
      } catch (err) {
        showAlertModal(
          t.appPrompts.failedToReadFileTitle,
          t.appPrompts.failedToReadFileDesc,
          'danger'
        );
      }
    };
    reader.readAsText(file);
  };

  // Reset active world or timeline
  const handleResetWorld = () => {
    if (viewMode === 'timeline') {
      window.dispatchEvent(new CustomEvent('worlddeck_clear_timeline'));
    } else {
      setConfirmModalConfig({
        isOpen: true,
        title: t.appPrompts.clearCardsTitle,
        description: language === 'en'
          ? 'Are you sure you want to clear all cards in this world and start with an empty canvas?'
          : 'Apakah Anda yakin ingin membersihkan seluruh kartu pada dunia ini dan memulai dari kanvas kosong?',
        confirmLabel: t.appPrompts.clearCardsConfirm,
        cancelLabel: t.common.cancel,
        variant: 'danger',
        onConfirm: () => {
          updateActiveWorld((prev) => ({
            ...prev,
            cards: [],
            connections: [],
            updatedAt: Date.now(),
          }));
        },
      });
    }
  };

  // Navigate to Card
  const handleNavigateToCard = (cardId: string) => {
    setSelectedCardId(cardId);
    if (viewMode !== 'canvas') setViewMode('canvas');
  };

  if (!isLoaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center app-bg-main app-text-main font-sans">
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl app-accent-bg flex items-center justify-center text-white font-bold shadow-lg animate-pulse">
            <Icons.Sparkles size={24} />
          </div>
          <span className="text-xs font-semibold text-slate-400">Memuat Workspace...</span>
        </div>
      </div>
    );
  }

  const isWorkspaceSelected = !!(selectedWorkspacePath || (localDirectoryHandle && !needDirectoryPermission));

  return (
    <div className="h-screen w-screen flex flex-col app-bg-main app-text-main overflow-hidden font-sans">
      
      {/* Top Navbar ALWAYS rendered so Window Controls (Minimize, Maximize, Close) and branding are ALWAYS working */}
      <Navbar
        projectName={activeWorld?.name || 'World Deck'}
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
      />

      {/* Main Workspace Area */}
      {!isWorkspaceSelected ? (
        <WorkspaceLandingScreen
          selectedWorkspacePath={selectedWorkspacePath}
          onSelectWorkspace={handleSelectWorkspaceDirectory}
          onCreateProjectInFolder={handleCreateProjectInFolder}
        />
      ) : (
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
            onDuplicateCanvas={handleDuplicateCanvas}
            onRemoveCardFromCanvas={(cardId) => handleRemoveCardsFromCanvas([cardId])}
            onDeleteCardRequest={(cardId) => handleRequestDeleteCards([cardId])}
            onEditCardRequest={(card) => setEditingCard(card)}
            onFocusCardOnCanvas={(card) => setSelectedCardId(card.id)}
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
              onUpdateCardPositionsBatch={handleUpdateCardPositionsBatch}
              onAddConnection={(src, tgt) => handleAddConnection(src, tgt, 'Terhubung')}
              onEditConnection={(conn) => setEditingConnection(conn)}
              onAddCardAtPosition={handleAddCardAtPosition}
              onAddCardsToCanvasAtPosition={handleAddCardsToCanvasAtPosition}
              onRemoveCardsFromCanvas={handleRemoveCardsFromCanvas}
              onDeleteCardsRequest={handleRequestDeleteCards}
              onDeleteConnection={handleDeleteConnection}
              onDeleteConnections={handleDeleteConnections}
              onUpdateCardDimensions={handleUpdateCardDimensions}
              onUpdateCardImageHeight={handleUpdateCardImageHeight}
              onAdjustImageFocalPointRequest={(card) => setAdjustFocalCard(card)}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
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
              onEditCardRequest={(card) => setEditingCard(card)}
              onOpenCardFullPage={(card) => {
                setReaderCardId(card.id);
                setIsReaderFullPage(true);
              }}
              onDeleteCardsRequest={handleRequestDeleteCards}
              onAdjustImageFocalPointRequest={(card) => setAdjustFocalCard(card)}
            />
          )}

          {viewMode === 'timeline' && (
            <TimelineView
              cards={activeWorld.cards}
              connections={activeWorld.connections}
              onCardClick={(card) => setReaderCardId(card.id)}
              activeWorldId={activeWorldId}
              timelineTracks={activeWorld.timelineTracks}
              timelineNodes={activeWorld.timelineNodes as any}
              timelineBranches={activeWorld.timelineBranches}
              onSaveTimeline={handleSaveTimeline}
            />
          )}

          {viewMode === 'documents' && (
            <DocumentsView
              documents={activeWorld.documents || []}
              cards={activeWorld.cards}
              onSaveDocument={handleSaveDocument}
              onDeleteDocument={handleDeleteDocument}
              onCreateDocument={handleCreateDocument}
              onOpenCard={(card) => setReaderCardId(card.id)}
              onCreateCard={(newCard) => {
                updateActiveWorld((prev) => ({
                  ...prev,
                  updatedAt: Date.now(),
                  cards: [...prev.cards, newCard],
                }));
              }}
            />
          )}

          {viewMode === 'map' && (
            <MapView
              worldMaps={activeWorld.worldMaps || []}
              cards={activeWorld.cards}
              onSaveMap={handleSaveMap}
              onDeleteMap={handleDeleteMap}
              onOpenCard={(cardId) => setReaderCardId(cardId)}
              onAddCard={(newCard) => {
                updateActiveWorld((prev) => ({
                  ...prev,
                  updatedAt: Date.now(),
                  cards: [...prev.cards, newCard],
                }));
              }}
              onUpdateCard={(updatedCard) => {
                updateActiveWorld((prev) => ({
                  ...prev,
                  updatedAt: Date.now(),
                  cards: prev.cards.map((c) => (c.id === updatedCard.id ? updatedCard : c)),
                }));
              }}
              onEditCard={(card) => setEditingCard(card)}
            />
          )}
        </main>
      </div>
      )}

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

      {/* Universal Reusable Custom Confirm & Alert Modal */}
      <ConfirmModal
        config={confirmModalConfig}
        onClose={() => setConfirmModalConfig(null)}
      />
      {/* Interactive Image Focal Point Adjustment Modal */}
      {adjustFocalCard && (
        <ImageFocalAdjusterModal
          card={adjustFocalCard}
          onSave={handleUpdateCardImageFocalPoint}
          onClose={() => setAdjustFocalCard(null)}
        />
      )}
    </div>
  );
};

export default App;

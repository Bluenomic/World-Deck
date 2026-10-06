import { useStableEvent } from './utils/useStableEvent';
import { useModalAccessibility } from './utils/useModalAccessibility';
import React, { lazy, Suspense, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import type { TimelineTrack, TimelineNode, TimelineBranch, WorldProject, WorldCard, WorldDeck, CardConnection, ViewMode, CardCategory, AppTheme, WorldDocument, WorldCanvas, WorldMap, MapPin } from './types';
import { SAMPLE_WORLD } from './data/sampleWorld';
import { generateId, downloadProjectJson, getCardCanvasIds, isCardOnCanvas, getCardPositionOnCanvas } from './utils/helpers';
import { saveLocalFileHandle, loadLocalFileHandle, loadWorkspacePreferences, saveWorkspacePreferences, getDirectoryWorkspaceId } from './utils/storage';
import * as Icons from './utils/icons';
import { Navbar } from './components/Navbar';
import { SidebarFilter } from './components/SidebarFilter';
import { Canvas } from './components/Canvas';
const LibraryView = lazy(() => import('./components/LibraryView').then(m => ({ default: m.LibraryView })));
import { ImageFocalAdjusterModal } from './components/ImageFocalAdjusterModal';
const TimelineView = lazy(() => import('./components/TimelineView').then(m => ({ default: m.TimelineView })));
const DocumentsView = lazy(() => import('./components/DocumentsView').then(m => ({ default: m.DocumentsView })));
const MapView = lazy(() => import('./components/MapView').then(m => ({ default: m.MapView })));
import { useProjects } from './utils/useProjects';
import { WorkspacePersistence, browserWorkspace, nativeWorkspace } from './utils/workspacePersistence';
import type { WorkspaceAdapter } from './utils/workspacePersistence';
import { validateProject, projectIntegrity, removeProjectCards, type ProjectIssue } from './utils/projectValidation';
import { documentDrafts } from './utils/documentDrafts';
import { ProjectIssuesNotice } from './components/ProjectIssuesNotice';
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
  openWorkspaceFolderDialog,
} from './utils/tauriStorage';
import { ConfirmModal } from './components/ConfirmModal';
import type { ConfirmModalConfig } from './components/ConfirmModal';
import { useLanguage } from './i18n/useLanguage';


const STORAGE_THEME_KEY = 'worlddeck_theme_v1';

export const App: React.FC = () => {
  const { language, t } = useLanguage();
  useModalAccessibility(language);

  // Theme State
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    document.body.className = `theme-${currentTheme}`;
    try {
      localStorage.setItem(STORAGE_THEME_KEY, currentTheme);
    } catch {}
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
  const [browserWorkspaceId, setBrowserWorkspaceId] = useState<string>();
  const [localDirectoryName, setLocalDirectoryName] = useState<string | null>(null);
  const [needDirectoryPermission, setNeedDirectoryPermission] = useState<boolean>(false);

  // Worlds & Active World State (Starts empty until folder is loaded)
  const projects = useProjects();
  const {worlds,activeWorldId} = projects.state;
  const setActiveWorldId = useStableEvent((action: React.SetStateAction<string>) => {
    projects.send({type:'select',id:typeof action === 'function'?action(projects.stateRef.current.activeWorldId):action});
  });

  // UI State initialized from workspace preferences
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadWorkspacePreferences().viewMode || 'canvas');
  const [activeCanvasId, setActiveCanvasId] = useState<string>('default');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => loadWorkspacePreferences().isSidebarOpen);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CardCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleToggleSidebar = useStableEvent(() => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      saveWorkspacePreferences({ isSidebarOpen: next });
      return next;
    });
  });

  const handleViewModeChange = async (mode: ViewMode) => {
    if (!await documentDrafts.flush()) return;
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
  const [pendingMapPin, setPendingMapPin] = useState<{
    mapId: string;
    x: number;
    y: number;
    color?: string;
  } | null>(null);
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
  const worldsRef = projects.worldsRef;
  const persistence = useRef(new WorkspacePersistence()).current;
  const adapter = useMemo<WorkspaceAdapter | null>(() => {
    if (isTauriAvailable() && selectedWorkspacePath) return nativeWorkspace(selectedWorkspacePath);
    if (localDirectoryHandle && !needDirectoryPermission) return browserWorkspace(localDirectoryHandle,browserWorkspaceId);
    return null;
  }, [selectedWorkspacePath, localDirectoryHandle, needDirectoryPermission,browserWorkspaceId]);
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  useEffect(() => persistence.subscribe(() => {
    setSaveStatus(persistence.failures.length ? 'error' : persistence.pendingCount ? 'saving' : 'saved');
  }), [persistence]);
  const [loadIssues, setLoadIssues] = useState<ProjectIssue[]>([]);
  const readWorkspace = useStableEvent(async (target: WorkspaceAdapter) => {
    const report = await target.load();
    setLoadIssues(report.issues.filter(issue => issue.code !== 'broken_reference' && issue.code !== 'map_cycle'));
    return report.projects;
  });
  const loadWorlds = useStableEvent((worlds: WorldProject[]) => { projects.send({type:'load',worlds}); });
  const persistChanges = (previous: WorldProject[],next: WorldProject[]) => {
    const target = adapterRef.current;
    return Promise.allSettled(next.filter(project => project !== previous.find(p => p.id === project.id)).map(project => {
      if (!target) return Promise.reject(new Error('No workspace'));
      return persistence.save(target,project).then(acknowledgement => {
        if (adapterRef.current?.id === target.id) projects.send({type:'ack',acknowledgement});
        return acknowledgement;
      });
    }));
  };
  const setWorlds = (action: React.SetStateAction<WorldProject[]>,transactionId?: string) => {
    const previous = worldsRef.current, target = adapterRef.current;
    const proposed = typeof action === 'function' ? action(previous) : action;
    const available = proposed.map(project => target && persistence.isDeleting(target.id,project.id)
      ? previous.find(p=>p.id===project.id) || project : project);
    const next = projects.send({type:'replace',worlds:available,transactionId}).worlds;
    return persistChanges(previous,next);
  };
  const flushWorkspace = useCallback(async () => await documentDrafts.flush() && await persistence.flush(), [persistence]);
  const [mapFocus, setMapFocus] = useState<{ mapId: string; pinId?: string; token: number }>();
  const [documentFocus, setDocumentFocus] = useState<string>();
  const [timelineFocus, setTimelineFocus] = useState<string>();

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
            const projects = await readWorkspace(nativeWorkspace(savedFolderPath));
            if (projects && projects.length > 0) {
              setSelectedWorkspacePath(savedFolderPath);
              setLocalDirectoryName(savedFolderPath.split(/[/\\]/).pop() || 'Workspace');
              loadWorlds(projects);
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
            const permission = await (handle as FileSystemDirectoryHandle & { queryPermission(options: { mode: string }): Promise<PermissionState> }).queryPermission(options);
            if (permission === 'granted') {
              setLocalDirectoryHandle(handle);
              setLocalDirectoryName(handle.name);
              const browserId = await getDirectoryWorkspaceId(handle);
              setBrowserWorkspaceId(browserId);
              const projects = await readWorkspace(browserWorkspace(handle,browserId));
              if (projects.length > 0) {
                loadWorlds(projects);
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
  }, [setActiveWorldId, loadWorlds, readWorkspace]);

  // Derived Active World
  const activeWorld = useMemo(() => (worlds || []).filter(Boolean).find((w) => w && w.id === activeWorldId) || (worlds || []).filter(Boolean)[0] || (
    selectedWorkspacePath
      ? {
          schemaVersion: 1 as const,
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
  ), [worlds, activeWorldId, selectedWorkspacePath, localDirectoryName]);

  // Derived active canvas cards and connections
  const activeWorldCanvases = activeWorld.canvases && activeWorld.canvases.length > 0
    ? activeWorld.canvases
    : [{ id: 'default', name: 'Kanvas Utama', createdAt: Date.now() }];

  const activeCanvasCards = useMemo(() => activeWorld.cards.filter(c=>isCardOnCanvas(c,activeCanvasId)).map(c=>{
    const pos = getCardPositionOnCanvas(c,activeCanvasId);
    return pos.x===c.x && pos.y===c.y ? c : {...c,x:pos.x,y:pos.y};
  }), [activeWorld.cards,activeCanvasId]);
  const activeCanvasConnections = useMemo(() => {
    const ids = new Set(activeCanvasCards.map(c=>c.id));
    return activeWorld.connections.filter(c=>ids.has(c.sourceId) && ids.has(c.targetId));
  }, [activeWorld.connections,activeCanvasCards]);

  // Auto save activeWorldId to LocalStorage
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('worlddeck_active_id_v2', activeWorldId);
  }, [activeWorldId, isLoaded]);

  const isSwitchingFolderRef = useRef<boolean>(false);

  // Loading does not enqueue writes. Only explicit project mutations are persisted.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      documentDrafts.backupAll();
      if (documentDrafts.dirty || persistence.pendingCount || persistence.failures.length) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [persistence]);
  useEffect(() => {
    if (!isTauriAvailable()) return;
    let disposed = false;
    let closing = false;
    let unlisten: (() => void) | undefined;
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      const stop = await win.onCloseRequested(async event => {
        if (closing) return;
        event.preventDefault();
        if (await flushWorkspace() && !disposed) { closing = true; await win.close(); }
      });
      if (disposed) stop(); else unlisten = stop;
    }).catch(error => console.warn('Close handler unavailable:', error));
    return () => { disposed = true; unlisten?.(); };
  }, [flushWorkspace]);

  // Create New Project explicitly in current workspace folder
  const handleCreateProjectInFolder = async (name: string, description: string) => {
    if (!await documentDrafts.flush()) return;
    const newProject: WorldProject = {
      schemaVersion: 1,
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
      await setWorlds(prev => [...prev, newProject]);
      setActiveWorldId(newProject.id);
    } else if (localDirectoryHandle) {
      await setWorlds(prev => [...prev, newProject]);
      setActiveWorldId(newProject.id);
    }
  };

  // Flush captured targets before changing workspace; load before replacing state.
  const handleSelectWorkspaceDirectory = async () => {
    if (!await flushWorkspace()) return;
    try {
      if (isTauriAvailable()) {
        const folderPath = await openWorkspaceFolderDialog();
        if (!folderPath) return;
        const projects = await readWorkspace(nativeWorkspace(folderPath));
        isSwitchingFolderRef.current = true;
        setSelectedWorkspacePath(folderPath);
        setLocalDirectoryHandle(null);
        setLocalDirectoryName(folderPath.split(/[/\\]/).pop() || 'Workspace');
        localStorage.setItem('worlddeck_selected_workspace_path', folderPath);
        loadWorlds(projects);
        setActiveWorldId(projects[0]?.id || '');
        if (!projects.length) setShowWorldManager(true);
      } else {
        if (!('showDirectoryPicker' in window)) {
          showAlertModal(language === 'en' ? 'Browser Unsupported' : 'Browser Tidak Didukung',
            language === 'en' ? 'Use a browser supporting local folder access.' : 'Gunakan browser yang mendukung akses folder lokal.', 'warning');
          return;
        }
        const handle = await (window as Window & { showDirectoryPicker(options: { mode: 'readwrite' }): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' });
        const browserId = await getDirectoryWorkspaceId(handle);
        setBrowserWorkspaceId(browserId);
        const projects = await readWorkspace(browserWorkspace(handle,browserId));
        isSwitchingFolderRef.current = true;
        await saveLocalFileHandle(handle);
        setSelectedWorkspacePath(null);
        setLocalDirectoryHandle(handle);
        setLocalDirectoryName(handle.name);
        setNeedDirectoryPermission(false);
        loadWorlds(projects);
        setActiveWorldId(projects[0]?.id || '');
        if (!projects.length) setShowWorldManager(true);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        showAlertModal(language === 'en' ? 'Failed to Open Folder' : 'Gagal Membuka Folder',
          language === 'en' ? 'The current workspace has been kept. Check folder access and try again.' : 'Workspace saat ini dipertahankan. Periksa akses folder dan coba lagi.', 'danger');
    } finally { isSwitchingFolderRef.current = false; }
  };

  // Project state, history and revisions are owned by the reducer.
  const updateActiveWorld = (updater: (project: WorldProject) => WorldProject,transactionId?: string) => {
    const id = projects.stateRef.current.activeWorldId;
    const current = worldsRef.current.find(w=>w.id===id), target = adapterRef.current;
    if (!current || (target && persistence.isDeleting(target.id,id))) return;
    const updated = updater(current);
    return setWorlds(prev=>prev.map(w=>w.id===id?updated:w),transactionId);
  };
  const history = projects.state.histories[activeWorldId];
  const canUndo = !!history && history.index>0;
  const canRedo = !!history && history.index<history.stack.length-1;
  const restoreHistory = async (offset: -1 | 1) => {
    if (!await documentDrafts.finish()) return;
    const id = projects.stateRef.current.activeWorldId, target = adapterRef.current;
    if (target && persistence.isDeleting(target.id,id)) return;
    const previous = worldsRef.current;
    const next = projects.send({type:'restore',offset,updatedAt:Date.now()}).worlds;
    await persistChanges(previous,next);
  };
  const handleUndo = useStableEvent(() => restoreHistory(-1));
  const handleRedo = useStableEvent(() => restoreHistory(1));

  // Hotkey Undo/Redo & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (e.target as HTMLElement).isContentEditable) return;

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
  }, [handleUndo, handleRedo, handleToggleSidebar]);

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
      cards: prev.cards.map((c) => (c.id === id ? { ...c, width, height, imageHeight: c.imageHeight ? Math.min(c.imageHeight,Math.max(48,height-90)) : undefined } : c)),
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
      attributes: initialData?.attributes?.map(attribute => ({...attribute,id:generateId('attr')})) || [],
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
  const handleSaveTimeline = (tracks: TimelineTrack[], nodes: TimelineNode[], branches: TimelineBranch[]) => {
    updateActiveWorld((prev) => ({
      ...prev,
      timelineTracks: tracks,
      timelineNodes: nodes,
      timelineBranches: branches,
      updatedAt: Date.now(),
    }));
  };

  // Document Management Handlers
  const handleSaveDocument = async (updatedDoc: WorldDocument, transactionId?: string) => {
    const target = adapter, projectId = activeWorldId;
    if (!worldsRef.current.find(project => project.id === projectId)?.documents?.some(doc => doc.id === updatedDoc.id)) throw new Error('Document no longer exists');
    if (!target || adapterRef.current?.id !== target.id) throw new Error('Document workspace changed');
    const result = await setWorlds(worlds => worlds.map(prev => prev.id !== projectId ? prev : ({
      ...prev,
      documents:(prev.documents || []).some(d => d.id === updatedDoc.id)
        ? (prev.documents || []).map(d => d.id === updatedDoc.id ? updatedDoc : d)
        : [...(prev.documents || []),updatedDoc], updatedAt:Date.now(),
    })),transactionId);
    if (result && !result.length) {
      const current = worldsRef.current.find(p=>p.id===activeWorldId);
      if (current) return persistence.save(target,current);
    }
    const saved = result?.[0];
    if (!saved || saved.status === 'rejected') throw new Error('Document save failed');
    return saved.value;
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
      onConfirm: async () => {
        if (!await documentDrafts.finish()) return false;
        await updateActiveWorld((prev) => ({
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
      worldMaps: (prev.worldMaps || []).filter((m) => m.id !== mapId).map(m => ({ ...m, parentMapId: m.parentMapId === mapId ? undefined : m.parentMapId, pins: m.pins.map(p => p.targetMapId === mapId ? { ...p, targetMapId: undefined } : p) })),
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

  // Add New Location Card directly from Map Pin placement
  const handleCreateLocationPinCard = (mapId: string, x: number, y: number) => {
    const newCard: WorldCard = {
      id: generateId('card'),
      title: '',
      subtitle: '',
      category: 'location',
      summary: '',
      content: '',
      tags: [],
      attributes: [],
      x: 300,
      y: 300,
      canvasId: undefined,
      canvasIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setPendingMapPin({ mapId, x, y, color: '#0d99ff' });
    setEditingCard(newCard);
  };

  // Save Card from Editor
  const handleSaveCard = (updatedCard: WorldCard) => {
    updateActiveWorld((prev) => {
      let updatedMaps = prev.worldMaps || [];
      if (pendingMapPin) {
        const newPin: MapPin = {
          id: generateId('pin'),
          title: updatedCard.title.trim() || (language === 'en' ? 'New Location' : 'Lokasi Baru'),
          description: updatedCard.summary || '',
          cardId: updatedCard.id,
          x: pendingMapPin.x,
          y: pendingMapPin.y,
          color: pendingMapPin.color || '#0d99ff',
        };
        updatedMaps = updatedMaps.map((m) =>
          m.id === pendingMapPin.mapId
            ? { ...m, pins: [...m.pins, newPin], updatedAt: Date.now() }
            : m
        );
      } else {
        // Synchronize pin titles/descriptions with card updates
        updatedMaps = updatedMaps.map((m) => ({
          ...m,
          pins: m.pins.map((p) =>
            p.cardId === updatedCard.id
              ? { ...p, title: updatedCard.title || p.title, description: updatedCard.summary ?? p.description }
              : p
          ),
        }));
      }

      return {
        ...prev,
        updatedAt: Date.now(),
        cards: prev.cards.some(c => c.id === updatedCard.id) ? prev.cards.map((c) => (c.id === updatedCard.id ? updatedCard : c)) : [...prev.cards, updatedCard],
        worldMaps: updatedMaps,
      };
    });

    setPendingMapPin(null);
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

    updateActiveWorld(prev => removeProjectCards(prev, deleteIds));

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
    updateActiveWorld(prev => removeProjectCards(prev, [cardId]));
    if (selectedCardId === cardId) {
      setSelectedCardId(null);
    }
    setPendingMapPin(null);
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
  const handleCreateWorld = async (newWorld: WorldProject) => {
    if (!await documentDrafts.flush()) return;
    await setWorlds((prev) => [...prev, newWorld]);
    setActiveWorldId(newWorld.id);
  };

  const handleDeleteWorld = async (worldId: string) => {
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
      onConfirm: async () => {
        if (!await documentDrafts.flush()) return;
        const target = adapterRef.current;
        if (!target) return;
        try {
          await persistence.delete(target, worldId, () => {
            if (adapterRef.current?.id !== target.id) return;
            const remaining = worldsRef.current.filter(w => w.id !== worldId);
            projects.send({type:'replace',worlds:remaining});
            setActiveWorldId(current => current === worldId ? remaining[0]?.id || '' : current);
          });
        } catch { /* Retained in coordinator for retry; keep project visible. */ }
      },
    });
  };

  const handleDuplicateWorld = async (worldId: string) => {
    const target = worlds.find((w) => w.id === worldId);
    if (!target) return;

    const duplicated: WorldProject = {
      ...target,
      id: generateId('world'),
      name: `${target.name} ${t.documents.copySuffix}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await setWorlds((prev) => [...prev, duplicated]);

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

  const handleUpdateWorldInfo = async (worldId: string, name: string, description: string, author: string) => {
    await setWorlds((prev) =>
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
    reader.onload = async (event) => {
      if (!await documentDrafts.flush()) return;
      try {
        const validation = validateProject(JSON.parse(event.target?.result as string));
        const importedData = validation.project;
        if (importedData) {
          const newWorld: WorldProject = {
            ...importedData,
            id: generateId('world'),
            name: importedData.name || t.appPrompts.importedWorldDefault,
            updatedAt: Date.now(),
          };
          await setWorlds((prev) => [...prev, newWorld]);
          setActiveWorldId(newWorld.id);

          showAlertModal(
            t.appPrompts.worldImportSuccessTitle,
            `${t.appPrompts.worldImportSuccessDesc} ${newWorld.name}`,
            'success'
          );
        } else {
          setLoadIssues(validation.issues);
          showAlertModal(
            t.appPrompts.importFailedTitle,
            t.appPrompts.importFailedDesc,
            'danger'
          );
        }
      } catch {
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
    if (viewMode !== 'canvas') void handleViewModeChange('canvas');
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
        beforeClose={flushWorkspace}
      />

      {saveStatus === 'error' && <div role="alert" data-workspace-error className="fixed bottom-4 left-4 z-[300] rounded-xl border border-rose-500 bg-slate-900 p-3 text-sm text-white shadow-xl">
        {language === 'en' ? 'Workspace operation failed. Your data has been kept.' : 'Operasi workspace gagal. Data Anda tetap dipertahankan.'}
        <button className="ml-3 underline" onClick={() => { void persistence.retry(); }}>{language === 'en' ? 'Retry' : 'Coba lagi'}</button>
      </div>}
      <ProjectIssuesNotice issues={[...loadIssues, ...projectIntegrity(activeWorld)]} />
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
          <Suspense fallback={<div className="p-6" role="status">{language === 'en' ? 'Loading…' : 'Memuat…'}</div>}>
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
              key={`${adapter?.id}:${activeWorld.id}`}
              cards={activeWorld.cards}
              connections={activeWorld.connections}
              onCardClick={(card) => setReaderCardId(card.id)}
              focusNodeId={timelineFocus}
              activeWorldId={activeWorldId}
              timelineTracks={activeWorld.timelineTracks}
              timelineNodes={activeWorld.timelineNodes}
              timelineBranches={activeWorld.timelineBranches}
              onSaveTimeline={handleSaveTimeline}
            />
          )}

          {viewMode === 'documents' && (
            <DocumentsView
              key={`${adapter?.id}:${activeWorld.id}`}
              workspaceId={adapter?.id || 'unlinked'}
              projectId={activeWorld.id}
              focusDocumentId={documentFocus}
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
              key={activeWorld.id}
              projectId={activeWorld.id}
              focus={mapFocus}
              timelineNodes={activeWorld.timelineNodes || []}
              canUndo={canUndo} canRedo={canRedo} onUndo={handleUndo} onRedo={handleRedo}
              worldMaps={activeWorld.worldMaps || []}
              cards={activeWorld.cards}
              decks={activeWorld.decks || []}
              onSaveMap={handleSaveMap}
              onDeleteMap={handleDeleteMap}
              onOpenCard={(cardId) => setReaderCardId(cardId)}
              onEditCard={(card) => setEditingCard(card)}
              onCreatePinCard={handleCreateLocationPinCard}
            />
          )}
          </Suspense>
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
          onSelectWorld={async (id) => { if (await flushWorkspace()) setActiveWorldId(id); }}
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
        world={activeWorld}
        onOpenMap={(mapId, pinId) => { handleViewModeChange('map'); setMapFocus({ mapId, pinId, token: Date.now() }); }}
        onOpenDocument={id => { handleViewModeChange('documents'); setDocumentFocus(id); }}
        onOpenTimeline={id => { handleViewModeChange('timeline'); setTimelineFocus(id); }}
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
          onClose={() => {
            if (pendingMapPin && editingCard) {
              setPendingMapPin(null); setEditingCard(null);
            } else {
              setEditingCard(null);
            }
          }}
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

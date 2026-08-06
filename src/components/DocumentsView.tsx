import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { WorldDocument, WorldCard } from '../types';
import { CATEGORY_CONFIGS } from '../data/categoryConfig';
import { generateId } from '../utils/helpers';
import { isTauriAvailable, saveImageAsset } from '../utils/tauriStorage';
import * as Icons from 'lucide-react';

interface DocumentsViewProps {
  documents: WorldDocument[];
  cards: WorldCard[];
  onSaveDocument: (doc: WorldDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onCreateDocument: (doc: WorldDocument) => void;
  onOpenCard?: (card: WorldCard) => void;
  onCreateCard?: (card: WorldCard) => void;
}

const FONT_SIZES = [
  { label: 'Kecil (12px)', size: '12px', cmdSize: '2' },
  { label: 'Normal (16px)', size: '16px', cmdSize: '3' },
  { label: 'Sedang (20px)', size: '20px', cmdSize: '4' },
  { label: 'Besar (24px)', size: '24px', cmdSize: '5' },
  { label: 'Sangat Besar (32px)', size: '32px', cmdSize: '6' },
];

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  cards,
  onSaveDocument,
  onDeleteDocument,
  onCreateDocument,
  onOpenCard,
  onCreateCard,
}) => {
  const [activeDocId, setActiveDocId] = useState<string | null>(
    documents.length > 0 ? documents[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  // Sidebar Visibility State (Default Open)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showRefDrawer, setShowRefDrawer] = useState(false);
  const [selectedRefCard, setSelectedRefCard] = useState<WorldCard | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showOutline, setShowOutline] = useState(false);

  // Hovered Card State for Popover Preview
  const [hoveredCard, setHoveredCard] = useState<{
    card: WorldCard;
    rect: DOMRect;
  } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected Image State for Google Docs style alignment popover & resize handles
  const [selectedImage, setSelectedImage] = useState<{
    wrapper: HTMLElement;
    img: HTMLImageElement;
    mode: 'inline' | 'wrap-left' | 'wrap-right' | 'block';
    rect: DOMRect;
  } | null>(null);

  // Context Menu State for Right-Clicking Image
  const [imageContextMenu, setImageContextMenu] = useState<{
    x: number;
    y: number;
    wrapper: HTMLElement;
    img: HTMLImageElement;
    mode: 'inline' | 'wrap-left' | 'wrap-right' | 'block';
  } | null>(null);

  // Context Menu State for Right-Clicking Text / Editor Area
  const [editorContextMenu, setEditorContextMenu] = useState<{
    x: number;
    y: number;
    selectedText: string;
    showMentionSubmenu?: boolean;
  } | null>(null);

  // Context Menu State for Document Sidebar
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{
    x: number;
    y: number;
    targetDoc?: WorldDocument;
  } | null>(null);

  // Sorting Mode State for Document List in Sidebar
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated');

  // Inline Google Docs-style Crop State
  const [cropState, setCropState] = useState<{
    isActive: boolean;
    wrapper: HTMLElement;
    img: HTMLImageElement;
    rect: DOMRect;
    originalSrc: string;
    cropTop: number;
    cropBottom: number;
    cropLeft: number;
    cropRight: number;
  } | null>(null);

  // Save Notification Toast State
  const [showSaveToast, setShowSaveToast] = useState(false);

  // Workflow Mode State: 'viewing' (default when opening) vs 'editing'
  const [mode, setMode] = useState<'viewing' | 'editing'>('viewing');

  // Draft document title while editing
  const [draftTitle, setDraftTitle] = useState('');

  // Active Toolbar Format State Indicator (Google Docs Style)
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    bulletList: false,
    numberedList: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
    h1: false,
    h2: false,
    h3: false,
  });

  // Editable div reference for Google Docs style WYSIWYG
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);

  // Inline @ Mention Suggestion Popup State
  const [mentionState, setMentionState] = useState<{
    isOpen: boolean;
    query: string;
    x: number;
    y: number;
    selectedIndex: number;
  }>({
    isOpen: false,
    query: '',
    x: 0,
    y: 0,
    selectedIndex: 0,
  });

  // Active document object
  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) || null,
    [documents, activeDocId]
  );

  // When active document changes or mode switches to editing, sync content into contentEditable canvas
  useEffect(() => {
    if (activeDoc) {
      setDraftTitle(activeDoc.title || '');

      if (mode === 'editing' && editorRef.current) {
        editorRef.current.innerHTML = activeDoc.content || '<p><br/></p>';
        updateToolbarState();
      }
    }
  }, [activeDocId, mode]);

  // Update Toolbar Command Active Indicators
  const updateToolbarState = () => {
    try {
      if (document.queryCommandState) {
        const formatBlock = document.queryCommandValue('formatBlock').toLowerCase();
        setActiveFormats({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          strikethrough: document.queryCommandState('strikeThrough'),
          bulletList: document.queryCommandState('insertUnorderedList'),
          numberedList: document.queryCommandState('insertOrderedList'),
          alignLeft: document.queryCommandState('justifyLeft'),
          alignCenter: document.queryCommandState('justifyCenter'),
          alignRight: document.queryCommandState('justifyRight'),
          alignJustify: document.queryCommandState('justifyFull'),
          h1: formatBlock === 'h1',
          h2: formatBlock === 'h2',
          h3: formatBlock === 'h3',
        });
      }
    } catch (_err) {
      // ignore
    }
  };

  // Listen to Selection Change across Document for active toolbar updates
  useEffect(() => {
    const handleSelectionChange = () => {
      if (mode === 'editing') {
        updateToolbarState();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [mode]);

  // Filtered & Sorted documents list
  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = documents.filter((doc) => {
      return (
        !q ||
        doc.title.toLowerCase().includes(q) ||
        (doc.content && doc.content.toLowerCase().includes(q))
      );
    });

    if (sortBy === 'title') {
      return [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    return [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [documents, searchQuery, sortBy]);

  // Calculate Word Count
  const wordCount = useMemo(() => {
    if (!activeDoc) return 0;
    const rawText = (editorRef.current?.innerText || activeDoc.content || '').replace(/<[^>]*>/g, '');
    return rawText.trim().split(/\s+/).filter(Boolean).length;
  }, [activeDoc, mode]);

  // Mention Suggestions Filtered Cards
  const suggestedCards = useMemo(() => {
    if (!mentionState.isOpen) return [];
    const q = mentionState.query.toLowerCase();
    return cards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
    );
  }, [cards, mentionState.isOpen, mentionState.query]);

  // Calculate Backlinks (Cards mentioned in current active document)
  const mentionedCards = useMemo(() => {
    if (!activeDoc || !activeDoc.content) return [];
    const content = activeDoc.content;
    const foundIds = new Set<string>();

    const regex = /data-card-id="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      foundIds.add(match[1]);
    }

    cards.forEach((c) => {
      if (c.title && content.toLowerCase().includes(`@${c.title.toLowerCase()}`)) {
        foundIds.add(c.id);
      }
    });

    return cards.filter((c) => foundIds.has(c.id));
  }, [activeDoc, cards]);

  // Extract Outline Headings (H1, H2, H3) for Table of Contents
  const outlineItems = useMemo(() => {
    if (!activeDoc || !activeDoc.content) return [];
    const html = activeDoc.content;
    const regex = /<h([1-3])[^>]*>(.*?)<\/h[1-3]>/gi;
    const items: Array<{ id: string; text: string; level: number }> = [];
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = regex.exec(html)) !== null) {
      const level = parseInt(match[1], 10);
      const text = match[2].replace(/<[^>]*>/g, '').trim();
      if (text) {
        items.push({
          id: `heading-${index++}`,
          text,
          level,
        });
      }
    }
    return items;
  }, [activeDoc, mode]);

  // Smooth scroll to target heading in document
  const scrollToHeading = (idx: number) => {
    const editorEl = editorRef.current;
    const viewContainer = document.getElementById('doc-view-rendered-content');
    const targetContainer = mode === 'editing' ? editorEl : viewContainer;

    if (!targetContainer) return;
    const headings = targetContainer.querySelectorAll('h1, h2, h3');
    if (headings[idx]) {
      headings[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Hover Handlers for Card Mention Badges
  const handleBadgeMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const badge = target.closest('[data-card-id]') || target.closest('.card-mention-badge');
    if (badge) {
      const cardId = badge.getAttribute('data-card-id');
      if (cardId) {
        const found = cards.find((c) => c.id === cardId);
        if (found) {
          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
          const rect = badge.getBoundingClientRect();
          setHoveredCard({ card: found, rect });
          return;
        }
      }
    }
  };

  const handleBadgeMouseOut = (e: React.MouseEvent<HTMLDivElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget && (relatedTarget.closest('.card-hover-popover') || relatedTarget.closest('.card-mention-badge'))) {
      return;
    }
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCard(null);
    }, 300);
  };

  // Execute Rich Text Command (Google Docs Style)
  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    updateToolbarState();
  };

  // Insert HTML Snippet directly at cursor
  const insertHtmlAtCursor = (htmlSnippet: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertHTML', false, htmlSnippet);
    updateToolbarState();
  };

  // Handle Header Selection Direct Toggle
  const toggleHeader = (tag: 'h1' | 'h2' | 'h3' | 'p') => {
    if (tag === 'p') {
      execCmd('formatBlock', '<p>');
    } else {
      execCmd('formatBlock', `<${tag}>`);
    }
  };

  // Handle Font Size Selection
  const handleFontSizeChange = (sizeObj: typeof FONT_SIZES[0]) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    execCmd('fontSize', sizeObj.cmdSize);
  };

  // Keyboard Event Handler: Tab, Backspace, Ctrl+Z/Y/B/I/U Shortcuts & @ Mention Keyboard Navigation
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionState.isOpen && suggestedCards.length > 0) {
      const maxIdx = suggestedCards.length - 1;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionState((prev) => ({
          ...prev,
          selectedIndex: prev.selectedIndex >= maxIdx ? 0 : prev.selectedIndex + 1,
        }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionState((prev) => ({
          ...prev,
          selectedIndex: prev.selectedIndex <= 0 ? maxIdx : prev.selectedIndex - 1,
        }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const safeIdx = Math.min(mentionState.selectedIndex, maxIdx);
        const cardToInsert = suggestedCards[safeIdx] || suggestedCards[0];
        if (cardToInsert) {
          insertMentionCard(cardToInsert);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionState({ isOpen: false, query: '', x: 0, y: 0, selectedIndex: 0 });
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        execCmd('outdent');
      } else {
        execCmd('indent');
      }
      return;
    }

    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.isCollapsed && selection.anchorOffset === 0) {
        try {
          execCmd('outdent');
        } catch (_err) {
          // ignore
        }
      }
    }

    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          execCmd('redo');
        } else {
          execCmd('undo');
        }
      } else if (key === 'y') {
        e.preventDefault();
        execCmd('redo');
      } else if (key === 'b') {
        e.preventDefault();
        execCmd('bold');
      } else if (key === 'i') {
        e.preventDefault();
        execCmd('italic');
      } else if (key === 'u') {
        e.preventDefault();
        execCmd('underline');
      } else if (key === 's') {
        e.preventDefault();
        handleSaveDocument();
      }
    }
  };

  // Clear selected image options and context menus when switching mode or active document
  useEffect(() => {
    setSelectedImage(null);
    setImageContextMenu(null);
    setEditorContextMenu(null);
    setSidebarContextMenu(null);
    setCropState(null);
    setMentionState({ isOpen: false, query: '', x: 0, y: 0, selectedIndex: 0 });
  }, [activeDocId, mode]);

  // Ref tracking for clean auto-saving on unmount, window close, or refresh
  const modeRef = useRef(mode);
  const activeDocRef = useRef(activeDoc);
  const draftTitleRef = useRef(draftTitle);

  useEffect(() => {
    modeRef.current = mode;
    activeDocRef.current = activeDoc;
    draftTitleRef.current = draftTitle;
  });

  // Emergency fallback auto-save on component unmount
  useEffect(() => {
    return () => {
      if (modeRef.current === 'editing' && activeDocRef.current) {
        const finalContent = editorRef.current ? editorRef.current.innerHTML : activeDocRef.current.content;
        const updatedDoc: WorldDocument = {
          ...activeDocRef.current,
          title: draftTitleRef.current.trim() || 'Dokumen Tanpa Judul',
          content: finalContent,
          updatedAt: Date.now(),
        };
        onSaveDocument(updatedDoc);
        try {
          localStorage.removeItem(`worlddeck_draft_${activeDocRef.current.id}`);
        } catch (_err) {
          // ignore
        }
      }
    };
  }, []);

  // Emergency fallback auto-save on window close (Alt+F4/X button), browser tab refresh, or app termination
  useEffect(() => {
    const handleEmergencySave = () => {
      if (modeRef.current === 'editing' && activeDocRef.current) {
        const finalContent = editorRef.current ? editorRef.current.innerHTML : activeDocRef.current.content;
        const updatedDoc: WorldDocument = {
          ...activeDocRef.current,
          title: draftTitleRef.current.trim() || 'Dokumen Tanpa Judul',
          content: finalContent,
          updatedAt: Date.now(),
        };
        onSaveDocument(updatedDoc);
        try {
          localStorage.setItem(`worlddeck_draft_${activeDocRef.current.id}`, JSON.stringify(updatedDoc));
        } catch (_err) {
          // ignore
        }
      }
    };

    window.addEventListener('beforeunload', handleEmergencySave);
    window.addEventListener('pagehide', handleEmergencySave);
    return () => {
      window.removeEventListener('beforeunload', handleEmergencySave);
      window.removeEventListener('pagehide', handleEmergencySave);
    };
  }, []);

  // Periodic draft backup to localStorage every 5s while in editing mode (crash protection)
  useEffect(() => {
    if (mode !== 'editing' || !activeDoc) return;

    const intervalId = setInterval(() => {
      if (editorRef.current && activeDocRef.current) {
        const currentContent = editorRef.current.innerHTML;
        const currentTitle = draftTitleRef.current.trim() || 'Dokumen Tanpa Judul';
        const draftData: WorldDocument = {
          ...activeDocRef.current,
          title: currentTitle,
          content: currentContent,
          updatedAt: Date.now(),
        };
        try {
          localStorage.setItem(`worlddeck_draft_${activeDocRef.current.id}`, JSON.stringify(draftData));
        } catch (_err) {
          // ignore
        }
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [mode, activeDocId]);

  // Restore draft backup if app was abruptly killed or crashed during editing
  useEffect(() => {
    if (activeDoc) {
      try {
        const savedDraftRaw = localStorage.getItem(`worlddeck_draft_${activeDoc.id}`);
        if (savedDraftRaw) {
          const savedDraft: WorldDocument = JSON.parse(savedDraftRaw);
          if (savedDraft && savedDraft.updatedAt > activeDoc.updatedAt) {
            onSaveDocument(savedDraft);
            setDraftTitle(savedDraft.title);
            if (editorRef.current) {
              editorRef.current.innerHTML = savedDraft.content;
            }
          }
          localStorage.removeItem(`worlddeck_draft_${activeDoc.id}`);
        }
      } catch (_err) {
        // ignore
      }
    }
  }, [activeDocId]);

  // Close context menu on document click & scroll
  useEffect(() => {
    const handleCloseMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.doc-image-context-menu') &&
        !target.closest('.doc-text-context-menu') &&
        !target.closest('.doc-sidebar-context-menu')
      ) {
        setImageContextMenu(null);
        setEditorContextMenu(null);
        setSidebarContextMenu(null);
      }
    };

    const handleScrollClose = () => {
      setImageContextMenu(null);
      setEditorContextMenu(null);
      setSidebarContextMenu(null);
    };

    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('scroll', handleScrollClose, true);
    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('scroll', handleScrollClose, true);
    };
  }, []);

  // Auto-sync selectedImage rect position and dimensions with actual image DOM node
  useEffect(() => {
    if (!selectedImage) return;

    const updateRect = () => {
      if (!selectedImage.img || !document.body.contains(selectedImage.img)) {
        setSelectedImage(null);
        return;
      }
      const currentRect = selectedImage.img.getBoundingClientRect();
      setSelectedImage((prev) => {
        if (!prev) return null;
        if (
          Math.abs(prev.rect.top - currentRect.top) > 0.5 ||
          Math.abs(prev.rect.left - currentRect.left) > 0.5 ||
          Math.abs(prev.rect.width - currentRect.width) > 0.5 ||
          Math.abs(prev.rect.height - currentRect.height) > 0.5
        ) {
          return { ...prev, rect: currentRect };
        }
        return prev;
      });
    };

    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    const editorEl = editorRef.current;
    if (editorEl) {
      editorEl.addEventListener('dragend', updateRect);
      editorEl.addEventListener('drop', updateRect);
      editorEl.addEventListener('input', updateRect);
      editorEl.addEventListener('mouseup', updateRect);
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && selectedImage.img) {
      resizeObserver = new ResizeObserver(() => {
        updateRect();
      });
      resizeObserver.observe(selectedImage.img);
      if (selectedImage.wrapper) {
        resizeObserver.observe(selectedImage.wrapper);
      }
    }

    let animationFrameId: number;
    const pollUntilStable = () => {
      updateRect();
      animationFrameId = requestAnimationFrame(pollUntilStable);
    };
    animationFrameId = requestAnimationFrame(pollUntilStable);

    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      if (editorEl) {
        editorEl.removeEventListener('dragend', updateRect);
        editorEl.removeEventListener('drop', updateRect);
        editorEl.removeEventListener('input', updateRect);
        editorEl.removeEventListener('mouseup', updateRect);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [selectedImage?.img, selectedImage?.wrapper]);

  // Intercept & Handle Image Drag-and-Drop to Move Image without Duplicating Node
  useEffect(() => {
    const editorEl = editorRef.current;
    if (!editorEl || mode !== 'editing') return;

    let draggedWrapper: HTMLElement | null = null;

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      const wrapper = target.closest('.doc-img-wrapper') as HTMLElement | null;
      if (wrapper) {
        draggedWrapper = wrapper;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/html', wrapper.outerHTML);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (draggedWrapper) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
      }
    };

    const handleDragEnd = () => {
      draggedWrapper = null;
    };

    const handleDrop = (e: DragEvent) => {
      if (draggedWrapper) {
        e.preventDefault();
        e.stopPropagation();

        let range: Range | null = null;
        if (document.caretRangeFromPoint) {
          range = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if ((document as any).caretPositionFromPoint) {
          const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
          if (pos) {
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.collapse(true);
          }
        }

        const sourceWrapper = draggedWrapper;
        draggedWrapper = null;

        if (range && sourceWrapper) {
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          range.insertNode(sourceWrapper);
        }

        setSelectedImage(null);
        updateToolbarState();
      }
    };

    editorEl.addEventListener('dragstart', handleDragStart);
    editorEl.addEventListener('dragover', handleDragOver);
    editorEl.addEventListener('dragend', handleDragEnd);
    editorEl.addEventListener('drop', handleDrop);

    return () => {
      editorEl.removeEventListener('dragstart', handleDragStart);
      editorEl.removeEventListener('dragover', handleDragOver);
      editorEl.removeEventListener('dragend', handleDragEnd);
      editorEl.removeEventListener('drop', handleDrop);
    };
  }, [mode]);

  // Auto-sync cropState rect position and dimensions with actual image DOM node
  useEffect(() => {
    if (!cropState) return;

    const updateCropRect = () => {
      if (!cropState.img || !document.body.contains(cropState.img)) {
        setCropState(null);
        return;
      }
      const currentRect = cropState.img.getBoundingClientRect();
      setCropState((prev) => {
        if (!prev) return null;
        if (
          Math.abs(prev.rect.top - currentRect.top) > 0.5 ||
          Math.abs(prev.rect.left - currentRect.left) > 0.5 ||
          Math.abs(prev.rect.width - currentRect.width) > 0.5 ||
          Math.abs(prev.rect.height - currentRect.height) > 0.5
        ) {
          return { ...prev, rect: currentRect };
        }
        return prev;
      });
    };

    window.addEventListener('scroll', updateCropRect, true);
    window.addEventListener('resize', updateCropRect);

    let animationFrameId: number;
    const poll = () => {
      updateCropRect();
      animationFrameId = requestAnimationFrame(poll);
    };
    animationFrameId = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener('scroll', updateCropRect, true);
      window.removeEventListener('resize', updateCropRect);
      cancelAnimationFrame(animationFrameId);
    };
  }, [cropState?.img]);

  // Handle Image Click & Placement Detection (Google Docs style - Editing mode only)
  const handleDocumentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Check if clicked badge for card preview
    const cardId = target.getAttribute('data-card-id');
    if (cardId && onOpenCard) {
      const found = cards.find((c) => c.id === cardId);
      if (found) onOpenCard(found);
    }

    // Image placement options popover is only active in editing mode
    if (mode !== 'editing') {
      setSelectedImage(null);
      return;
    }

    // Check if clicked directly on image or image wrapper
    const isImg = target.tagName === 'IMG';
    const wrapper = target.closest('.doc-img-wrapper') as HTMLElement | null;

    if (isImg || wrapper) {
      const activeImg = (isImg ? target : wrapper?.querySelector('img')) as HTMLImageElement | null;
      const activeWrapper = wrapper || (activeImg ? activeImg.closest('.doc-img-wrapper') as HTMLElement : null) || (activeImg ? activeImg.parentElement : null);

      if (activeImg && activeWrapper) {
        const rect = activeImg.getBoundingClientRect();
        let imgAlignMode: 'inline' | 'wrap-left' | 'wrap-right' | 'block' = 'inline';
        if (activeWrapper.classList.contains('img-mode-wrap-left') || activeWrapper.style.float === 'left') {
          imgAlignMode = 'wrap-left';
        } else if (activeWrapper.classList.contains('img-mode-wrap-right') || activeWrapper.style.float === 'right') {
          imgAlignMode = 'wrap-right';
        } else if (activeWrapper.classList.contains('img-mode-block') || activeWrapper.style.display === 'block') {
          imgAlignMode = 'block';
        }
        setSelectedImage({ wrapper: activeWrapper, img: activeImg, mode: imgAlignMode, rect });
        return;
      }
    }

    if (!target.closest('.doc-image-toolbar-popover') && !target.closest('.doc-image-resize-handle')) {
      setSelectedImage(null);
    }
  };

  // Image Resize Drag Handler
  const handleImageResizeStart = (e: React.MouseEvent, handleType: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImage) return;

    const { wrapper, img } = selectedImage;
    const startX = e.clientX;
    const startWidth = img.getBoundingClientRect().width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth;

      if (handleType === 'bottom-right' || handleType === 'top-right') {
        newWidth = startWidth + deltaX;
      } else {
        newWidth = startWidth - deltaX;
      }

      newWidth = Math.max(120, Math.min(850, newWidth));

      img.style.width = `${newWidth}px`;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      wrapper.style.width = selectedImage.mode === 'inline' ? 'auto' : `${newWidth}px`;

      const newRect = img.getBoundingClientRect();
      setSelectedImage((prev) => (prev ? { ...prev, rect: newRect } : null));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (img && document.body.contains(img)) {
        const finalRect = img.getBoundingClientRect();
        setSelectedImage((prev) => (prev ? { ...prev, rect: finalRect } : null));
      }
      updateToolbarState();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle Right-Click Context Menu on Image or Text Editor
  const handleContextMenuDetect = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'editing') return;

    const target = e.target as HTMLElement;
    const isImg = target.tagName === 'IMG';
    const wrapper = target.closest('.doc-img-wrapper') as HTMLElement | null;

    if (isImg || wrapper) {
      const activeImg = (isImg ? target : wrapper?.querySelector('img')) as HTMLImageElement | null;
      const activeWrapper = wrapper || (activeImg ? activeImg.closest('.doc-img-wrapper') as HTMLElement : null) || (activeImg ? activeImg.parentElement : null);

      if (activeImg && activeWrapper) {
        e.preventDefault();
        e.stopPropagation();
        const rect = activeImg.getBoundingClientRect();
        let imgAlignMode: 'inline' | 'wrap-left' | 'wrap-right' | 'block' = 'inline';
        if (activeWrapper.classList.contains('img-mode-wrap-left') || activeWrapper.style.float === 'left') {
          imgAlignMode = 'wrap-left';
        } else if (activeWrapper.classList.contains('img-mode-wrap-right') || activeWrapper.style.float === 'right') {
          imgAlignMode = 'wrap-right';
        } else if (activeWrapper.classList.contains('img-mode-block') || activeWrapper.style.display === 'block') {
          imgAlignMode = 'block';
        }

        const imgMenuWidth = 260;
        const imgMenuHeight = 440;
        const imgX = e.clientX + imgMenuWidth > window.innerWidth ? Math.max(10, e.clientX - imgMenuWidth) : Math.max(10, e.clientX);
        const imgY = e.clientY + imgMenuHeight > window.innerHeight ? Math.max(10, e.clientY - imgMenuHeight) : Math.max(10, e.clientY);

        setSelectedImage({ wrapper: activeWrapper, img: activeImg, mode: imgAlignMode, rect });
        setImageContextMenu({
          x: imgX,
          y: imgY,
          wrapper: activeWrapper,
          img: activeImg,
          mode: imgAlignMode,
        });
        setEditorContextMenu(null);
      }
    } else {
      e.preventDefault();
      e.stopPropagation();
      const selText = window.getSelection()?.toString().trim() || '';
      setImageContextMenu(null);

      const textMenuWidth = 270;
      const textMenuHeight = 380;
      const textX = e.clientX + textMenuWidth > window.innerWidth ? Math.max(10, e.clientX - textMenuWidth) : Math.max(10, e.clientX);
      const textY = e.clientY + textMenuHeight > window.innerHeight ? Math.max(10, e.clientY - textMenuHeight) : Math.max(10, e.clientY);

      setEditorContextMenu({
        x: textX,
        y: textY,
        selectedText: selText,
      });
    }
  };

  // Create New Card from Selected Text in Editor
  const handleCreateCardFromSelectedText = (selectedText: string) => {
    if (!selectedText.trim()) return;
    const title = selectedText.length > 40 ? `${selectedText.substring(0, 40)}...` : selectedText;
    const newCard: WorldCard = {
      id: generateId('card'),
      title,
      subtitle: 'Dibuat dari teks naskah',
      category: 'character',
      summary: selectedText,
      content: `<p>${selectedText}</p>`,
      tags: ['naskah'],
      attributes: [],
      x: 300,
      y: 300,
      canvasId: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (onCreateCard) {
      onCreateCard(newCard);
    }
    insertMentionCard(newCard);
  };

  // Inline Crop Drag Handler (Google Docs style 8 handles)
  const handleInlineCropDragStart = (
    e: React.MouseEvent,
    handleType: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropState) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const { rect, cropTop: initialTop, cropBottom: initialBottom, cropLeft: initialLeft, cropRight: initialRight } = cropState;

    const imgW = rect.width;
    const imgH = rect.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newTop = initialTop;
      let newBottom = initialBottom;
      let newLeft = initialLeft;
      let newRight = initialRight;

      const deltaXPercent = (deltaX / (imgW || 1)) * 100;
      const deltaYPercent = (deltaY / (imgH || 1)) * 100;

      if (handleType.includes('top')) {
        newTop = Math.max(0, Math.min(80 - initialBottom, initialTop + deltaYPercent));
      }
      if (handleType.includes('bottom')) {
        newBottom = Math.max(0, Math.min(80 - initialTop, initialBottom - deltaYPercent));
      }
      if (handleType.includes('left')) {
        newLeft = Math.max(0, Math.min(80 - initialRight, initialLeft + deltaXPercent));
      }
      if (handleType.includes('right')) {
        newRight = Math.max(0, Math.min(80 - initialLeft, initialRight - deltaXPercent));
      }

      setCropState((prev) => (prev ? {
        ...prev,
        cropTop: newTop,
        cropBottom: newBottom,
        cropLeft: newLeft,
        cropRight: newRight,
      } : null));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Commit Cropping Non-Destructively & Update Display Image Bounds
  const commitInlineCrop = () => {
    if (!cropState) return;
    const { img, wrapper, originalSrc, cropTop, cropBottom, cropLeft, cropRight } = cropState;

    const topVal = Math.max(0, Math.round(cropTop * 100) / 100);
    const bottomVal = Math.max(0, Math.round(cropBottom * 100) / 100);
    const leftVal = Math.max(0, Math.round(cropLeft * 100) / 100);
    const rightVal = Math.max(0, Math.round(cropRight * 100) / 100);

    img.setAttribute('data-original-src', originalSrc);
    img.setAttribute('data-crop-top', String(topVal));
    img.setAttribute('data-crop-bottom', String(bottomVal));
    img.setAttribute('data-crop-left', String(leftVal));
    img.setAttribute('data-crop-right', String(rightVal));
    img.style.clipPath = 'none';

    if (topVal <= 0.1 && bottomVal <= 0.1 && leftVal <= 0.1 && rightVal <= 0.1) {
      img.src = originalSrc;
      img.style.width = 'auto';
      if (wrapper) wrapper.style.width = 'auto';
      updateToolbarState();
      setCropState(null);
      return;
    }

    const tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.onload = () => {
      const naturalW = tempImg.naturalWidth || tempImg.width;
      const naturalH = tempImg.naturalHeight || tempImg.height;

      const cropX = Math.round((leftVal / 100) * naturalW);
      const cropY = Math.round((topVal / 100) * naturalH);
      const cropW = Math.max(10, Math.round(((100 - leftVal - rightVal) / 100) * naturalW));
      const cropH = Math.max(10, Math.round(((100 - topVal - bottomVal) / 100) * naturalH));

      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(tempImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        img.src = canvas.toDataURL('image/png');
        updateToolbarState();
      }
      setCropState(null);
    };
    tempImg.src = originalSrc;
  };

  // Reset / Restore Crop Completely
  const resetImageCrop = (img: HTMLImageElement) => {
    const originalSrc = img.getAttribute('data-original-src');
    if (originalSrc) {
      img.src = originalSrc;
    }
    img.removeAttribute('data-crop-top');
    img.removeAttribute('data-crop-bottom');
    img.removeAttribute('data-crop-left');
    img.removeAttribute('data-crop-right');
    img.style.clipPath = 'none';
    img.style.width = 'auto';
    const wrapper = img.closest('.doc-img-wrapper') as HTMLElement;
    if (wrapper) {
      wrapper.style.width = 'auto';
    }
    updateToolbarState();
  };

  const applyImageMode = (mode: 'inline' | 'wrap-left' | 'wrap-right' | 'block') => {
    if (!selectedImage) return;
    const { wrapper } = selectedImage;
    wrapper.classList.remove('img-mode-inline', 'img-mode-wrap-left', 'img-mode-wrap-right', 'img-mode-block');

    if (mode === 'inline') {
      wrapper.classList.add('img-mode-inline');
      wrapper.style.float = 'none';
      wrapper.style.display = 'inline-block';
      wrapper.style.verticalAlign = 'middle';
      wrapper.style.margin = '0.25rem 0.5rem';
      wrapper.style.clear = 'none';
      wrapper.style.maxWidth = '100%';
    } else if (mode === 'wrap-left') {
      wrapper.classList.add('img-mode-wrap-left');
      wrapper.style.float = 'left';
      wrapper.style.display = 'inline-block';
      wrapper.style.margin = '0.25rem 1rem 0.5rem 0';
      wrapper.style.clear = 'none';
      wrapper.style.maxWidth = '45%';
    } else if (mode === 'wrap-right') {
      wrapper.classList.add('img-mode-wrap-right');
      wrapper.style.float = 'right';
      wrapper.style.display = 'inline-block';
      wrapper.style.margin = '0.25rem 0 0.5rem 1rem';
      wrapper.style.clear = 'none';
      wrapper.style.maxWidth = '45%';
    } else if (mode === 'block') {
      wrapper.classList.add('img-mode-block');
      wrapper.style.float = 'none';
      wrapper.style.display = 'block';
      wrapper.style.margin = '1.5rem auto';
      wrapper.style.textAlign = 'center';
      wrapper.style.clear = 'both';
      wrapper.style.maxWidth = '100%';
    }

    const rect = selectedImage.img.getBoundingClientRect();
    setSelectedImage({ wrapper, img: selectedImage.img, mode, rect });
    updateToolbarState();
  };

  const applyImageSizePreset = (preset: '25%' | '50%' | '100%' | 'reset') => {
    if (!selectedImage) return;
    const { wrapper, img } = selectedImage;
    if (preset === 'reset') {
      wrapper.style.width = 'auto';
      wrapper.style.maxWidth = '100%';
      img.style.width = 'auto';
      img.style.maxHeight = '450px';
    } else {
      wrapper.style.width = preset;
      img.style.width = '100%';
      img.style.maxHeight = 'none';
    }
    const rect = img.getBoundingClientRect();
    setSelectedImage({ ...selectedImage, rect });
    updateToolbarState();
  };

  const toggleImageCaption = () => {
    if (!selectedImage) return;
    const { wrapper } = selectedImage;
    let caption = wrapper.querySelector('figcaption');
    if (caption) {
      caption.remove();
    } else {
      caption = document.createElement('figcaption');
      caption.className = 'doc-img-caption text-center text-xs italic text-slate-400 mt-1 focus:outline-none border-b border-transparent focus:border-[#0d99ff]/50 py-0.5';
      caption.setAttribute('contenteditable', 'true');
      caption.innerText = 'Tulis keterangan gambar di sini...';
      wrapper.appendChild(caption);
      setTimeout(() => {
        caption?.focus();
      }, 50);
    }
    updateToolbarState();
  };

  const duplicateSelectedImage = () => {
    if (!selectedImage) return;
    const clone = selectedImage.wrapper.cloneNode(true) as HTMLElement;
    selectedImage.wrapper.after(clone);
    updateToolbarState();
  };

  const downloadSelectedImage = () => {
    if (!selectedImage) return;
    const a = document.createElement('a');
    a.href = selectedImage.img.src;
    a.download = `gambar-naskah-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReplaceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedImage) return;

    if (isTauriAvailable()) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        const savedUrl = await saveImageAsset(base64Data, file.name);
        if (savedUrl) {
          selectedImage.img.src = savedUrl;
          selectedImage.img.alt = file.name;
          updateToolbarState();
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        selectedImage.img.src = base64Data;
        selectedImage.img.alt = file.name;
        updateToolbarState();
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const deleteSelectedImage = () => {
    if (!selectedImage) return;
    selectedImage.wrapper.remove();
    setSelectedImage(null);
    updateToolbarState();
  };

  // Handle Image Upload into ContentEditable Canvas (Clean Image, No Filename Text)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isTauriAvailable()) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        const savedUrl = await saveImageAsset(base64Data, file.name);
        if (savedUrl) {
          const imgHtml = `\u00A0<span class="doc-img-wrapper img-mode-inline select-none" contenteditable="false" style="display: inline-block; vertical-align: middle; margin: 0.25rem 0.5rem; float: none; clear: none;"><img src="${savedUrl}" alt="${file.name}" class="max-h-[350px] rounded-xl border border-slate-700/60 shadow-md object-contain w-auto inline-block align-middle" /></span>\u00A0`;
          insertHtmlAtCursor(imgHtml);
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        const imgHtml = `\u00A0<span class="doc-img-wrapper img-mode-inline select-none" contenteditable="false" style="display: inline-block; vertical-align: middle; margin: 0.25rem 0.5rem; float: none; clear: none;"><img src="${base64Data}" alt="${file.name}" class="max-h-[350px] rounded-xl border border-slate-700/60 shadow-md object-contain w-auto inline-block align-middle" /></span>\u00A0`;
        insertHtmlAtCursor(imgHtml);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Handle Inline @ Mention in ContentEditable
  const handleEditorKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionState.isOpen && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      return;
    }

    updateToolbarState();
    const selection = window.getSelection();
    if (!selection || !selection.focusNode) return;

    const text = selection.focusNode.textContent || '';
    const cursorOffset = selection.focusOffset;
    const textBeforeCursor = text.substring(0, cursorOffset);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\u00A0' || lastAtIndex === 0) {
        const queryCandidate = textBeforeCursor.substring(lastAtIndex + 1);
        if (!queryCandidate.includes(' ') && !queryCandidate.includes('\u00A0')) {
          let cursorX = 100;
          let cursorY = 100;
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0).cloneRange();
            let rect = range.getBoundingClientRect();
            if ((rect.width === 0 && rect.height === 0) || (rect.top === 0 && rect.left === 0)) {
              const rects = range.getClientRects();
              if (rects.length > 0) {
                rect = rects[0];
              } else if (selection.focusNode.parentElement) {
                rect = selection.focusNode.parentElement.getBoundingClientRect();
              }
            }
            cursorX = Math.min(window.innerWidth - 300, Math.max(10, rect.left));
            cursorY = Math.min(window.innerHeight - 260, rect.bottom + 4);
          }

          const newQuery = queryCandidate.toLowerCase();
          setMentionState((prev) => ({
            isOpen: true,
            query: newQuery,
            x: cursorX,
            y: cursorY,
            selectedIndex: prev.query !== newQuery ? 0 : prev.selectedIndex,
          }));
          return;
        }
      }
    }

    if (mentionState.isOpen) {
      setMentionState({ isOpen: false, query: '', x: 0, y: 0, selectedIndex: 0 });
    }
  };

  // Insert Mentioned Card as Rich Pill Badge & Delete Typed @query Text
  const insertMentionCard = (card: WorldCard) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const focusNode = selection.focusNode;
      if (focusNode && focusNode.nodeType === Node.TEXT_NODE) {
        const text = focusNode.textContent || '';
        const offset = selection.focusOffset;
        const textBefore = text.substring(0, offset);
        const lastAtIndex = textBefore.lastIndexOf('@');
        if (lastAtIndex !== -1) {
          try {
            const range = document.createRange();
            range.setStart(focusNode, lastAtIndex);
            range.setEnd(focusNode, offset);
            range.deleteContents();
            selection.removeAllRanges();
            selection.addRange(range);
          } catch (_e) {
            // ignore range errors
          }
        }
      }
    }

    const badgeHtml = `<span contenteditable="false" data-card-id="${card.id}" class="card-mention-badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-semibold shadow-xs select-none cursor-pointer hover:bg-blue-500/30 transition-colors">@${card.title}</span>&nbsp;`;
    insertHtmlAtCursor(badgeHtml);
    setMentionState({ isOpen: false, query: '', x: 0, y: 0, selectedIndex: 0 });
  };

  // Handle Switching Active Document from Sidebar
  const handleSelectDoc = (docId: string) => {
    if (docId === activeDocId) return;

    if (mode === 'editing' && activeDoc) {
      const finalContent = editorRef.current ? editorRef.current.innerHTML : activeDoc.content;
      const updatedDoc: WorldDocument = {
        ...activeDoc,
        title: draftTitle.trim() || 'Dokumen Tanpa Judul',
        content: finalContent,
        updatedAt: Date.now(),
      };
      onSaveDocument(updatedDoc);
    }

    setSelectedImage(null);
    setImageContextMenu(null);
    setEditorContextMenu(null);
    setCropState(null);
    setMentionState({ isOpen: false, query: '', x: 0, y: 0, selectedIndex: 0 });
    setMode('viewing');
    setActiveDocId(docId);
  };

  // Create New Document
  const handleCreateDocument = () => {
    if (mode === 'editing' && activeDoc) {
      const finalContent = editorRef.current ? editorRef.current.innerHTML : activeDoc.content;
      const updatedDoc: WorldDocument = {
        ...activeDoc,
        title: draftTitle.trim() || 'Dokumen Tanpa Judul',
        content: finalContent,
        updatedAt: Date.now(),
      };
      onSaveDocument(updatedDoc);
    }

    setSelectedImage(null);
    setImageContextMenu(null);
    setEditorContextMenu(null);
    setCropState(null);
    setMentionState({ isOpen: false, query: '', x: 0, y: 0, selectedIndex: 0 });

    const newDoc: WorldDocument = {
      id: generateId('doc'),
      title: 'Dokumen Tanpa Judul',
      content: '<h2>Bab 1</h2><p>Mulai menulis cerita Anda di sini...</p>',
      category: 'story',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onCreateDocument(newDoc);
    setActiveDocId(newDoc.id);
    setDraftTitle(newDoc.title);
    setMode('editing');
  };

  // Save Document and switch to Viewing Mode
  const handleSaveDocument = () => {
    if (!activeDoc) return;
    const finalContent = editorRef.current ? editorRef.current.innerHTML : activeDoc.content;

    const updatedDoc: WorldDocument = {
      ...activeDoc,
      title: draftTitle.trim() || 'Dokumen Tanpa Judul',
      content: finalContent,
      updatedAt: Date.now(),
    };
    try {
      localStorage.removeItem(`worlddeck_draft_${activeDoc.id}`);
    } catch (_err) {
      // ignore
    }
    onSaveDocument(updatedDoc);
    setMode('viewing');
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2200);
  };

  // Global Keyboard Shortcut: Ctrl + S / Cmd + S to save document, Ctrl + \ to toggle sidebar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (mode === 'editing') {
          handleSaveDocument();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, activeDoc, draftTitle]);

  // Export Specific Markdown / HTML File
  const handleExportDocumentFor = (doc: WorldDocument) => {
    const content = doc.content || '';
    const blob = new Blob([content], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(doc.title || 'dokumen').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Duplicate Document
  const handleDuplicateDocument = (doc: WorldDocument) => {
    const newDoc: WorldDocument = {
      ...doc,
      id: generateId('doc'),
      title: `${doc.title || 'Dokumen'} (Salinan)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onCreateDocument(newDoc);
    handleSelectDoc(newDoc.id);
  };

  const canvasContainerWidthClass =
    showOutline && showRefDrawer
      ? 'max-w-2xl xl:max-w-3xl'
      : showOutline || showRefDrawer
      ? 'max-w-3xl xl:max-w-4xl'
      : 'max-w-4xl lg:max-w-5xl';

  return (
    <div className="flex-1 flex app-bg-main overflow-hidden app-text-main h-full font-sans select-none relative">
      {/* Hidden Image File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={replaceImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplaceImageUpload}
        className="hidden"
      />

      {/* Sidebar Toggle Floating Button when Closed */}
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-14 left-3 z-30 p-2 rounded-xl bg-[#1e1e1e] border border-[#383838] text-slate-300 hover:text-white shadow-xl hover:scale-105 transition-all cursor-pointer"
          title="Buka Sidebar Dokumen"
        >
          <Icons.PanelLeftOpen size={16} />
        </button>
      )}

      {/* ========================================================= */}
      {/* FIGMA-STYLE DARK LEFT SIDEBAR FOR DOCUMENTS */}
      {/* ========================================================= */}
      <aside
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setImageContextMenu(null);
          setEditorContextMenu(null);
          const sideMenuWidth = 230;
          const sideMenuHeight = 220;
          const sideX = e.clientX + sideMenuWidth > window.innerWidth ? Math.max(10, e.clientX - sideMenuWidth) : Math.max(10, e.clientX);
          const sideY = e.clientY + sideMenuHeight > window.innerHeight ? Math.max(10, e.clientY - sideMenuHeight) : Math.max(10, e.clientY);

          setSidebarContextMenu({
            x: sideX,
            y: sideY,
          });
        }}
        style={{ width: isSidebarOpen ? '280px' : '0px' }}
        className={`h-full bg-[#1e1e1e] border-r border-[#383838] flex flex-col shrink-0 z-20 transition-all duration-200 ease-in-out relative select-none overflow-hidden ${
          !isSidebarOpen ? 'border-none' : ''
        }`}
      >
        {/* Header & Hide Sidebar Toggle Button */}
        <div className="p-3.5 border-b border-[#383838] flex items-center justify-between bg-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-2">
            <Icons.FileText size={16} className="text-[#0d99ff]" />
            <span className="text-xs font-bold text-white tracking-tight">Naskah Dokumen</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#2c2c2c] text-slate-400 border border-[#383838]">
              {filteredDocs.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#383838] transition-colors cursor-pointer"
            title="Tutup Sidebar"
          >
            <Icons.PanelLeftClose size={15} />
          </button>
        </div>

        {/* Primary Create Button & Search Input */}
        <div className="p-3 border-b border-[#383838] bg-[#1e1e1e] space-y-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCreateDocument}
            className="w-full py-2 px-3 rounded-xl bg-[#0d99ff] hover:bg-[#0b85de] text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Icons.Plus size={15} strokeWidth={2.5} />
            <span>Buat Dokumen Baru</span>
          </button>

          <div className="relative">
            <Icons.Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari naskah / dokumen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-[#2c2c2c] border border-[#383838] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0d99ff] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <Icons.X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Clean Document List Grid */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-2 text-xs">
              <p>Belum ada dokumen naskah.</p>
              <button
                type="button"
                onClick={handleCreateDocument}
                className="text-[#0d99ff] hover:underline font-semibold"
              >
                + Tulis Naskah Baru
              </button>
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isActive = doc.id === activeDocId;
              const textSnippet = (doc.content || '').replace(/<[^>]*>/g, '').trim();
              const words = textSnippet.split(/\s+/).filter(Boolean).length;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => handleSelectDoc(doc.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setImageContextMenu(null);
                    setEditorContextMenu(null);
                    const itemMenuWidth = 230;
                    const itemMenuHeight = 260;
                    const itemX = e.clientX + itemMenuWidth > window.innerWidth ? Math.max(10, e.clientX - itemMenuWidth) : Math.max(10, e.clientX);
                    const itemY = e.clientY + itemMenuHeight > window.innerHeight ? Math.max(10, e.clientY - itemMenuHeight) : Math.max(10, e.clientY);

                    setSidebarContextMenu({
                      x: itemX,
                      y: itemY,
                      targetDoc: doc,
                    });
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer relative ${
                    isActive
                      ? 'bg-[#2c2c2c] border border-[#0d99ff] text-white ring-1 ring-[#0d99ff]/30 shadow-lg'
                      : 'bg-[#1e1e1e] border border-[#383838] text-slate-300 hover:text-white hover:bg-[#2c2c2c]/60'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#0d99ff] rounded-r-full" />
                  )}
                  <div className="truncate pr-2 pl-1">
                    <div className={`text-xs font-bold truncate ${isActive ? 'text-[#0d99ff]' : 'text-white group-hover:text-[#0d99ff] transition-colors'}`}>
                      {doc.title || 'Dokumen Tanpa Judul'}
                    </div>
                    <div className="text-[10px] font-mono mt-1 text-slate-400 flex items-center gap-2">
                      <span>{words} kata</span>
                    </div>
                  </div>
                  {isActive ? (
                    <Icons.FileText size={15} className="text-[#0d99ff] shrink-0" />
                  ) : (
                    <Icons.ChevronRight size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* FIGMA-STYLE RICH EDITOR WORKSPACE CONTAINER */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-[#2c2c2c]">
        {activeDoc ? (
          <>
            {/* Top Control Bar */}
            <div className="px-6 py-3 flex items-center justify-between text-xs text-white bg-[#1e1e1e] border-b border-[#383838] shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-extrabold text-white truncate max-w-md">
                  📄 {activeDoc.title || 'Dokumen Tanpa Judul'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOutline(!showOutline)}
                  className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showOutline
                      ? 'bg-[#0d99ff]/15 text-[#0d99ff] font-bold border border-[#0d99ff]/40'
                      : 'bg-[#2c2c2c] text-slate-300 hover:text-white border border-[#383838]'
                  }`}
                  title="Daftar Isi / Outline Naskah"
                >
                  <Icons.ListTree size={14} />
                  <span>Outline</span>
                  {outlineItems.length > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#0d99ff] text-white font-bold">
                      {outlineItems.length}
                    </span>
                  )}
                </button>

                {/* Primary Mode Button: VIEWING MODE VS EDITING MODE */}
                {mode === 'viewing' ? (
                  <button
                    type="button"
                    onClick={() => setMode('editing')}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#0d99ff] hover:bg-[#0b85de] transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Icons.Edit3 size={14} />
                    <span>Mode Edit</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSaveDocument}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Icons.Save size={14} />
                      <span>Simpan Naskah</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('viewing')}
                      className="px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white bg-[#2c2c2c] border border-[#383838] transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}

                {/* More Options Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-1.5 rounded-xl text-slate-300 hover:text-white bg-[#2c2c2c] border border-[#383838] transition-colors cursor-pointer"
                  >
                    <Icons.MoreHorizontal size={15} />
                  </button>

                  {showMoreMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-[#1e1e1e] border border-[#383838] rounded-2xl shadow-2xl py-1.5 z-50 text-xs text-white animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeDoc) handleExportDocumentFor(activeDoc);
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[#2c2c2c] flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer font-medium"
                      >
                        <Icons.Download size={14} className="text-[#0d99ff]" />
                        <span>Unduh Dokumen (HTML)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteDocument(activeDoc.id);
                          setActiveDocId(documents.find((d) => d.id !== activeDoc.id)?.id || null);
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-rose-500/10 text-rose-400 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <Icons.Trash2 size={14} />
                        <span>Hapus Dokumen</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* FIGMA WYSIWYG TOOLBAR STRIP */}
            {mode === 'editing' && (
              <div className="relative z-40 px-6 py-2 bg-[#1e1e1e] border-b border-[#383838] flex items-center gap-1.5 text-xs text-slate-300 shrink-0 select-none overflow-x-auto custom-scrollbar">
                {/* Undo & Redo Buttons */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => execCmd('undo')}
                    className="p-1.5 rounded-lg hover:bg-[#383838] text-slate-300 transition-colors cursor-pointer"
                    title="Batal / Undo (Ctrl + Z)"
                  >
                    <Icons.Undo2 size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => execCmd('redo')}
                    className="p-1.5 rounded-lg hover:bg-[#383838] text-slate-300 transition-colors cursor-pointer"
                    title="Ulangi / Redo (Ctrl + Y)"
                  >
                    <Icons.Redo2 size={14} />
                  </button>
                </div>

                <div className="h-4 w-px bg-[#383838] mx-1" />

                {/* Heading Action Buttons */}
                <div className="flex items-center gap-0.5 bg-[#2c2c2c] border border-[#383838] rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => toggleHeader('h1')}
                    className={`px-2 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      activeFormats.h1 ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                    }`}
                    title="Judul Utama (H1)"
                  >
                    H1
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleHeader('h2')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeFormats.h2 ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                    }`}
                    title="Sub Judul (H2)"
                  >
                    H2
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleHeader('h3')}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeFormats.h3 ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                    }`}
                    title="Bagian (H3)"
                  >
                    H3
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleHeader('p')}
                    className="px-2 py-1 rounded-lg text-xs font-medium hover:bg-[#383838] text-slate-400 transition-colors cursor-pointer"
                    title="Paragraf Normal"
                  >
                    P
                  </button>
                </div>

                <div className="h-4 w-px bg-[#383838] mx-1" />

                {/* Font Size Dropdown Control */}
                <select
                  onChange={(e) => {
                    const found = FONT_SIZES.find((f) => f.size === e.target.value);
                    if (found) handleFontSizeChange(found);
                    e.target.value = '';
                  }}
                  className="px-2.5 py-1 rounded-xl bg-[#2c2c2c] border border-[#383838] text-xs text-white font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="">Ukuran Font...</option>
                  {FONT_SIZES.map((f) => (
                    <option key={f.size} value={f.size}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <div className="h-4 w-px bg-[#383838] mx-1" />

                {/* Text Formatting Controls */}
                <button
                  type="button"
                  onClick={() => execCmd('bold')}
                  className={`p-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeFormats.bold ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                  }`}
                  title="Cetak Tebal (Ctrl + B)"
                >
                  <Icons.Bold size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('italic')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.italic ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                  }`}
                  title="Cetak Miring (Ctrl + I)"
                >
                  <Icons.Italic size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('underline')}
                  className={`p-1.5 rounded-lg underline transition-all cursor-pointer ${
                    activeFormats.underline ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                  }`}
                  title="Garis Bawah (Ctrl + U)"
                >
                  <Icons.Underline size={14} />
                </button>

                <div className="h-4 w-px bg-[#383838] mx-1" />

                {/* Alignment */}
                <button
                  type="button"
                  onClick={() => execCmd('justifyLeft')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.alignLeft ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                  }`}
                  title="Rata Kiri"
                >
                  <Icons.AlignLeft size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('justifyCenter')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.alignCenter ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                  }`}
                  title="Rata Tengah"
                >
                  <Icons.AlignCenter size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('justifyRight')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.alignRight ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                  }`}
                  title="Rata Kanan"
                >
                  <Icons.AlignRight size={14} />
                </button>

                <div className="h-4 w-px bg-[#383838] mx-1" />

                {/* Lists & Insert Image */}
                <button
                  type="button"
                  onClick={() => execCmd('insertUnorderedList')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.bulletList ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                  }`}
                  title="Daftar Poin (Bullet List)"
                >
                  <Icons.List size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('insertOrderedList')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.numberedList ? 'bg-[#0d99ff] text-white shadow-xs' : 'hover:bg-[#383838] text-slate-300'
                  }`}
                  title="Daftar Angka (Numbered List)"
                >
                  <Icons.ListOrdered size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-1.5 rounded-xl hover:bg-[#383838] text-[#0d99ff] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  title="Tambah Gambar Ke Naskah"
                >
                  <Icons.Image size={14} />
                  <span>Gambar</span>
                </button>
              </div>
            )}

            {/* LIVE GOOGLE DOCS STYLE CANVAS: VIEWING MODE VS EDITING MODE */}
            <div
              className="flex-1 flex overflow-hidden relative"
              onMouseOver={handleBadgeMouseOver}
              onMouseOut={handleBadgeMouseOut}
            >
              {/* Table of Contents / Outline Panel */}
              {showOutline && (
                <div className="w-64 border-r border-slate-800/40 app-bg-secondary p-4 flex flex-col shrink-0 space-y-3 animate-in slide-in-from-left duration-150 select-none">
                  <div className="flex items-center justify-between border-b border-slate-800/40 pb-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
                      <Icons.ListTree size={14} className="text-amber-400" />
                      <span>Outline ({outlineItems.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOutline(false)}
                      className="text-slate-500 hover:text-white cursor-pointer"
                    >
                      <Icons.X size={14} />
                    </button>
                  </div>

                  {outlineItems.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8 italic">
                      Belum ada judul (H1, H2, H3) dalam dokumen ini.
                    </p>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                      {outlineItems.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => scrollToHeading(idx)}
                          className={`w-full text-left py-1.5 px-2 rounded-lg text-xs hover:bg-slate-800/70 transition-colors truncate cursor-pointer text-slate-300 hover:text-white flex items-center gap-1.5 ${
                            item.level === 1
                              ? 'font-bold text-slate-100'
                              : item.level === 2
                              ? 'pl-4 font-semibold text-slate-300'
                              : 'pl-7 text-slate-400'
                          }`}
                        >
                          <span className="text-[10px] font-mono font-bold text-amber-400/80 shrink-0">
                            H{item.level}
                          </span>
                          <span className="truncate">{item.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {mode === 'viewing' ? (
                /* VIEWING MODE: Figma Dark Sheet Document */
                <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 flex justify-center items-start bg-[#2c2c2c] min-w-0 custom-scrollbar">
                  <div className={`w-full ${canvasContainerWidthClass} bg-[#1e1e1e] border border-[#383838] rounded-2xl p-6 sm:p-10 shadow-2xl flex flex-col space-y-6 transition-all duration-200 min-w-0 my-2 h-fit flow-root overflow-visible`}>
                    <div className="border-b border-[#383838] pb-5 space-y-2">
                      <h1 className="text-3xl font-extrabold tracking-tight text-white break-words [overflow-wrap:anywhere]">
                        {activeDoc.title || 'Dokumen Tanpa Judul'}
                      </h1>
                      <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                        <span>
                          Terakhir diubah:{' '}
                          {new Date(activeDoc.updatedAt).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>•</span>
                        <span>{wordCount} kata</span>
                      </p>
                    </div>

                    {/* Live Rendered Content */}
                    <div
                      id="doc-view-rendered-content"
                      className="prose max-w-none text-base leading-relaxed text-slate-200 space-y-4 font-sans break-words [overflow-wrap:anywhere] min-w-0 flow-root after:content-[''] after:block after:clear-both [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_strong]:text-white [&_p]:leading-relaxed [&_img]:max-w-full [&_img]:h-auto [&_.doc-img-wrapper]:max-w-full [&_.doc-img-wrapper]:flow-root"
                      dangerouslySetInnerHTML={{ __html: activeDoc.content || '<p class="text-slate-500 italic">Dokumen naskah ini masih kosong...</p>' }}
                      onClick={handleDocumentClick}
                    />

                    {/* Backlinks Section (Cards Mentioned in Document) */}
                    {mentionedCards.length > 0 && (
                      <div className="pt-8 mt-6 border-t border-slate-800/80 space-y-4 clear-both">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                          <Icons.Link size={14} className="text-blue-400" />
                          <span>Kartu Terhubung dalam Dokumen ({mentionedCards.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {mentionedCards.map((c) => {
                            const config = CATEGORY_CONFIGS[c.category] || CATEGORY_CONFIGS.character;
                            const IconComp = (Icons as any)[config.iconName] || Icons.HelpCircle;
                            return (
                              <div
                                key={c.id}
                                onClick={() => {
                                  if (onOpenCard) onOpenCard(c);
                                }}
                                className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/40 transition-all cursor-pointer flex items-center gap-3 group"
                              >
                                {c.imageUrl ? (
                                  <img src={c.imageUrl} alt={c.title} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-700/60" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 group-hover:scale-105 transition-transform">
                                    <IconComp size={18} />
                                  </div>
                                )}
                                <div className="truncate flex-1">
                                  <div className="text-xs font-bold text-white group-hover:text-blue-300 truncate transition-colors">
                                    {c.title}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {c.summary || c.subtitle || config.label}
                                  </div>
                                </div>
                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-300 shrink-0">
                                  {c.category}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* EDITING MODE: Interactive Google Docs Style ContentEditable Canvas */
                <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 flex justify-center items-start bg-[#2c2c2c] min-w-0 custom-scrollbar">
                  <div className={`w-full ${canvasContainerWidthClass} bg-[#1e1e1e] border border-[#383838] rounded-2xl p-6 sm:p-10 shadow-2xl flex flex-col space-y-6 relative transition-all duration-200 min-w-0 my-2 h-fit flow-root overflow-visible`}>
                    {/* Clean Title Input & Subtitle Info */}
                    <div className="space-y-2 border-b border-[#383838] pb-4">
                      <input
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        placeholder="Judul naskah..."
                        className="w-full text-3xl font-extrabold tracking-tight text-white bg-transparent border-0 focus:outline-none placeholder:text-slate-600 break-words [overflow-wrap:anywhere]"
                      />
                      <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                        <span>
                          Terakhir diubah:{' '}
                          {new Date(activeDoc.updatedAt).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>•</span>
                        <span>{wordCount} kata</span>
                      </p>
                    </div>

                    {/* Live ContentEditable Canvas (Google Docs Style WYSIWYG) */}
                    <div className="relative flex-1 flex flex-col min-w-0 flow-root after:content-[''] after:block after:clear-both">
                      <div
                        id="doc-editor-textarea"
                        ref={editorRef}
                        contentEditable={true}
                        onKeyDown={handleEditorKeyDown}
                        onKeyUp={handleEditorKeyUp}
                        onClick={(e) => {
                          updateToolbarState();
                          handleDocumentClick(e);
                        }}
                        onContextMenu={handleContextMenuDetect}
                        className="w-full flex-1 bg-transparent text-base leading-relaxed text-slate-200 focus:outline-none resize-none font-sans space-y-3 p-1 min-h-[650px] border-0 break-words [overflow-wrap:anywhere] min-w-0 flow-root after:content-[''] after:block after:clear-both [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:my-4 [&_h1]:text-white [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:my-3 [&_h2]:text-white [&_h3]:text-xl [&_h3]:font-bold [&_h3]:my-2 [&_h3]:text-white [&_img]:max-w-full [&_img]:h-auto [&_.doc-img-wrapper]:max-w-full [&_.doc-img-wrapper]:flow-root"
                      />

                      {/* Inline @ Mention Suggestion Overlay (Positioned precisely at text cursor) */}
                      {mentionState.isOpen && (
                        <div
                          className="doc-mention-popover fixed z-[160] w-72 app-bg-secondary border border-blue-500/40 rounded-2xl shadow-2xl p-2 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 space-y-1"
                          style={{
                            top: `${mentionState.y}px`,
                            left: `${mentionState.x}px`,
                          }}
                        >
                          <div className="px-2 py-1 text-[10px] font-bold text-slate-300 uppercase border-b border-slate-800 flex items-center justify-between">
                            <span>Sisipkan Kartu (@)</span>
                            <span className="text-blue-400">{suggestedCards.length} ditemukan</span>
                          </div>

                          {suggestedCards.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center">
                              Tidak ada kartu yang cocok...
                            </div>
                          ) : (
                            suggestedCards.map((card, idx) => {
                              const isSelected = idx === mentionState.selectedIndex;
                              return (
                                <button
                                  key={card.id}
                                  type="button"
                                  onClick={() => insertMentionCard(card)}
                                  onMouseEnter={() => setMentionState((prev) => ({ ...prev, selectedIndex: idx }))}
                                  className={`w-full text-left px-3 py-2 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-600/30 border-blue-500/60 text-white shadow-xs'
                                      : 'border-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white'
                                  }`}
                                >
                                  <div className="truncate pr-2">
                                    <div className={`text-xs font-bold truncate ${isSelected ? 'text-blue-200' : 'text-slate-100 group-hover:text-blue-300'}`}>
                                      {card.title}
                                    </div>
                                    {card.subtitle && (
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {card.subtitle}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono app-accent-bg text-white shrink-0">
                                    {card.category}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Minimal Reference Drawer Side Panel */}
              {showRefDrawer && (
                <div className="w-72 border-l border-slate-800/40 app-bg-secondary p-5 flex flex-col shrink-0 space-y-4 animate-in slide-in-from-right duration-150 select-none">
                  <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
                    <span className="text-xs font-bold text-slate-200">Referensi Kartu</span>
                    <button
                      type="button"
                      onClick={() => setShowRefDrawer(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Icons.X size={14} />
                    </button>
                  </div>

                  {/* Mentioned Cards Quick Chips in Reference Drawer */}
                  {mentionedCards.length > 0 && (
                    <div className="space-y-2 pb-2 border-b border-slate-800/40">
                      <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                        <span>Kartu Terhubung ({mentionedCards.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {mentionedCards.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedRefCard(c)}
                            className={`px-2 py-0.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                              selectedRefCard?.id === c.id
                                ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                                : 'bg-slate-900/80 hover:bg-slate-800 text-blue-300 border-slate-800'
                            }`}
                          >
                            <span>@{c.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <select
                    value={selectedRefCard?.id || ''}
                    onChange={(e) => {
                      const found = cards.find((c) => c.id === e.target.value);
                      setSelectedRefCard(found || null);
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg app-bg-main border border-slate-700/60 text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Pilih Kartu --</option>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.category}] {c.title}
                      </option>
                    ))}
                  </select>

                  {selectedRefCard ? (
                    <div className="space-y-3 text-xs pt-2">
                      <div className="font-bold text-white text-sm">{selectedRefCard.title}</div>
                      <p className="text-slate-300 leading-relaxed text-xs">
                        {selectedRefCard.summary || 'Tidak ada ringkasan.'}
                      </p>
                      {selectedRefCard.content && (
                        <div className="p-3 rounded-xl bg-slate-900/80 text-slate-200 text-xs leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                          {selectedRefCard.content}
                        </div>
                      )}
                      {onOpenCard && (
                        <button
                          type="button"
                          onClick={() => onOpenCard(selectedRefCard)}
                          className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Buka Kartu
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-8">
                      Pilih kartu untuk dibaca sambil mengetik.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Floating Hover Card Preview Popover */}
            {hoveredCard && (
              <div
                className="card-hover-popover fixed z-[120] w-72 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl p-4 text-xs animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
                style={{
                  top: `${Math.min(window.innerHeight - 250, Math.max(10, hoveredCard.rect.bottom + 8))}px`,
                  left: `${Math.min(window.innerWidth - 300, Math.max(10, hoveredCard.rect.left))}px`,
                }}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                }}
                onMouseLeave={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = setTimeout(() => setHoveredCard(null), 300);
                }}
              >
                {(() => {
                  const card = hoveredCard.card;
                  const config = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
                  const IconComp = (Icons as any)[config.iconName] || Icons.HelpCircle;

                  return (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                          <IconComp size={13} />
                          <span>{config.label}</span>
                        </div>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          @{card.category}
                        </span>
                      </div>

                      {card.imageUrl && (
                        <img
                          src={card.imageUrl}
                          alt={card.title}
                          className="w-full h-28 object-cover rounded-xl border border-slate-800 shadow-xs"
                        />
                      )}

                      <div>
                        <h4 className="text-sm font-extrabold text-white">{card.title}</h4>
                        {card.subtitle && (
                          <p className="text-[11px] text-slate-400 font-medium">{card.subtitle}</p>
                        )}
                      </div>

                      {card.summary && (
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                          {card.summary}
                        </p>
                      )}

                      <div className="pt-1 flex items-center gap-2">
                        {onOpenCard && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenCard(card);
                              setHoveredCard(null);
                            }}
                            className="flex-1 py-1.5 rounded-lg app-accent-bg hover:brightness-110 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Icons.ExternalLink size={12} />
                            <span>Buka Kartu</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRefCard(card);
                            setShowRefDrawer(true);
                            setHoveredCard(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                          title="Buka di Panel Referensi"
                        >
                          <Icons.Layers size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        ) : (
          /* Clean Minimal Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3 select-none">
            <Icons.Edit3 size={28} className="opacity-30" />
            <p className="text-xs">Pilih atau buat dokumen baru untuk mulai menulis.</p>
            <button
              type="button"
              onClick={handleCreateDocument}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              + Buat Dokumen
            </button>
          </div>
        )}
      </div>

      {/* Selected Image Outline Box & 4 Corner Resize Handles Overlay (Left-Click Only) */}
      {mode === 'editing' && selectedImage && !cropState && (
        <div
          className="fixed pointer-events-none z-[125] border-2 border-blue-500 shadow-lg ring-4 ring-blue-500/20 transition-none"
          style={{
            top: `${selectedImage.rect.top}px`,
            left: `${selectedImage.rect.left}px`,
            width: `${selectedImage.rect.width}px`,
            height: `${selectedImage.rect.height}px`,
            borderRadius: selectedImage.img ? window.getComputedStyle(selectedImage.img).borderRadius : '1rem',
          }}
        >
          {/* Top-Left Corner Handle */}
          <div
            onMouseDown={(e) => handleImageResizeStart(e, 'top-left')}
            className="doc-image-resize-handle absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
            title="Tarik untuk mengubah ukuran gambar"
          />
          {/* Top-Right Corner Handle */}
          <div
            onMouseDown={(e) => handleImageResizeStart(e, 'top-right')}
            className="doc-image-resize-handle absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
            title="Tarik untuk mengubah ukuran gambar"
          />
          {/* Bottom-Left Corner Handle */}
          <div
            onMouseDown={(e) => handleImageResizeStart(e, 'bottom-left')}
            className="doc-image-resize-handle absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
            title="Tarik untuk mengubah ukuran gambar"
          />
          {/* Bottom-Right Corner Handle */}
          <div
            onMouseDown={(e) => handleImageResizeStart(e, 'bottom-right')}
            className="doc-image-resize-handle absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
            title="Tarik untuk mengubah ukuran gambar"
          />
        </div>
      )}

      {/* Right-Click Context Menu for Images */}
      {imageContextMenu && (
        <div
          className="doc-image-context-menu fixed z-[150] w-64 bg-[#1e1e1e] border border-[#383838] shadow-2xl rounded-2xl py-2 text-xs text-white animate-in fade-in zoom-in-95 duration-100 select-none space-y-1"
          style={{
            top: `${imageContextMenu.y}px`,
            left: `${imageContextMenu.x}px`,
          }}
        >
          {/* Alignment & Flow Modes */}
          <div className="px-1.5 py-0.5 space-y-0.5">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase">Posisi & Aliran Teks</div>
            <button
              type="button"
              onClick={() => {
                applyImageMode('inline');
                setImageContextMenu(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                imageContextMenu.mode === 'inline'
                  ? 'bg-[#0d99ff]/20 text-[#0d99ff] font-bold border border-[#0d99ff]/30'
                  : 'hover:bg-[#2c2c2c] text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icons.Type size={14} />
                <span>Sebaris dengan Teks (Inline)</span>
              </div>
              {imageContextMenu.mode === 'inline' && <Icons.Check size={13} />}
            </button>

            <button
              type="button"
              onClick={() => {
                applyImageMode('wrap-left');
                setImageContextMenu(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                imageContextMenu.mode === 'wrap-left'
                  ? 'bg-[#0d99ff]/20 text-[#0d99ff] font-bold border border-[#0d99ff]/30'
                  : 'hover:bg-[#2c2c2c] text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icons.AlignLeft size={14} />
                <span>Wrap Teks Kiri</span>
              </div>
              {imageContextMenu.mode === 'wrap-left' && <Icons.Check size={13} />}
            </button>

            <button
              type="button"
              onClick={() => {
                applyImageMode('wrap-right');
                setImageContextMenu(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                imageContextMenu.mode === 'wrap-right'
                  ? 'bg-[#0d99ff]/20 text-[#0d99ff] font-bold border border-[#0d99ff]/30'
                  : 'hover:bg-[#2c2c2c] text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icons.AlignRight size={14} />
                <span>Wrap Teks Kanan</span>
              </div>
              {imageContextMenu.mode === 'wrap-right' && <Icons.Check size={13} />}
            </button>

            <button
              type="button"
              onClick={() => {
                applyImageMode('block');
                setImageContextMenu(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                imageContextMenu.mode === 'block'
                  ? 'bg-[#0d99ff]/20 text-[#0d99ff] font-bold border border-[#0d99ff]/30'
                  : 'hover:bg-[#2c2c2c] text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icons.AlignCenter size={14} />
                <span>Blok Terpisah (Tengah)</span>
              </div>
              {imageContextMenu.mode === 'block' && <Icons.Check size={13} />}
            </button>
          </div>

          <div className="my-1 border-t border-[#383838]" />

          {/* Preset Size Options */}
          <div className="px-1.5 py-1 space-y-1">
            <div className="px-2 text-[10px] font-bold text-slate-400 uppercase">Ukuran Gambar Presets</div>
            <div className="grid grid-cols-4 gap-1 px-1">
              <button
                type="button"
                onClick={() => {
                  applyImageSizePreset('25%');
                  setImageContextMenu(null);
                }}
                className="py-1 rounded-lg bg-[#2c2c2c] hover:bg-[#383838] text-[11px] font-bold text-slate-200 transition-colors text-center cursor-pointer"
                title="Kecil (25%)"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => {
                  applyImageSizePreset('50%');
                  setImageContextMenu(null);
                }}
                className="py-1 rounded-lg bg-[#2c2c2c] hover:bg-[#383838] text-[11px] font-bold text-slate-200 transition-colors text-center cursor-pointer"
                title="Sedang (50%)"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => {
                  applyImageSizePreset('100%');
                  setImageContextMenu(null);
                }}
                className="py-1 rounded-lg bg-[#2c2c2c] hover:bg-[#383838] text-[11px] font-bold text-slate-200 transition-colors text-center cursor-pointer"
                title="Penuh (100%)"
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => {
                  applyImageSizePreset('reset');
                  setImageContextMenu(null);
                }}
                className="py-1 rounded-lg bg-[#2c2c2c] hover:bg-[#383838] text-[10px] font-bold text-slate-400 transition-colors text-center cursor-pointer"
                title="Reset Ukuran Asli"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="my-1 border-t border-[#383838]" />

          {/* Caption & Manipulations */}
          <div className="px-1.5 space-y-0.5">
            {/* Toggle Image Caption */}
            <button
              type="button"
              onClick={() => {
                toggleImageCaption();
                setImageContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-[#2c2c2c] flex items-center gap-2 text-slate-200 hover:text-white transition-colors cursor-pointer font-medium"
            >
              <Icons.MessageSquare size={14} className="text-[#0d99ff]" />
              <span>{imageContextMenu.wrapper.querySelector('figcaption') ? 'Hapus Keterangan' : 'Tambah Keterangan (Caption)'}</span>
            </button>

            {/* Replace Image */}
            <button
              type="button"
              onClick={() => {
                replaceImageInputRef.current?.click();
                setImageContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-[#2c2c2c] flex items-center gap-2 text-slate-200 hover:text-white transition-colors cursor-pointer font-medium"
            >
              <Icons.RefreshCw size={14} className="text-emerald-400" />
              <span>Ganti Gambar</span>
            </button>

            {/* Duplicate Image */}
            <button
              type="button"
              onClick={() => {
                duplicateSelectedImage();
                setImageContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-[#2c2c2c] flex items-center gap-2 text-slate-200 hover:text-white transition-colors cursor-pointer font-medium"
            >
              <Icons.Copy size={14} className="text-purple-400" />
              <span>Duplikat Gambar</span>
            </button>

            {/* Download Image */}
            <button
              type="button"
              onClick={() => {
                downloadSelectedImage();
                setImageContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-[#2c2c2c] flex items-center gap-2 text-slate-200 hover:text-white transition-colors cursor-pointer font-medium"
            >
              <Icons.Download size={14} className="text-[#0d99ff]" />
              <span>Unduh Berkas Gambar</span>
            </button>

            {/* Crop Action */}
            <button
              type="button"
              onClick={() => {
                const { img, wrapper } = imageContextMenu;
                let originalSrc = img.getAttribute('data-original-src');
                if (!originalSrc) {
                  originalSrc = img.src;
                  img.setAttribute('data-original-src', originalSrc);
                }

                const existingTop = Number(img.getAttribute('data-crop-top')) || 0;
                const existingBottom = Number(img.getAttribute('data-crop-bottom')) || 0;
                const existingLeft = Number(img.getAttribute('data-crop-left')) || 0;
                const existingRight = Number(img.getAttribute('data-crop-right')) || 0;

                const rect = img.getBoundingClientRect();
                setCropState({
                  isActive: true,
                  wrapper,
                  img,
                  rect,
                  originalSrc,
                  cropTop: existingTop,
                  cropBottom: existingBottom,
                  cropLeft: existingLeft,
                  cropRight: existingRight,
                });
                setImageContextMenu(null);
                setSelectedImage(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors font-medium text-amber-400 cursor-pointer"
            >
              <Icons.Crop size={14} />
              <span>Potong / Crop Gambar</span>
            </button>

            {/* Reset Crop Action */}
            {(Number(imageContextMenu.img.getAttribute('data-crop-top')) > 0 ||
              Number(imageContextMenu.img.getAttribute('data-crop-bottom')) > 0 ||
              Number(imageContextMenu.img.getAttribute('data-crop-left')) > 0 ||
              Number(imageContextMenu.img.getAttribute('data-crop-right')) > 0 ||
              (imageContextMenu.img.style.clipPath && imageContextMenu.img.style.clipPath !== 'none')) && (
              <button
                type="button"
                onClick={() => {
                  resetImageCrop(imageContextMenu.img);
                  setImageContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-[#2c2c2c] flex items-center gap-2 transition-colors font-medium text-blue-400 cursor-pointer"
              >
                <Icons.RotateCcw size={14} />
                <span>Reset Crop</span>
              </button>
            )}
          </div>

          <div className="my-1 border-t border-[#383838]" />

          {/* Delete Action */}
          <div className="px-1.5">
            <button
              type="button"
              onClick={() => {
                deleteSelectedImage();
                setImageContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl text-left hover:bg-rose-500/10 text-rose-400 flex items-center gap-2 transition-colors cursor-pointer font-medium"
            >
              <Icons.Trash2 size={14} />
              <span>Hapus Gambar</span>
            </button>
          </div>
        </div>
      )}

      {/* Right-Click Context Menu for General Document Text & Editor */}
      {editorContextMenu && (
        <div
          className="doc-text-context-menu fixed z-[150] w-64 app-bg-secondary border border-slate-700/80 shadow-2xl rounded-2xl py-1.5 text-xs app-text-main animate-in fade-in zoom-in-95 duration-100 select-none space-y-0.5"
          style={{
            top: `${editorContextMenu.y}px`,
            left: `${editorContextMenu.x}px`,
          }}
        >
          {/* Section: Worldbuilding & Card Actions */}
          {cards.length > 0 && (
            <div className="p-1 space-y-0.5">
              {/* Insert Card Mention (@) */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    setEditorContextMenu((prev) =>
                      prev ? { ...prev, showMentionSubmenu: !prev.showMentionSubmenu } : null
                    );
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between hover:bg-slate-800 text-blue-300 font-medium transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Icons.AtSign size={14} className="text-blue-400" />
                    <span>Sisipkan Kartu (@)</span>
                  </div>
                  <Icons.ChevronRight size={13} className="text-slate-400" />
                </button>

                {/* Submenu for Cards List */}
                {editorContextMenu.showMentionSubmenu && (
                  <div className="absolute left-full top-0 ml-1 w-56 max-h-60 overflow-y-auto app-bg-secondary border border-slate-700/80 shadow-2xl rounded-2xl p-1 z-[160] space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      Pilih Kartu
                    </div>
                    {cards.slice(0, 15).map((card) => {
                      const config = CATEGORY_CONFIGS[card.category] || CATEGORY_CONFIGS.character;
                      const IconComp = (Icons as any)[config.iconName] || Icons.HelpCircle;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => {
                            insertMentionCard(card);
                            setEditorContextMenu(null);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-blue-600/20 hover:text-blue-200 text-left transition-colors cursor-pointer truncate"
                        >
                          <IconComp size={13} className="text-blue-400 shrink-0" />
                          <span className="truncate text-xs">{card.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Create New Card from Selected Text */}
              {editorContextMenu.selectedText && (
                <button
                  type="button"
                  onClick={() => {
                    handleCreateCardFromSelectedText(editorContextMenu.selectedText);
                    setEditorContextMenu(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 hover:bg-amber-500/20 text-amber-300 font-medium transition-colors cursor-pointer"
                >
                  <Icons.Sparkles size={14} className="text-amber-400 shrink-0" />
                  <span className="truncate">Buat Kartu dari Teks Pilihan</span>
                </button>
              )}
            </div>
          )}

          <div className="my-1 border-t border-slate-800" />

          {/* Section: Clipboard Operations */}
          <div className="p-1 grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => {
                document.execCommand('cut');
                setEditorContextMenu(null);
              }}
              className="px-2 py-1.5 rounded-lg hover:bg-slate-800 flex flex-col items-center justify-center gap-1 text-slate-300 transition-colors cursor-pointer"
              title="Potong (Ctrl+X)"
            >
              <Icons.Scissors size={14} />
              <span className="text-[10px]">Potong</span>
            </button>

            <button
              type="button"
              onClick={() => {
                document.execCommand('copy');
                setEditorContextMenu(null);
              }}
              className="px-2 py-1.5 rounded-lg hover:bg-slate-800 flex flex-col items-center justify-center gap-1 text-slate-300 transition-colors cursor-pointer"
              title="Salin (Ctrl+C)"
            >
              <Icons.Copy size={14} />
              <span className="text-[10px]">Salin</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) {
                    insertHtmlAtCursor(text.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
                  }
                } catch (_err) {
                  document.execCommand('paste');
                }
                setEditorContextMenu(null);
              }}
              className="px-2 py-1.5 rounded-lg hover:bg-slate-800 flex flex-col items-center justify-center gap-1 text-slate-300 transition-colors cursor-pointer"
              title="Tempel (Ctrl+V)"
            >
              <Icons.Clipboard size={14} />
              <span className="text-[10px]">Tempel</span>
            </button>
          </div>

          <div className="my-1 border-t border-slate-800" />

          {/* Section: Formatting Shortcuts */}
          <div className="p-1 space-y-0.5">
            <div className="flex items-center justify-between gap-1 px-1">
              <button
                type="button"
                onClick={() => {
                  execCmd('bold');
                  setEditorContextMenu(null);
                }}
                className="flex-1 p-1.5 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
                title="Tebal (Ctrl+B)"
              >
                <Icons.Bold size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  execCmd('italic');
                  setEditorContextMenu(null);
                }}
                className="flex-1 p-1.5 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
                title="Miring (Ctrl+I)"
              >
                <Icons.Italic size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  execCmd('underline');
                  setEditorContextMenu(null);
                }}
                className="flex-1 p-1.5 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
                title="Garis Bawah (Ctrl+U)"
              >
                <Icons.Underline size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  execCmd('strikeThrough');
                  setEditorContextMenu(null);
                }}
                className="flex-1 p-1.5 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
                title="Coret"
              >
                <Icons.Strikethrough size={14} />
              </button>
            </div>

            {/* Header Toggles */}
            <div className="grid grid-cols-4 gap-1 px-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  toggleHeader('h1');
                  setEditorContextMenu(null);
                }}
                className="px-1.5 py-1 rounded bg-slate-800/80 hover:bg-blue-600/30 text-[10px] font-bold text-slate-200 text-center transition-colors cursor-pointer"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleHeader('h2');
                  setEditorContextMenu(null);
                }}
                className="px-1.5 py-1 rounded bg-slate-800/80 hover:bg-blue-600/30 text-[10px] font-bold text-slate-200 text-center transition-colors cursor-pointer"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleHeader('h3');
                  setEditorContextMenu(null);
                }}
                className="px-1.5 py-1 rounded bg-slate-800/80 hover:bg-blue-600/30 text-[10px] font-bold text-slate-200 text-center transition-colors cursor-pointer"
              >
                H3
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleHeader('p');
                  setEditorContextMenu(null);
                }}
                className="px-1.5 py-1 rounded bg-slate-800/80 hover:bg-blue-600/30 text-[10px] text-slate-300 text-center transition-colors cursor-pointer"
              >
                Teks
              </button>
            </div>

            {/* Clear Formatting */}
            <button
              type="button"
              onClick={() => {
                execCmd('removeFormat');
                setEditorContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <Icons.RemoveFormatting size={13} />
              <span>Hapus Format Teks</span>
            </button>
          </div>

          <div className="my-1 border-t border-slate-800" />

          {/* Section: Insert Elements */}
          <div className="p-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                imageInputRef.current?.click();
                setEditorContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            >
              <Icons.Image size={14} className="text-emerald-400" />
              <span>Sisipkan Gambar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                insertHtmlAtCursor('<hr class="my-6 border-slate-700/80" /><p><br/></p>');
                setEditorContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            >
              <Icons.Minus size={14} className="text-slate-400" />
              <span>Garis Pembatas (HR)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                insertHtmlAtCursor(
                  '<div class="p-4 my-4 bg-blue-950/40 border-l-4 border-blue-500 rounded-r-xl text-slate-200"><p>📌 Catatan penting...</p></div><p><br/></p>'
                );
                setEditorContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl flex items-center gap-2 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
            >
              <Icons.SquarePen size={14} className="text-amber-400" />
              <span>Kotak Catatan (Callout)</span>
            </button>
          </div>
        </div>
      )}

      {/* Right-Click Context Menu for Document Sidebar */}
      {sidebarContextMenu && (
        <div
          className="doc-sidebar-context-menu fixed z-[150] w-56 app-bg-secondary border border-slate-700/80 shadow-2xl rounded-2xl py-1 text-xs app-text-main animate-in fade-in zoom-in-95 duration-100 select-none space-y-0.5"
          style={{
            top: `${sidebarContextMenu.y}px`,
            left: `${sidebarContextMenu.x}px`,
          }}
        >
          {sidebarContextMenu.targetDoc ? (
            /* Context Menu for Specific Document Item */
            <div className="p-1 space-y-0.5">
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 truncate">
                {sidebarContextMenu.targetDoc.title || 'Dokumen'}
              </div>

              {/* Open Document */}
              <button
                type="button"
                onClick={() => {
                  handleSelectDoc(sidebarContextMenu.targetDoc!.id);
                  setSidebarContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
              >
                <Icons.FileText size={14} className="text-blue-400" />
                <span>Buka Dokumen</span>
              </button>

              {/* Edit Document */}
              <button
                type="button"
                onClick={() => {
                  handleSelectDoc(sidebarContextMenu.targetDoc!.id);
                  setMode('editing');
                  setSidebarContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
              >
                <Icons.Edit3 size={14} className="text-amber-400" />
                <span>Edit Dokumen</span>
              </button>

              {/* Duplicate Document */}
              <button
                type="button"
                onClick={() => {
                  handleDuplicateDocument(sidebarContextMenu.targetDoc!);
                  setSidebarContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
              >
                <Icons.Copy size={14} className="text-emerald-400" />
                <span>Duplikasi Dokumen</span>
              </button>

              {/* Download / Export */}
              <button
                type="button"
                onClick={() => {
                  handleExportDocumentFor(sidebarContextMenu.targetDoc!);
                  setSidebarContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
              >
                <Icons.Download size={14} className="text-purple-400" />
                <span>Unduh Dokumen (HTML)</span>
              </button>

              <div className="my-1 border-t border-slate-800" />

              {/* Delete Document */}
              <button
                type="button"
                onClick={() => {
                  const targetId = sidebarContextMenu.targetDoc!.id;
                  onDeleteDocument(targetId);
                  if (activeDocId === targetId) {
                    const remaining = documents.filter((d) => d.id !== targetId);
                    setActiveDocId(remaining.length > 0 ? remaining[0].id : null);
                  }
                  setSidebarContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-rose-500/10 text-rose-400 transition-colors cursor-pointer font-medium"
              >
                <Icons.Trash2 size={14} />
                <span>Hapus Dokumen</span>
              </button>
            </div>
          ) : (
            /* Context Menu for Empty Sidebar Area */
            <div className="p-1 space-y-0.5">
              {/* Create New Document */}
              <button
                type="button"
                onClick={() => {
                  handleCreateDocument();
                  setSidebarContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-blue-600/20 text-blue-300 font-medium transition-colors cursor-pointer"
              >
                <Icons.Plus size={14} className="text-blue-400" />
                <span>Buat Dokumen Baru</span>
              </button>

              <div className="my-1 border-t border-slate-800" />

              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Urutkan Dokumen
              </div>

              {/* Sort by Updated Date */}
              <button
                type="button"
                onClick={() => {
                  setSortBy('updated');
                  setSidebarContextMenu(null);
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                  sortBy === 'updated' ? 'bg-slate-800 text-white font-medium' : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span>Terakhir Diubah</span>
                {sortBy === 'updated' && <Icons.Check size={13} className="text-blue-400" />}
              </button>

              {/* Sort by Title */}
              <button
                type="button"
                onClick={() => {
                  setSortBy('title');
                  setSidebarContextMenu(null);
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                  sortBy === 'title' ? 'bg-slate-800 text-white font-medium' : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span>Judul (A-Z)</span>
                {sortBy === 'title' && <Icons.Check size={13} className="text-blue-400" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Google Docs Style Inline Image Cropping Overlay (8 Black Handles) */}
      {mode === 'editing' && cropState && cropState.isActive && (
        <div
          className="fixed z-[160] pointer-events-auto select-none"
          style={{
            top: `${cropState.rect.top}px`,
            left: `${cropState.rect.left}px`,
            width: `${cropState.rect.width}px`,
            height: `${cropState.rect.height}px`,
          }}
        >
          {/* Dimmed Outside Region Overlay */}
          <div className="absolute inset-0 bg-black/50 pointer-events-none rounded-xl" />

          {/* Active Uncropped Region Viewport */}
          <div
            className="absolute border-2 border-black shadow-2xl overflow-hidden pointer-events-none"
            style={{
              top: `${cropState.cropTop}%`,
              bottom: `${cropState.cropBottom}%`,
              left: `${cropState.cropLeft}%`,
              right: `${cropState.cropRight}%`,
            }}
          >
            {/* Clear Un-dimmed Image Background Inside Viewport */}
            <img
              src={cropState.originalSrc}
              alt="Crop area"
              className="absolute max-w-none block object-contain pointer-events-none"
              style={{
                width: `${cropState.rect.width}px`,
                height: `${cropState.rect.height}px`,
                top: `-${(cropState.cropTop / 100) * cropState.rect.height}px`,
                left: `-${(cropState.cropLeft / 100) * cropState.rect.width}px`,
              }}
            />
          </div>

          {/* 8 Google Docs Black Crop Handles */}
          {/* Top-Left Corner Handle */}
          <div
            onMouseDown={(e) => handleInlineCropDragStart(e, 'top-left')}
            className="doc-crop-handle absolute w-3.5 h-3.5 bg-black border-2 border-white cursor-nwse-resize z-20"
            style={{
              top: `calc(${cropState.cropTop}% - 3px)`,
              left: `calc(${cropState.cropLeft}% - 3px)`,
            }}
            title="Tarik untuk memotong dari sudut kiri atas"
          />

          {/* Top-Right Corner Handle */}
          <div
            onMouseDown={(e) => handleInlineCropDragStart(e, 'top-right')}
            className="doc-crop-handle absolute w-3.5 h-3.5 bg-black border-2 border-white cursor-nesw-resize z-20"
            style={{
              top: `calc(${cropState.cropTop}% - 3px)`,
              left: `calc(${100 - cropState.cropRight}% - 11px)`,
            }}
            title="Tarik untuk memotong dari sudut kanan atas"
          />

          {/* Bottom-Left Corner Handle */}
          <div
            onMouseDown={(e) => handleInlineCropDragStart(e, 'bottom-left')}
            className="doc-crop-handle absolute w-3.5 h-3.5 bg-black border-2 border-white cursor-nesw-resize z-20"
            style={{
              top: `calc(${100 - cropState.cropBottom}% - 11px)`,
              left: `calc(${cropState.cropLeft}% - 3px)`,
            }}
            title="Tarik untuk memotong dari sudut kiri bawah"
          />

          {/* Bottom-Right Corner Handle */}
          <div
            onMouseDown={(e) => handleInlineCropDragStart(e, 'bottom-right')}
            className="doc-crop-handle absolute w-3.5 h-3.5 bg-black border-2 border-white cursor-nwse-resize z-20"
            style={{
              top: `calc(${100 - cropState.cropBottom}% - 11px)`,
              left: `calc(${100 - cropState.cropRight}% - 11px)`,
            }}
            title="Tarik untuk memotong dari sudut kanan bawah"
          />

          {/* Top Edge Handle */}
          <div
            onMouseDown={(e) => handleInlineCropDragStart(e, 'top')}
            className="doc-crop-handle absolute w-6 h-2 bg-black border border-white cursor-ns-resize z-20 -translate-x-1/2 rounded-xs"
            style={{
              top: `calc(${cropState.cropTop}% - 4px)`,
              left: `calc(${cropState.cropLeft + (100 - cropState.cropLeft - cropState.cropRight) / 2}%)`,
            }}
            title="Tarik ke bawah untuk memotong bagian atas"
          />

          {/* Bottom Edge Handle */}
          <div
            onMouseDown={(e) => handleInlineCropDragStart(e, 'bottom')}
            className="doc-crop-handle absolute w-6 h-2 bg-black border border-white cursor-ns-resize z-20 -translate-x-1/2 rounded-xs"
            style={{
              top: `calc(${100 - cropState.cropBottom}% - 4px)`,
              left: `calc(${cropState.cropLeft + (100 - cropState.cropLeft - cropState.cropRight) / 2}%)`,
            }}
            title="Tarik ke atas untuk memotong bagian bawah"
          />

          {/* Left Edge Handle */}
          <div
            onMouseDown={(e) => handleInlineCropDragStart(e, 'left')}
            className="doc-crop-handle absolute w-2 h-6 bg-black border border-white cursor-ew-resize z-20 -translate-y-1/2 rounded-xs"
            style={{
              top: `calc(${cropState.cropTop + (100 - cropState.cropTop - cropState.cropBottom) / 2}%)`,
              left: `calc(${cropState.cropLeft}% - 4px)`,
            }}
            title="Tarik ke kanan untuk memotong bagian kiri"
          />

          {/* Right Edge Handle */}
          <div
            onMouseDown={(e) => handleInlineCropDragStart(e, 'right')}
            className="doc-crop-handle absolute w-2 h-6 bg-black border border-white cursor-ew-resize z-20 -translate-y-1/2 rounded-xs"
            style={{
              top: `calc(${cropState.cropTop + (100 - cropState.cropTop - cropState.cropBottom) / 2}%)`,
              left: `calc(${100 - cropState.cropRight}% - 4px)`,
            }}
            title="Tarik ke kiri untuk memotong bagian kanan"
          />

          {/* Action Floating Pill below Crop Area */}
          <div
            className="absolute z-30 left-1/2 -translate-x-1/2 flex items-center gap-2"
            style={{ top: `calc(${100 - cropState.cropBottom}% + 12px)` }}
          >
            <button
              type="button"
              onClick={commitInlineCrop}
              className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white font-bold text-xs shadow-2xl border border-slate-700 hover:bg-black hover:border-amber-400 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Icons.Check size={14} className="text-amber-400" />
              <span>Selesai Crop (Enter)</span>
            </button>
            <button
              type="button"
              onClick={() => setCropState(null)}
              className="px-3 py-1.5 rounded-full bg-slate-900/80 text-slate-400 hover:text-white font-semibold text-xs border border-slate-800 transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Save Notification Toast */}
      {showSaveToast && (
        <div className="fixed bottom-6 right-6 z-[150] px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Icons.CheckCircle2 size={16} />
          <span>Dokumen Tersimpan</span>
        </div>
      )}
    </div>
  );
};

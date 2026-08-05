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
}

const FONT_SIZES = [
  { label: 'Kecil (12px)', size: '12px', cmdSize: '2' },
  { label: 'Normal (16px)', size: '16px', cmdSize: '3' },
  { label: 'Sedang (20px)', size: '20px', cmdSize: '4' },
  { label: 'Besar (24px)', size: '24px', cmdSize: '5' },
  { label: 'Sangat Besar (32px)', size: '32px', cmdSize: '6' },
];

const EMOJI_LIST = [
  '📖', '📜', '⚔️', '🏰', '🔮', '👑', '🛡️', '✍️', '🌟', '📍',
  '🐉', '🌿', '💡', '⚡', '🗝️', '🗺️', '🧭', '🎭', '💎', '⏳', '📜', '✒️'
];

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  cards,
  onSaveDocument,
  onDeleteDocument,
  onCreateDocument,
  onOpenCard,
}) => {
  const [activeDocId, setActiveDocId] = useState<string | null>(
    documents.length > 0 ? documents[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isZenMode, setIsZenMode] = useState(false);
  const [showRefDrawer, setShowRefDrawer] = useState(false);
  const [selectedRefCard, setSelectedRefCard] = useState<WorldCard | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showOutline, setShowOutline] = useState(false);

  // Hovered Card State for Popover Preview
  const [hoveredCard, setHoveredCard] = useState<{
    card: WorldCard;
    rect: DOMRect;
  } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Inline @ Mention Suggestion Popup State
  const [mentionState, setMentionState] = useState<{
    isOpen: boolean;
    query: string;
  }>({
    isOpen: false,
    query: '',
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

  // Filtered documents list
  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      return (
        !q ||
        doc.title.toLowerCase().includes(q) ||
        (doc.content && doc.content.toLowerCase().includes(q))
      );
    });
  }, [documents, searchQuery]);

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

  // Keyboard Event Handler: Tab, Backspace, Ctrl+Z/Y/B/I/U Shortcuts
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
          const imgHtml = `<div class="my-6 text-center select-none" contenteditable="false"><img src="${savedUrl}" alt="${file.name}" class="max-h-[450px] rounded-2xl mx-auto border border-slate-700/60 shadow-2xl object-cover" /></div><p><br/></p>`;
          insertHtmlAtCursor(imgHtml);
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        const imgHtml = `<div class="my-6 text-center select-none" contenteditable="false"><img src="${base64Data}" alt="${file.name}" class="max-h-[450px] rounded-2xl mx-auto border border-slate-700/60 shadow-2xl object-cover" /></div><p><br/></p>`;
        insertHtmlAtCursor(imgHtml);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Handle Inline @ Mention in ContentEditable
  const handleEditorKeyUp = () => {
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
          setMentionState({
            isOpen: true,
            query: queryCandidate.toLowerCase(),
          });
          return;
        }
      }
    }

    if (mentionState.isOpen) {
      setMentionState({ isOpen: false, query: '' });
    }
  };

  // Insert Mentioned Card as Rich Pill Badge
  const insertMentionCard = (card: WorldCard) => {
    const badgeHtml = `<span contenteditable="false" data-card-id="${card.id}" class="card-mention-badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-semibold shadow-xs select-none cursor-pointer hover:bg-blue-500/30 transition-colors">@${card.title}</span>&nbsp;`;
    insertHtmlAtCursor(badgeHtml);
    setMentionState({ isOpen: false, query: '' });
  };

  // Layout Templates
  const insertLayoutTemplate = (type: '2col' | 'sidebar' | 'callout' | 'divider') => {
    setShowLayoutMenu(false);
    if (type === '2col') {
      const html = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin: 1.5rem 0;" class="my-6"><div style="padding: 0.75rem; border: 1px solid rgba(255,255,255,0.1); rounded-xl bg-slate-900/40"><h3 class="text-lg font-bold text-white mb-2">Kolom Kiri</h3><p>Tulis naskah kolom kiri di sini...</p></div><div style="padding: 0.75rem; border: 1px solid rgba(255,255,255,0.1); rounded-xl bg-slate-900/40"><h3 class="text-lg font-bold text-white mb-2">Kolom Kanan</h3><p>Tulis naskah kolom kanan di sini...</p></div></div><p><br/></p>`;
      insertHtmlAtCursor(html);
    } else if (type === 'sidebar') {
      const html = `<div style="display: grid; grid-template-columns: 1fr 2.5fr; gap: 1.5rem; margin: 1.5rem 0;" class="my-6"><div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.1);"><h4 class="text-xs font-bold uppercase text-slate-400 mb-1">Catatan Samping</h4><p class="text-xs text-slate-300">Ringkasan info atau lore tambahan...</p></div><div><h3 class="text-xl font-bold text-white mb-2">Naskah Utama</h3><p>Tulis narasi utama di sini...</p></div></div><p><br/></p>`;
      insertHtmlAtCursor(html);
    } else if (type === 'callout') {
      const html = `<div style="background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; padding: 1rem 1.25rem; border-radius: 0.75rem; margin: 1.5rem 0;" class="my-6"><strong class="text-blue-300 font-bold block mb-1">💡 Catatan Penting Worldbuilding:</strong><p class="text-slate-300">Tulis info rahasia atau pesan penting lore di dalam kotak ini...</p></div><p><br/></p>`;
      insertHtmlAtCursor(html);
    } else if (type === 'divider') {
      const html = `<hr style="border: 0; height: 1px; background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent); margin: 2rem 0;" /><p><br/></p>`;
      insertHtmlAtCursor(html);
    }
  };

  // Create New Document
  const handleCreateDocument = () => {
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
    onSaveDocument(updatedDoc);
    setMode('viewing');
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2200);
  };

  // Global Keyboard Shortcut: Ctrl + S / Cmd + S to save document
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (mode === 'editing') {
          handleSaveDocument();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode, activeDoc, draftTitle]);

  // Export Markdown / HTML File
  const handleExportDocument = () => {
    if (!activeDoc) return;
    const content = mode === 'editing' && editorRef.current ? editorRef.current.innerHTML : activeDoc.content;
    const blob = new Blob([content], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(activeDoc.title || 'dokumen').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    link.click();
    URL.revokeObjectURL(url);
    setShowMoreMenu(false);
  };

  return (
    <div className="flex-1 flex app-bg-main overflow-hidden app-text-main h-full font-sans select-none">
      {/* Hidden Image File Input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* ========================================================= */}
      {/* MINIMALIST LEFT SIDEBAR */}
      {/* ========================================================= */}
      {!isZenMode && (
        <div className="w-72 border-r app-border/40 app-bg-secondary flex flex-col shrink-0">
          {/* Header & Quick Add */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Dokumen</h2>
            <button
              type="button"
              onClick={handleCreateDocument}
              className="p-1.5 rounded-lg hover:app-bg-hover text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Buat Dokumen Baru"
            >
              <Icons.Plus size={16} />
            </button>
          </div>

          {/* Minimal Search Bar */}
          <div className="px-5 mb-4">
            <div className="relative">
              <Icons.Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari dokumen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg app-bg-main/80 border border-slate-700/60 app-text-main placeholder:text-slate-400 focus:outline-none focus:border-slate-500 transition-colors"
              />
            </div>
          </div>

          {/* Clean Document List */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
            {filteredDocs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 space-y-2 text-xs">
                <p>Belum ada dokumen.</p>
                <button
                  type="button"
                  onClick={handleCreateDocument}
                  className="text-blue-400 hover:underline font-semibold"
                >
                  + Tulis Sekarang
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
                    onClick={() => setActiveDocId(doc.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                      isActive
                        ? 'bg-slate-800 text-white font-semibold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate">{doc.title || 'Dokumen Tanpa Judul'}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {words} kata
                      </div>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* GOOGLE DOCS STYLE LIVE RICH EDITOR WORKSPACE */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {activeDoc ? (
          <>
            {/* Top Control Bar */}
            <div className="px-8 py-3 flex items-center justify-between text-xs text-slate-300 border-b border-slate-800/40 shrink-0">
              <div className="flex items-center gap-3">
                {isZenMode && (
                  <button
                    type="button"
                    onClick={() => setIsZenMode(false)}
                    className="p-1 rounded-md text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Keluar Zen Mode"
                  >
                    <Icons.Minimize2 size={15} />
                  </button>
                )}

                <span className="font-mono text-[11px] text-slate-400 font-medium">{wordCount} kata</span>

                <div className="h-4 w-px bg-slate-800/60 mx-1" />

                {/* Primary Mode Button: VIEWING MODE VS EDITING MODE */}
                {mode === 'viewing' ? (
                  <button
                    type="button"
                    onClick={() => setMode('editing')}
                    className="px-3.5 py-1.5 rounded-xl app-accent-bg text-white font-bold text-xs shadow-md hover:brightness-110 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Icons.Edit3 size={14} />
                    <span>Edit Dokumen</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveDocument}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <Icons.Check size={14} />
                      <span>Simpan Dokumen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('viewing')}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOutline(!showOutline)}
                  className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showOutline
                      ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Daftar Isi / Outline Naskah"
                >
                  <Icons.ListTree size={14} />
                  <span>Outline</span>
                  {outlineItems.length > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                      {outlineItems.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowRefDrawer(!showRefDrawer)}
                  className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showRefDrawer
                      ? 'bg-blue-500/20 text-blue-300 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Panel Referensi Kartu"
                >
                  <Icons.Layers size={14} />
                  <span>Referensi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsZenMode(!isZenMode)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/40 transition-colors cursor-pointer"
                  title={isZenMode ? 'Keluar Zen Mode' : 'Zen Mode'}
                >
                  {isZenMode ? <Icons.Minimize2 size={14} /> : <Icons.Maximize2 size={14} />}
                </button>

                {/* More Options Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <Icons.MoreHorizontal size={14} />
                  </button>

                  {showMoreMenu && (
                    <div className="absolute right-0 mt-2 w-44 app-bg-secondary border border-slate-700/60 rounded-xl shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={handleExportDocument}
                        className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-200 hover:text-white cursor-pointer"
                      >
                        <Icons.Download size={14} />
                        <span>Unduh Dokumen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteDocument(activeDoc.id);
                          setActiveDocId(documents.find((d) => d.id !== activeDoc.id)?.id || null);
                          setShowMoreMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-rose-500/10 text-rose-400 flex items-center gap-2 cursor-pointer"
                      >
                        <Icons.Trash2 size={14} />
                        <span>Hapus Dokumen</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Google Docs Style Rich WYSIWYG Format Toolbar with Undo & Redo */}
            {mode === 'editing' && (
              <div className="relative z-40 px-6 py-2 app-bg-secondary/90 border-b border-slate-800/40 backdrop-blur-md flex items-center gap-1.5 text-xs text-slate-300 shrink-0 select-none">
                {/* Undo & Redo Buttons */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => execCmd('undo')}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                    title="Batal / Undo (Ctrl + Z)"
                  >
                    <Icons.Undo2 size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => execCmd('redo')}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                    title="Ulangi / Redo (Ctrl + Y)"
                  >
                    <Icons.Redo2 size={14} />
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Header Style Direct Action Buttons (H1, H2, H3, P) without container */}
                <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => toggleHeader('h1')}
                    className={`px-2 py-1 rounded text-xs font-extrabold transition-all cursor-pointer ${
                      activeFormats.h1 ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                    title="Judul Utama (H1)"
                  >
                    H1
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleHeader('h2')}
                    className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      activeFormats.h2 ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                    title="Sub Judul (H2)"
                  >
                    H2
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleHeader('h3')}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                      activeFormats.h3 ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                    title="Bagian (H3)"
                  >
                    H3
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleHeader('p')}
                    className="px-2 py-1 rounded text-xs font-medium hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
                    title="Paragraf Normal"
                  >
                    P
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Font Size Dropdown Control */}
                <select
                  onChange={(e) => {
                    const found = FONT_SIZES.find((f) => f.size === e.target.value);
                    if (found) handleFontSizeChange(found);
                    e.target.value = '';
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="">Ukuran Font...</option>
                  {FONT_SIZES.map((f) => (
                    <option key={f.size} value={f.size}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Text Formatting Controls with Live Active Indicators */}
                <button
                  type="button"
                  onClick={() => execCmd('bold')}
                  className={`p-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeFormats.bold ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Cetak Tebal (Ctrl + B)"
                >
                  <Icons.Bold size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('italic')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.italic ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Cetak Miring (Ctrl + I)"
                >
                  <Icons.Italic size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('underline')}
                  className={`p-1.5 rounded-lg underline transition-all cursor-pointer ${
                    activeFormats.underline ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Garis Bawah (Ctrl + U)"
                >
                  <Icons.Underline size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('strikeThrough')}
                  className={`p-1.5 rounded-lg line-through transition-all cursor-pointer ${
                    activeFormats.strikethrough ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Coret (Strikethrough)"
                >
                  <Icons.Strikethrough size={14} />
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Alignment Controls (Justify, Left, Center, Right) */}
                <button
                  type="button"
                  onClick={() => execCmd('justifyLeft')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.alignLeft ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Rata Kiri"
                >
                  <Icons.AlignLeft size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('justifyCenter')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.alignCenter ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Rata Tengah"
                >
                  <Icons.AlignCenter size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('justifyRight')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.alignRight ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Rata Kanan"
                >
                  <Icons.AlignRight size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('justifyFull')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.alignJustify ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Rata Kanan-Kiri (Justify)"
                >
                  <Icons.AlignJustify size={14} />
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Lists & Indentation */}
                <button
                  type="button"
                  onClick={() => execCmd('insertUnorderedList')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.bulletList ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Daftar Poin (Bullet List)"
                >
                  <Icons.List size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('insertOrderedList')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    activeFormats.numberedList ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Daftar Angka (Numbered List)"
                >
                  <Icons.ListOrdered size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('indent')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                  title="Tambah Indentasi (Tab)"
                >
                  <Icons.Indent size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => execCmd('outdent')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                  title="Kurangi Indentasi (Shift + Tab / Backspace)"
                >
                  <Icons.Outdent size={14} />
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Insert Image Button */}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-blue-400 transition-colors cursor-pointer flex items-center gap-1 font-medium"
                  title="Tambah Gambar Fisik ke Dokumen"
                >
                  <Icons.Image size={14} />
                  <span>Gambar</span>
                </button>

                {/* Layout Dropdown Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLayoutMenu(!showLayoutMenu);
                      setShowEmojiPicker(false);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-amber-400 transition-colors cursor-pointer flex items-center gap-1 font-medium"
                    title="Sisipkan Tata Letak / Layout"
                  >
                    <Icons.Columns size={14} />
                    <span>Layout</span>
                  </button>

                  {showLayoutMenu && (
                    <div className="absolute top-full left-0 mt-2 w-52 app-bg-secondary border border-slate-700/60 rounded-2xl shadow-2xl py-1.5 z-[100] text-xs animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={() => insertLayoutTemplate('2col')}
                        className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <Icons.Columns size={14} />
                        <span>2 Kolom Seimbang (50 / 50)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertLayoutTemplate('sidebar')}
                        className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <Icons.Sidebar size={14} />
                        <span>Sidebar + Naskah (30 / 70)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertLayoutTemplate('callout')}
                        className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <Icons.AlertCircle size={14} />
                        <span>Kotak Sorotan / Callout Box</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertLayoutTemplate('divider')}
                        className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <Icons.Minus size={14} />
                        <span>Pembatas Garis Bergaya</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Emoji Picker Popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmojiPicker(!showEmojiPicker);
                      setShowLayoutMenu(false);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Sisipkan Emoji"
                  >
                    <Icons.Smile size={14} />
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute top-full left-0 mt-2 w-56 app-bg-secondary border border-slate-700/60 rounded-2xl shadow-2xl p-2 z-[100] grid grid-cols-6 gap-1 animate-in fade-in zoom-in-95 duration-100">
                      {EMOJI_LIST.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            insertHtmlAtCursor(emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-base text-center cursor-pointer transition-transform hover:scale-110"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                /* VIEWING MODE: Clean Rendered Document */
                <div className="flex-1 overflow-y-auto px-6 md:px-12 py-10 flex justify-center app-bg-main">
                  <div className="w-full max-w-4xl lg:max-w-5xl flex flex-col space-y-6">
                    <div className="border-b border-slate-800/80 pb-4 space-y-2">
                      <h1 className="text-3xl font-extrabold tracking-tight app-text-main">
                        {activeDoc.title || 'Dokumen Tanpa Judul'}
                      </h1>
                      <p className="text-xs text-slate-400 font-mono">
                        Terakhir diubah:{' '}
                        {new Date(activeDoc.updatedAt).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {/* Live Rendered Content */}
                    <div
                      id="doc-view-rendered-content"
                      className="prose max-w-none text-base leading-relaxed app-text-main space-y-4 font-sans [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_h1]:app-text-main [&_h2]:app-text-main [&_h3]:app-text-main [&_strong]:app-text-main [&_p]:leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: activeDoc.content || '<p class="text-slate-400 italic">Dokumen kosong...</p>' }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        const cardId = target.getAttribute('data-card-id');
                        if (cardId && onOpenCard) {
                          const found = cards.find((c) => c.id === cardId);
                          if (found) onOpenCard(found);
                        }
                      }}
                    />

                    {/* Backlinks Section (Cards Mentioned in Document) */}
                    {mentionedCards.length > 0 && (
                      <div className="pt-8 mt-6 border-t border-slate-800/80 space-y-4">
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
                <div className="flex-1 overflow-y-auto px-6 md:px-12 py-10 flex justify-center">
                  <div className="w-full max-w-4xl lg:max-w-5xl flex flex-col space-y-6 relative">
                    {/* Clean Title Input */}
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="Judul naskah..."
                      className="w-full text-3xl font-extrabold tracking-tight app-text-main bg-transparent border-0 focus:outline-none placeholder:text-slate-500"
                    />

                    {/* Live ContentEditable Canvas (Google Docs Style WYSIWYG) */}
                    <div className="relative flex-1 flex flex-col">
                      <div
                        id="doc-editor-textarea"
                        ref={editorRef}
                        contentEditable={true}
                        onKeyDown={handleEditorKeyDown}
                        onKeyUp={handleEditorKeyUp}
                        onClick={updateToolbarState}
                        className="w-full flex-1 bg-transparent text-base leading-relaxed app-text-main focus:outline-none resize-none font-sans space-y-3 p-1 min-h-[650px] border-0 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:my-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:my-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:my-2"
                      />

                      {/* Inline @ Mention Suggestion Overlay */}
                      {mentionState.isOpen && (
                        <div className="absolute top-12 left-0 w-72 app-bg-secondary border border-blue-500/40 rounded-2xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 space-y-1">
                          <div className="px-2 py-1 text-[10px] font-bold text-slate-300 uppercase border-b border-slate-800 flex items-center justify-between">
                            <span>Sisipkan Kartu (@)</span>
                            <span className="text-blue-400">{suggestedCards.length} ditemukan</span>
                          </div>

                          {suggestedCards.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center">
                              Tidak ada kartu yang cocok...
                            </div>
                          ) : (
                            suggestedCards.map((card) => (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => insertMentionCard(card)}
                                className="w-full text-left px-3 py-2 rounded-xl hover:bg-blue-600/20 hover:border-blue-500/30 border border-transparent transition-all flex items-center justify-between group cursor-pointer"
                              >
                                <div className="truncate pr-2">
                                  <div className="text-xs font-bold text-slate-100 group-hover:text-blue-300 truncate">
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
                            ))
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

      {/* Save Notification Toast */}
      {showSaveToast && (
        <div className="fixed bottom-6 right-6 z-[150] px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Icons.CheckCircle2 size={16} />
          <span>Dokumen berhasil disimpan (Ctrl + S)</span>
        </div>
      )}
    </div>
  );
};

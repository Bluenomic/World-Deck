import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { WorldDocument, DocumentCategory, WorldCard } from '../types';
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

const CATEGORIES: { id: DocumentCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'story', label: 'Cerita' },
  { id: 'chapter', label: 'Bab' },
  { id: 'note', label: 'Catatan' },
  { id: 'world_guide', label: 'Panduan' },
  { id: 'character_log', label: 'Karakter' },
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
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isZenMode, setIsZenMode] = useState(false);
  const [showRefDrawer, setShowRefDrawer] = useState(false);
  const [selectedRefCard, setSelectedRefCard] = useState<WorldCard | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  // Workflow Mode State: 'viewing' (default when opening) vs 'editing'
  const [mode, setMode] = useState<'viewing' | 'editing'>('viewing');

  // Draft document state while editing
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState<DocumentCategory>('story');

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
      setDraftCategory(activeDoc.category || 'story');

      if (mode === 'editing' && editorRef.current) {
        editorRef.current.innerHTML = activeDoc.content || '<p><br/></p>';
      }
    }
  }, [activeDocId, mode]);

  // Filtered documents list
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchCat = selectedCategory === 'all' || doc.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        (doc.content && doc.content.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [documents, selectedCategory, searchQuery]);

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

  // Execute Rich Text Command (Google Docs Style)
  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
  };

  // Insert HTML Snippet directly at cursor
  const insertHtmlAtCursor = (htmlSnippet: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertHTML', false, htmlSnippet);
  };

  // Handle Header Selection
  const handleHeaderChange = (tag: string) => {
    if (!tag) return;
    if (tag === 'p') {
      execCmd('formatBlock', '<p>');
    } else {
      execCmd('formatBlock', `<${tag}>`);
    }
  };

  // Handle Image Upload into ContentEditable Canvas
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isTauriAvailable()) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        const savedUrl = await saveImageAsset(base64Data, file.name);
        if (savedUrl) {
          const imgHtml = `<div class="my-6 text-center select-none" contenteditable="false"><img src="${savedUrl}" alt="${file.name}" class="max-h-[450px] rounded-2xl mx-auto border border-slate-700/60 shadow-2xl object-cover" /><span class="text-xs text-slate-400 mt-2 block font-medium">${file.name}</span></div><p><br/></p>`;
          insertHtmlAtCursor(imgHtml);
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        const imgHtml = `<div class="my-6 text-center select-none" contenteditable="false"><img src="${base64Data}" alt="${file.name}" class="max-h-[450px] rounded-2xl mx-auto border border-slate-700/60 shadow-2xl object-cover" /><span class="text-xs text-slate-400 mt-2 block font-medium">${file.name}</span></div><p><br/></p>`;
        insertHtmlAtCursor(imgHtml);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Handle Inline @ Mention in ContentEditable
  const handleEditorKeyUp = () => {
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
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const badgeHtml = `<span contenteditable="false" data-card-id="${card.id}" class="card-mention-badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-semibold shadow-xs select-none cursor-pointer hover:bg-blue-500/30 transition-colors">@${card.title}</span>&nbsp;`;
    insertHtmlAtCursor(badgeHtml);
    setMentionState({ isOpen: false, query: '' });
  };

  // Layout Templates
  const insertLayoutTemplate = (type: '2col' | 'sidebar' | 'callout' | 'divider') => {
    setShowLayoutMenu(false);
    if (type === '2col') {
      const html = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin: 1.5rem 0;" class="my-6"><div style="padding: 0.75rem; border: 1px border-slate-800 rounded-xl bg-slate-900/40"><h3 class="text-lg font-bold text-white mb-2">Kolom Kiri</h3><p>Tulis naskah kolom kiri di sini...</p></div><div style="padding: 0.75rem; border: 1px border-slate-800 rounded-xl bg-slate-900/40"><h3 class="text-lg font-bold text-white mb-2">Kolom Kanan</h3><p>Tulis naskah kolom kanan di sini...</p></div></div><p><br/></p>`;
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
  const handleCreateDocument = (category: DocumentCategory = 'story') => {
    const newDoc: WorldDocument = {
      id: generateId('doc'),
      title: 'Dokumen Tanpa Judul',
      content: '<h2>Bab 1</h2><p>Mulai menulis cerita Anda di sini...</p>',
      category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onCreateDocument(newDoc);
    setActiveDocId(newDoc.id);
    setDraftTitle(newDoc.title);
    setDraftCategory(newDoc.category);
    setMode('editing');
  };

  // Save Document and switch to Viewing Mode
  const handleSaveDocument = () => {
    if (!activeDoc || !editorRef.current) return;
    const finalContent = editorRef.current.innerHTML;

    const updatedDoc: WorldDocument = {
      ...activeDoc,
      title: draftTitle.trim() || 'Dokumen Tanpa Judul',
      content: finalContent,
      category: draftCategory,
      updatedAt: Date.now(),
    };
    onSaveDocument(updatedDoc);
    setMode('viewing');
  };

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
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Dokumen</h2>
            <button
              type="button"
              onClick={() => handleCreateDocument('story')}
              className="p-1.5 rounded-lg hover:app-bg-hover text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Buat Dokumen Baru"
            >
              <Icons.Plus size={16} />
            </button>
          </div>

          {/* Minimal Search Bar */}
          <div className="px-5 mb-3">
            <div className="relative">
              <Icons.Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Cari..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg app-bg-main/60 border border-slate-800/80 app-text-main placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
              />
            </div>
          </div>

          {/* Minimal Category Tabs */}
          <div className="px-5 mb-3 flex gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2 py-0.5 rounded-md transition-colors shrink-0 font-medium ${
                  selectedCategory === cat.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Clean Document List */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
            {filteredDocs.length === 0 ? (
              <div className="text-center py-10 text-slate-500 space-y-2 text-xs">
                <p>Belum ada dokumen.</p>
                <button
                  type="button"
                  onClick={() => handleCreateDocument('story')}
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
                        ? 'bg-slate-800/80 text-white font-semibold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="text-xs truncate">{doc.title || 'Dokumen Tanpa Judul'}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
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
            <div className="px-8 py-3 flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/20 shrink-0">
              <div className="flex items-center gap-3">
                {isZenMode && (
                  <button
                    type="button"
                    onClick={() => setIsZenMode(false)}
                    className="p-1 rounded-md hover:text-white transition-colors cursor-pointer"
                    title="Keluar Zen Mode"
                  >
                    <Icons.Minimize2 size={15} />
                  </button>
                )}

                <span className="font-mono text-[11px] text-slate-500">{wordCount} kata</span>

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
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
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
                  onClick={() => setShowRefDrawer(!showRefDrawer)}
                  className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showRefDrawer
                      ? 'bg-blue-500/20 text-blue-300 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Panel Referensi Kartu"
                >
                  <Icons.Layers size={14} />
                  <span>Referensi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsZenMode(!isZenMode)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/40 transition-colors cursor-pointer"
                  title={isZenMode ? 'Keluar Zen Mode' : 'Zen Mode'}
                >
                  {isZenMode ? <Icons.Minimize2 size={14} /> : <Icons.Maximize2 size={14} />}
                </button>

                {/* More Options Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <Icons.MoreHorizontal size={14} />
                  </button>

                  {showMoreMenu && (
                    <div className="absolute right-0 mt-2 w-44 app-bg-secondary border border-slate-700/60 rounded-xl shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={handleExportDocument}
                        className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer"
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

            {/* Google Docs Style Rich WYSIWYG Format Toolbar (Active ONLY in Edit Mode) */}
            {mode === 'editing' && (
              <div className="relative z-40 px-6 py-2 app-bg-secondary/90 border-b border-slate-800/40 backdrop-blur-md flex items-center gap-1.5 text-xs text-slate-300 shrink-0 select-none">
                {/* Header Style Select */}
                <select
                  onChange={(e) => {
                    handleHeaderChange(e.target.value);
                    e.target.value = '';
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="">Gaya Teks...</option>
                  <option value="p">Paragraf Normal</option>
                  <option value="h1">Judul Utama (H1)</option>
                  <option value="h2">Sub Judul (H2)</option>
                  <option value="h3">Bagian (H3)</option>
                </select>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Text Formatting Controls */}
                <button
                  type="button"
                  onClick={() => execCmd('bold')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 font-bold transition-colors"
                  title="Cetak Tebal (Bold)"
                >
                  <Icons.Bold size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('italic')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Cetak Miring (Italic)"
                >
                  <Icons.Italic size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('underline')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 underline transition-colors"
                  title="Garis Bawah (Underline)"
                >
                  <Icons.Underline size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('strikeThrough')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 line-through transition-colors"
                  title="Coret (Strikethrough)"
                >
                  <Icons.Strikethrough size={14} />
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Lists & Indentation */}
                <button
                  type="button"
                  onClick={() => execCmd('insertUnorderedList')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Daftar Poin (Bullet List)"
                >
                  <Icons.List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('insertOrderedList')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Daftar Angka (Numbered List)"
                >
                  <Icons.ListOrdered size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('indent')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Tambah Indentasi"
                >
                  <Icons.Indent size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => execCmd('outdent')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Kurangi Indentasi (Outdent)"
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
            <div className="flex-1 flex overflow-hidden relative">
              {mode === 'viewing' ? (
                /* VIEWING MODE: Clean Rendered Document */
                <div className="flex-1 overflow-y-auto px-6 py-10 flex justify-center app-bg-main">
                  <div className="w-full max-w-2xl flex flex-col space-y-6">
                    <div className="border-b border-slate-800 pb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">
                          {activeDoc.title || 'Dokumen Tanpa Judul'}
                        </h1>
                        <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                          {CATEGORIES.find((c) => c.id === activeDoc.category)?.label || 'Cerita'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
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
                      className="prose prose-invert max-w-none text-base leading-relaxed text-slate-200 space-y-4 font-sans"
                      dangerouslySetInnerHTML={{ __html: activeDoc.content || '<p class="text-slate-500 italic">Dokumen kosong...</p>' }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        const cardId = target.getAttribute('data-card-id');
                        if (cardId && onOpenCard) {
                          const found = cards.find((c) => c.id === cardId);
                          if (found) onOpenCard(found);
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* EDITING MODE: Interactive Google Docs Style ContentEditable Canvas */
                <div className="flex-1 overflow-y-auto px-6 py-10 flex justify-center">
                  <div className="w-full max-w-2xl flex flex-col space-y-6 relative">
                    {/* Category Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-semibold">Kategori:</span>
                      <select
                        value={draftCategory}
                        onChange={(e) => setDraftCategory(e.target.value as DocumentCategory)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
                      >
                        {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Clean Title Input */}
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="Judul naskah..."
                      className="w-full text-3xl font-extrabold tracking-tight app-text-main bg-transparent border-0 focus:outline-none placeholder:text-slate-700"
                    />

                    {/* Live ContentEditable Canvas (Google Docs Style WYSIWYG) */}
                    <div className="relative flex-1 flex flex-col">
                      <div
                        id="doc-editor-textarea"
                        ref={editorRef}
                        contentEditable={true}
                        onKeyUp={handleEditorKeyUp}
                        className="w-full flex-1 bg-transparent text-base leading-relaxed app-text-main focus:outline-none resize-none font-sans space-y-3 p-1 min-h-[650px] border-0"
                      />

                      {/* Inline @ Mention Suggestion Overlay */}
                      {mentionState.isOpen && (
                        <div className="absolute top-12 left-0 w-72 app-bg-secondary border border-blue-500/40 rounded-2xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 space-y-1">
                          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800 flex items-center justify-between">
                            <span>Sisipkan Kartu (@)</span>
                            <span className="text-blue-400">{suggestedCards.length} ditemukan</span>
                          </div>

                          {suggestedCards.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-500 text-center">
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
                                  <div className="text-xs font-bold text-slate-200 group-hover:text-blue-300 truncate">
                                    {card.title}
                                  </div>
                                  {card.subtitle && (
                                    <div className="text-[10px] text-slate-500 truncate">
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
                    <span className="text-xs font-bold text-slate-300">Referensi Kartu</span>
                    <button
                      type="button"
                      onClick={() => setShowRefDrawer(false)}
                      className="text-slate-500 hover:text-white"
                    >
                      <Icons.X size={14} />
                    </button>
                  </div>

                  <select
                    value={selectedRefCard?.id || ''}
                    onChange={(e) => {
                      const found = cards.find((c) => c.id === e.target.value);
                      setSelectedRefCard(found || null);
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-lg app-bg-main border border-slate-800 app-text-main focus:outline-none cursor-pointer"
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
                      <p className="text-slate-400 leading-relaxed text-xs">
                        {selectedRefCard.summary || 'Tidak ada ringkasan.'}
                      </p>
                      {selectedRefCard.content && (
                        <div className="p-3 rounded-xl bg-slate-900/60 text-slate-300 text-xs leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
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
                    <p className="text-xs text-slate-500 text-center py-8">
                      Pilih kartu untuk dibaca sambil mengetik.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Clean Minimal Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3 select-none">
            <Icons.Edit3 size={28} className="opacity-30" />
            <p className="text-xs">Pilih atau buat dokumen baru untuk mulai menulis.</p>
            <button
              type="button"
              onClick={() => handleCreateDocument('story')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              + Buat Dokumen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

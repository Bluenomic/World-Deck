import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import * as Icons from 'lucide-react';

interface HelpGuideModalProps {
  onClose: () => void;
}

type TabType = 'canvas' | 'library' | 'timeline' | 'documents';

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ onClose }) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('canvas');

  const tabs: { id: TabType; titleId: string; titleEn: string; icon: any; color: string }[] = [
    { id: 'canvas', titleId: 'Papan Kartu', titleEn: 'Card Canvas', icon: Icons.LayoutGrid, color: 'text-amber-400' },
    { id: 'library', titleId: 'Galeri & Dek', titleEn: 'Library & Decks', icon: Icons.Library, color: 'text-purple-400' },
    { id: 'timeline', titleId: 'Garis Waktu', titleEn: 'Timeline', icon: Icons.Clock, color: 'text-emerald-400' },
    { id: 'documents', titleId: 'Dokumen', titleEn: 'Documents', icon: Icons.BookOpen, color: 'text-blue-400' },
  ];

  const currentTabIdx = tabs.findIndex((t) => t.id === activeTab);

  const handleNextPage = () => {
    if (currentTabIdx < tabs.length - 1) {
      setActiveTab(tabs[currentTabIdx + 1].id);
    }
  };

  const handlePrevPage = () => {
    if (currentTabIdx > 0) {
      setActiveTab(tabs[currentTabIdx - 1].id);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-150 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="app-bg-secondary border app-border w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden app-text-main transition-colors modal-animate-appear cursor-default relative divide-y divide-slate-800/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 app-bg-main flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src="/wd-logo-circle.png"
              alt="World Deck Logo"
              className="w-10 h-10 object-contain rounded-2xl shadow-md border app-border"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase app-accent-bg text-white shadow-xs">
                  Tutorial
                </span>
                <h2 className="text-base font-bold app-text-main">
                  {language === 'en' ? 'World Deck User Manual' : 'Tutorial Penggunaan World Deck'}
                </h2>
              </div>
              <p className="text-xs app-text-muted mt-0.5">
                {language === 'en'
                  ? 'Complete guide explaining all features across 4 app views'
                  : 'Panduan lengkap penggunaan seluruh fitur di 4 halaman aplikasi'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl app-bg-secondary border app-border flex items-center justify-center app-text-muted hover:app-text-main hover:app-bg-hover transition-colors cursor-pointer"
          >
            <Icons.X size={16} />
          </button>
        </div>

        {/* 4 Navigation Tabs Header Bar */}
        <div className="px-6 py-2.5 app-bg-main border-b app-border flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
                  isActive
                    ? 'app-bg-secondary app-text-main border-[var(--accent)] shadow-md'
                    : 'app-text-muted hover:app-text-main border-transparent hover:app-bg-hover'
                }`}
              >
                <Icon size={14} className={tab.color} />
                <span>
                  {idx + 1}. {language === 'en' ? tab.titleEn : tab.titleId}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Body (4 Tab Pages) */}
        <div className="flex-1 overflow-y-auto p-6 text-xs leading-relaxed space-y-5 custom-scrollbar">
          {/* TAB 1: CANVAS */}
          {activeTab === 'canvas' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                <Icons.LayoutGrid size={22} className="shrink-0 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {language === 'en' ? '1. Card Canvas View' : '1. Halaman Papan Kartu (Canvas)'}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {language === 'en'
                      ? 'Freeform infinite board to map entity cards and establish visual relationship networks.'
                      : 'Kanvas tak terbatas untuk memetakan ide, menyusun kartu entitas, dan merancang jaringan relasi visual.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.PlusCircle size={15} />
                    <span>{language === 'en' ? 'Creating Cards' : 'Membuat Kartu Baru'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Double-click anywhere on the empty canvas space to instantly spawn a new card at that coordinate, or click "+ New Card" on the top bar.'
                      : 'Klik ganda (double-click) di area kosong kanvas untuk membuat kartu baru di posisi tersebut, atau klik tombol "+ Kartu Baru".'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.Link size={15} />
                    <span>{language === 'en' ? 'Connecting Cards' : 'Menghubungkan Garis Relasi'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Hover your mouse over a card. Click and drag the blue "+" handle on the right side of the card to another target card to draw a relationship line.'
                      : 'Arahkan kursor ke kartu. Klik dan tahan bulatan biru "+" di Sisi Kanan Kartu, lalu tarik garis koneksi ke kartu target untuk membuat relasi (misal: Tokoh -> Tempat).'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.Move size={15} />
                    <span>{language === 'en' ? 'Pan & Zoom Navigation' : 'Navigasi Pan & Zoom'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Click & drag empty canvas space to pan around. Use Ctrl + Mouse Wheel or the zoom controls in the bottom right corner to zoom in/out.'
                      : 'Klik & tahan area kosong kanvas untuk menggeser (Pan). Gunakan Ctrl + Scroll Wheel atau tombol zoom + / - di kanan bawah untuk memperbesar/memperkecil.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.Layers size={15} />
                    <span>{language === 'en' ? 'Grouping Cards into Decks' : 'Pengelompokan dalam Dek'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Select multiple cards and drag them together into a Deck region to organize complex worlds into neat regional folders.'
                      : 'Pilih beberapa kartu sekaligus lalu seret ke dalam Dek/Wilayah untuk mengelompokkan entitas ke dalam folder wilayah yang rapi.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
                <Icons.Library size={22} className="shrink-0 text-purple-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {language === 'en' ? '2. Library & Decks View' : '2. Halaman Galeri & Dek (Library)'}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {language === 'en'
                      ? 'Organized central repository to filter cards, manage decks, and read detailed card profiles.'
                      : 'Katalog terstruktur untuk menyaring kartu, mengelola kelompok dek, dan membaca profil lengkap entitas.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.Grid size={15} />
                    <span>{language === 'en' ? 'Grid vs List View Mode' : 'Mode Tampilan Grid & List'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Switch between visual card tiles (Grid View) or clean data tables (List View) for fast sorting and searching.'
                      : 'Beralih antara tampilan ubin visual (Grid View) atau tabel daftar ringkas (List View) untuk mencari data dengan cepat.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.FolderPlus size={15} />
                    <span>{language === 'en' ? 'Custom Deck Collections' : 'Manajemen Dek & Folder'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Create custom decks (e.g. Main Characters, Kingdom Factions, Magic Spells) to isolate and manage specific groups.'
                      : 'Buat Dek Khusus (seperti Tokoh Utama, Faksi Kerajaan, Artefak Kuno) untuk memisahkan daftar entitas besar.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.Filter size={15} />
                    <span>{language === 'en' ? 'Category Filtering' : 'Penyaringan Kategori'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Filter entities by category badges (Characters, Locations, Items, Factions, Lore Concepts, or Custom Categories).'
                      : 'Filter cepat entitas berdasarkan kategori (Karakter, Lokasi, Item, Faksi, Konsep Lore, atau Kategori Kustom).'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.Sidebar size={15} />
                    <span>{language === 'en' ? 'Reader & Editor Sidebar' : 'Reader Sidebar & Editor'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Click any card to open the Reader Sidebar. Edit cover photos, image galleries, story summaries, custom attributes, and relations.'
                      : 'Klik kartu untuk membuka Reader Sidebar. Edit foto sampul, galeri foto, ringkasan cerita, atribut khusus (Status, Ras), dan relasi.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                <Icons.Clock size={22} className="shrink-0 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {language === 'en' ? '3. Timeline View' : '3. Halaman Garis Waktu (Timeline)'}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {language === 'en'
                      ? 'Chronological world history mapping, historical events, and parallel branching timelines.'
                      : 'Pemetaan urutan kronologis sejarah dunia, peristiwa penting, dan percabangan waktu paralel.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.PlusSquare size={15} />
                    <span>{language === 'en' ? 'Adding Event Nodes' : 'Menambah Peristiwa (Event Node)'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Double-click on any timeline track or right-click to choose "Add Event Here" to log a historical milestone.'
                      : 'Klik ganda pada garis waktu atau klik kanan di track untuk memilih "Tambah Kejadian" untuk mencatat titik peristiwa.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.GitBranch size={15} />
                    <span>{language === 'en' ? 'Parallel Timelines ("+ Parallel Timeline Here")' : 'Timeline Paralel ("+ Garis Waktu Paralel di Sini")'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Right-click on empty timeline canvas space. The system detects your cursor position (above, between, or below tracks) and inserts a new parallel track at that location.'
                      : 'Klik kanan di area kosong canvas timeline. Sistem mendeteksi posisi kursor Anda (di atas, di antara, atau di bawah timeline) dan menyisipkan timeline baru tepat di posisi kursor.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.GitCommit size={15} />
                    <span>{language === 'en' ? 'Connecting Branch Lines' : 'Menyambungkan Percabangan Waktu'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Right-click an event node -> select "Create Time Branch" -> then directly left-click an event on another timeline track to establish a branch connection.'
                      : 'Klik kanan pada titik peristiwa -> pilih "Buat Percabangan Waktu" -> lalu klik kiri langsung pada titik peristiwa di timeline lain untuk menyambungkannya.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.Image size={15} />
                    <span>{language === 'en' ? 'Event Images & Lightbox' : 'Galeri Foto Kejadian & Lightbox'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Upload multiple photos to an event. Click any thumbnail in the event detail sidebar to view it in full screen (Fullscreen Lightbox Viewer).'
                      : 'Unggah beberapa gambar di peristiwa. Klik thumbnail pada sidebar detail peristiwa untuk memperbesar gambar layar penuh (Lightbox Viewer).'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300">
                <Icons.BookOpen size={22} className="shrink-0 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {language === 'en' ? '4. Documents View' : '4. Halaman Dokumen Worldbuilding'}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {language === 'en'
                      ? 'Integrated Rich Text manuscript editor to write stories, novel chapters, world lore, and session notes.'
                      : 'Editor naskah Rich Text terpadu untuk menulis bab novel, cerita lore dunia, dan catatan sesi.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.FileText size={15} />
                    <span>{language === 'en' ? 'Rich Text & Markdown Editor' : 'Editor Rich Text & Formatting'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Write story manuscripts with rich formatting support (Headings, Bold, Italics, Bullet Lists, Blockquotes, and Code Blocks).'
                      : 'Tulis naskah dengan format kaya seperti Judul (Heading), Cetak Tebal, Miring, Daftar Bullets, Kutipan (Blockquote), dan Kode.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.AtSign size={15} />
                    <span>{language === 'en' ? 'Interactive Card Mentions (@)' : 'Sebutan Kartu Interaktif (@)'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Type the "@" symbol anywhere in your document to open card suggestions. Clicking a mention turns it into an interactive link to inspect card lore!'
                      : 'Ketik simbol "@" di mana saja dalam dokumen untuk membuka rujukan kartu. Klik sebutan tersebut untuk langsung membaca profil kartu terkait!'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.PanelRight size={15} />
                    <span>{language === 'en' ? 'Quick Reference Sidebar' : 'Sidebar Rujukan Kartu Cepat'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Open the right reference sidebar to look up character lore, location info, or item stats while writing without leaving your draft.'
                      : 'Buka sidebar kartu di sebelah kanan editor untuk membaca lore tokoh/dunia saat menulis naskah tanpa perlu menutup dokumen.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl app-bg-main border app-border space-y-2">
                  <h4 className="font-bold text-xs app-accent-text flex items-center gap-1.5">
                    <Icons.Maximize size={15} />
                    <span>{language === 'en' ? 'Distraction-Free Mode' : 'Mode Bebas Gangguan'}</span>
                  </h4>
                  <p className="app-text-muted">
                    {language === 'en'
                      ? 'Collapse the document list sidebar to enter a distraction-free writing environment optimized for immersive storytelling.'
                      : 'Sembunyikan panel daftar dokumen untuk masuk ke tampilan menulis bebas gangguan yang fokus dan nyaman.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-6 py-3.5 app-bg-main flex items-center justify-between">
          <div className="text-xs font-mono font-semibold app-text-muted">
            {language === 'en'
              ? `Page ${currentTabIdx + 1} of ${tabs.length}`
              : `Halaman ${currentTabIdx + 1} dari ${tabs.length}`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentTabIdx === 0}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                currentTabIdx === 0
                  ? 'opacity-40 border-transparent cursor-not-allowed app-text-muted'
                  : 'app-bg-secondary border-app-border hover:app-bg-hover app-text-main'
              }`}
            >
              <Icons.ChevronLeft size={14} />
              <span>{language === 'en' ? 'Previous' : 'Sebelumnya'}</span>
            </button>

            {currentTabIdx < tabs.length - 1 ? (
              <button
                type="button"
                onClick={handleNextPage}
                className="px-4 py-1.5 rounded-xl app-accent-bg text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer hover:opacity-90 shadow-md"
              >
                <span>{language === 'en' ? 'Next Page' : 'Selanjutnya'}</span>
                <Icons.ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-md"
              >
                <Icons.Check size={14} />
                <span>{language === 'en' ? 'Got It & Close' : 'Mengerti & Tutup'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

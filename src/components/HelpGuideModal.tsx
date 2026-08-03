import React from 'react';
import * as Icons from 'lucide-react';

interface HelpGuideModalProps {
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 backdrop-animate-appear cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="app-bg-secondary border app-border w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden app-text-main transition-colors modal-animate-appear cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 app-bg-main border-b app-border flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src="/wd-logo-circle.png"
              alt="World Deck Logo"
              className="w-10 h-10 object-contain rounded-xl shadow-md border app-border"
            />
            <div>
              <h2 className="text-base font-bold app-text-main">Panduan World Deck</h2>
              <p className="text-xs app-text-muted">Petunjuk penggunaan dan panduan worldbuilding canvas</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 app-text-muted hover:app-text-main rounded-lg hover:app-bg-hover"
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs leading-relaxed app-text-main">
          
          {/* Section 1 */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold app-accent-text flex items-center gap-1.5">
              <Icons.Sparkles size={15} />
              <span>1. Cara Menghubungkan Kartu di Canvas</span>
            </h3>
            <p className="app-text-muted">
              Arahkan kursor mouse ke kartu manapun di Canvas. Tombol bulatan **`+`** berwarna biru di sisi kanan kartu akan muncul. Klik dan tahan tombol `+` tersebut, lalu tarik garis koneksi ke kartu target untuk membuat relasi hubungan.
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold app-accent-text flex items-center gap-1.5">
              <Icons.Compass size={15} />
              <span>2. Navigasi & Zoom Canvas</span>
            </h3>
            <ul className="list-disc list-inside space-y-1.5 app-text-muted pl-1">
              <li>
                <strong className="app-text-main">Geser Canvas (Pan)</strong>: Klik dan tahan area kosong canvas lalu geser mouse, atau gunakan touch gesture di HP/tablet.
              </li>
              <li>
                <strong className="app-text-main">Zoom Canvas</strong>: Gunakan **`Ctrl + Scroll Wheel`** mouse atau tombol pemutar zoom `+` / `-` di sudut kanan bawah canvas.
              </li>
              <li>
                <strong className="app-text-main">Membuat Kartu Cepat</strong>: Klik ganda (*double click*) pada area kosong canvas untuk langsung membuat kartu baru di posisi tersebut.
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold app-accent-text flex items-center gap-1.5">
              <Icons.Smartphone size={15} />
              <span>3. Panduan Build Aplikasi Native PC & Android dengan Tauri v2</span>
            </h3>
            <p className="app-text-muted">
              Aplikasi ini dikembangkan menggunakan struktur standar **Vite + React + TypeScript** yang 100% kompatibel untuk di-package menjadi aplikasi desktop (.exe) dan Android (.apk) menggunakan **Tauri v2**.
            </p>
            
            <div className="p-3.5 rounded-xl app-bg-main border app-border font-mono text-[11px] space-y-2">
              <p className="text-emerald-400 font-bold"># Perintah Inisialisasi Tauri (Jalankan di Terminal Proyek):</p>
              <div className="bg-black/40 p-2.5 rounded border border-slate-800 text-slate-300 space-y-1">
                <p><span className="text-blue-400">npx</span> @tauri-apps/cli init</p>
                <p><span className="text-emerald-400"># Untuk Android Package:</span></p>
                <p><span className="text-blue-400">npx</span> tauri android init</p>
                <p><span className="text-blue-400">npx</span> tauri android build</p>
              </div>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold app-accent-text flex items-center gap-1.5">
              <Icons.Database size={15} />
              <span>4. Penyimpanan Multi-Dunia & Ekspor</span>
            </h3>
            <p className="app-text-muted">
              Semua dunia dan kartu yang Anda buat tersimpan secara otomatis di memori lokal browser. Anda dapat membuat beberapa dunia terpisah, menduplikat, atau mengekspor berkas `.json` melalui menu **Pengelola Dunia** di sudut kiri atas.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 app-bg-main border-t app-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 app-accent-bg text-white rounded-lg text-xs font-semibold"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

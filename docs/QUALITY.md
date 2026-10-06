# Peningkatan kualitas World Deck

Lima tahap mempertahankan Canvas, Library, Timeline, Documents dan Map serta editor HTML. Perubahan workspace yang sudah ada tetap dipertahankan. Tidak ada commit atau publikasi otomatis.

## Urutan review

| Tahap             | Kontrak dan implementasi                                                                                                                                                          | Bukti validasi sebelum tahap berikutnya                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Workspace      | `workspacePersistence.ts`, adapter browser/Tauri, antrean bersama, acknowledgment workspace/proyek/revisi, failure per proyek, retry, flush, create/duplicate/delete async di App | 13 tes Playwright awal                                          |
| 2. Integritas     | Descriptor `projectSchema.json`, validator TypeScript/Rust dan fixture bersama, tipe Map Rust, laporan primary/backup, detach kartu dalam satu undo, referensi asli dipertahankan | 23 tes Playwright dan 3 tes Rust                                |
| 3. Documents      | `documentDrafts.ts`, `useDocumentDraft.ts`, scope workspace/proyek/dokumen, autosave 750 ms, backup 5 detik, DOMPurify, mention DOM, caret/undo editor                            | 28 tes Playwright                                               |
| 4. State/performa | Reducer proyek/history/revisi, transaksi sesi editor, 50 undo, Timeline controlled dan preview lokal, indeks/memo/culling Canvas 200 px, fokus dialog                             | 32 tes Playwright dan benchmark produksi                        |
| 5. Validasi       | Strict TypeScript, lint tanpa warning, mock window/folder/error, CI Windows + Chromium, output screenshot terisolasi, regresi tambahan dan benchmark terdokumentasi               | 44 tes Playwright, 5 tes Rust, 3 smoke desktop, typecheck/lint/build |

Modul baru dapat direview per baris tabel. App dan tampilan mengintegrasikan tahap-tahap tersebut; perubahan lanjutan pada tahap kelima menambahkan regresi dan melengkapi kasus referensi/gambar yang ditemukan tes.

## Kontrak penyimpanan

- `WorldProject.schemaVersion` adalah `1`; `version` tetap versi milik proyek. Input JSON diterima sebagai `unknown`. Legacy tanpa schema dinormalisasi dalam memori; membuka proyek tidak menulis berkas. Edit berikutnya menyimpan format baru dan membuat backup primary lama yang valid.
- Load menghasilkan `projects`, `sources` (primary/backup), dan `issues` dengan kode, lokasi field, severity, serta nama berkas/proyek jika tersedia. Primary berformat lebih baru ditolak, termasuk jika backup lama tersedia. Struktur rusak dapat dipulihkan dari backup; backup rusak dilaporkan.
- Save/delete memakai target yang ditangkap saat operasi dibuat. `WorkspaceOperationError.failure` dan daftar failure coordinator bertipe. Sukses proyek lain tidak menutupi kegagalan. Delete memblokir perubahan sampai berhasil, mengantre setelah save sebelumnya, dan menghapus primary serta backup sebelum mengeluarkan proyek dari UI. Aset yang tidak dipakai tetap disimpan.
- Save memvalidasi/sanitasi dokumen tanpa membersihkan referensi. Delete kartu melalui UI membersihkan deck/relasi, melepas tautan kartu Timeline/pin/faksi, dan mempertahankan event/pin/shape serta mention dan teks asli. Undo memulihkan snapshot sebelumnya.
- Semua perpindahan proyek/workspace dan penutupan desktop melewati flush. Browser melakukan backup draft sinkron pada beforeunload/pagehide. Backup draft dihapus sesudah acknowledgment snapshot yang sesuai; identitas folder browser memakai `isSameEntry`, sehingga dua folder bernama sama tidak berbagi draft.

## Editor dan history

Autosave membaca DOM tanpa mengganti `innerHTML`. MutationObserver juga mencatat perubahan layout/crop gambar. HTML disanitasi pada load, paste, save dan render; hanya format, raster image, link, mention, dan atribut layout/crop yang didukung dipertahankan. Caption dan wrapper gambar tetap dapat diedit pada mode editing. Mention memakai `textContent`, dan referensi hilang diberi penanda.

Selama fokus di contenteditable, Ctrl+Z/Y memakai undo editor. Undo proyek melakukan flush lalu menutup sesi editing sebelum memulihkan history. Sesi dokumen dikelompokkan dengan transaction ID; drag Timeline/Map serta resize Canvas menyimpan satu commit. Reducer mengembalikan state yang sama untuk no-op dan memakai structural sharing tanpa `JSON.stringify` seluruh proyek.

## Pemeriksaan yang dapat diulang

```powershell
npm ci
npm run typecheck
npm run lint
npm run build
npm test
npm run test:rust
```

Lokal memakai Microsoft Edge. Untuk Chromium: `npx playwright install chromium`, lalu `$env:WORLD_DECK_BROWSER='chromium'` sebelum `npm test`. Pada CI, Playwright menggunakan Chromium, dua worker, server baru, reporter HTML, dan screenshot hanya di `test-results`. Workflow `quality.yml` memakai Windows, lockfile npm/Rust, serta mengunggah report dan screenshot ketika pemeriksaan berakhir.

Suite dikelompokkan dalam persistence/workspace smoke, validation/integrity, documents, state-timeline, dan map. File JSON validator yang sama dibaca tes TypeScript dan Rust. Tes browser memakai IPC Tauri simulasi dan OPFS terisolasi; tes Rust membuat direktori temporer sendiri.

[Benchmark produksi dan lima pengukuran sebelum/sesudah](BENCHMARK.md) memiliki target penurunan median respons frame Canvas minimal 30%.

## Smoke desktop

Smoke pada executable Tauri/Windows asli sudah lolos untuk dialog folder OS, flush draft saat penutupan, serta pemulihan backup tanpa menulis ulang primary yang rusak. Harness `scripts/native-smoke.mjs` membuat workspace dan profil WebView2 baru di `node_modules/.tmp`, mengendalikan picker milik proses uji melalui UI Automation, lalu memeriksa isi berkas sesudah proses ditutup. Workspace pribadi tidak digunakan. Report dan screenshot disimpan di `test-results/native-smoke`.

Pemeriksaan ini menemukan izin `core:window:allow-destroy` yang belum tersedia. Izin tersebut kini ada di capability default, sehingga alur `onCloseRequested` dapat menyelesaikan penutupan setelah flush berhasil.

Untuk mengulang, gunakan Windows dengan WebView2 dan sesi desktop interaktif. Port 9227 harus tersedia. Bangun frontend dan executable debug, lalu jalankan preview pada port devUrl Tauri:

```powershell
npm run build
cargo build --locked --manifest-path src-tauri/Cargo.toml
# Terminal pertama:
npx vite preview --host 127.0.0.1 --port 5173 --strictPort
# Terminal kedua:
npm run test:desktop
```

Mock Tauri juga memverifikasi kegagalan save yang memblokir close hingga retry, kontrol jendela, serta pergantian workspace. Rust menguji atomic write, backup recovery, versi format tidak didukung, aset hilang, dan penghapusan primary/backup. Smoke GUI asli merupakan pemeriksaan lokal tambahan; workflow CI menjalankan Chromium dan tes Rust tanpa bergantung pada desktop interaktif.

Workflow GitHub Actions belum dijalankan di runner remote dalam sesi ini. Typecheck, lint tanpa warning, build, 44 tes Playwright dengan konfigurasi CI/server baru, 5 tes Rust, serta ketiga smoke desktop telah lolos lokal.

## Dependency

DOMPurify dikunci pada 3.4.16. Audit npm pada sesi implementasi masih melaporkan advisory dependency tooling Tailwind 3 (braces/micromatch, parser selector dan source-map). Migrasi mayor Tailwind memerlukan review terpisah agar styling tidak berubah di luar rencana ini; CI saat ini tidak menjadikan audit sebagai gate.

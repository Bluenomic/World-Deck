# Benchmark Canvas produksi

Diukur pada 6 Oktober 2026 dengan build Vite produksi, Microsoft Edge 154.0.4258.53 headless, viewport 1280 × 800, zoom 1, sidebar tertutup. Mesin yang sama: Windows build 10.0.26100, AMD Ryzen 7 5800H with Radeon Graphics, RAM terdeteksi 15 GiB, Node v22.16.0. Kedua pengukuran dijalankan berurutan setelah build dan tes selesai.

Fixture berisi **1.000 kartu, 2.000 relasi, 100 dokumen**. Setiap pengukuran membuka halaman baru. `readyMs` menghitung waktu sejak startup halaman sampai dua animation frame setelah kartu pertama terlihat. `panMedianMs` adalah median waktu dari event pan hingga animation frame berikutnya: 20 gerakan sintetis, tiga gerakan awal dibuang. Ini metrik respons frame Canvas secara menyeluruh, termasuk React, layout, dan penjadwalan browser; bukan pengukuran CPU React Profiler saja.

Baseline adalah snapshot produksi sebelum tahap optimasi Canvas, setelah fondasi penyimpanan dan editor. Hasil akhir memakai build produksi seluruh lima tahap. Data mentah: [sebelum](benchmarks/canvas-before.json), [sesudah](benchmarks/canvas-after.json).

| Pengukuran | Siap sebelum (ms) | Siap sesudah (ms) | Pan sebelum (ms) | Pan sesudah (ms) |
| ---------- | ----------------: | ----------------: | ---------------: | ---------------: |
| 1          |            1665.0 |             483.5 |            148.1 |              7.0 |
| 2          |            1330.7 |             310.9 |            158.0 |              7.0 |
| 3          |            1623.9 |             316.2 |            191.1 |              7.0 |
| 4          |            1658.4 |             316.3 |            140.3 |              6.9 |
| 5          |            1280.7 |             320.8 |            144.4 |              6.9 |
| **Median** |        **1623.9** |         **316.3** |        **148.1** |          **7.0** |

Median respons frame pan turun **95.3%**, melampaui target 30%. Median startup turun 80.5%. Jumlah kartu DOM pada akhir pan turun dari 1.000 menjadi 20; seluruh 1.000 kartu tetap berada dalam data proyek. Node yang dipilih, sedang disambungkan, atau sedang di-drag selalu dirender. Seleksi dan auto-layout memakai seluruh data.

## Mengulang

1. Siapkan dua checkout atau direktori build: sebelum optimasi dan sesudah optimasi. Build keduanya dengan `npm ci` dan `npm run build`. Simpan output di dua direktori terpisah sebelum melanjutkan perubahan kode.
2. Jalankan preview produksi masing-masing, misalnya `npx vite preview --outDir PATH_BEFORE --port 5180 --strictPort` dan `npx vite preview --outDir PATH_AFTER --port 5182 --strictPort`.
3. Di PowerShell, jalankan benchmark berurutan:

```powershell
$env:BENCHMARK_URL = 'http://127.0.0.1:5180'
$env:BENCHMARK_OUTPUT = 'node_modules/.tmp/before.json'
npm run benchmark:canvas
$env:BENCHMARK_URL = 'http://127.0.0.1:5182'
$env:BENCHMARK_OUTPUT = 'node_modules/.tmp/after.json'
npm run benchmark:canvas
```

Script menjalankan lima pengukuran per build, mencatat versi browser/mesin, dan tidak mengakses workspace pribadi. Gunakan mesin, versi browser, viewport dan kondisi beban yang sama. Jalankan tes interaksi Canvas/Timeline/Map setelah pengukuran untuk memeriksa regresi. Angka ini berlaku untuk fixture dan mesin di atas; fixture terutama mengukur navigasi Canvas padat, bukan seluruh pola penggunaan proyek.

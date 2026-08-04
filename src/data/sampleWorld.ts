import type { WorldProject } from '../types';

export const SAMPLE_WORLD: WorldProject = {
  id: 'world-new-01',
  name: 'Dunia Baru Saya',
  description: 'Arsip worldbuilding kustom. Mulai tambahkan karakter, lokasi, faksi, item, dan peristiwa.',
  author: 'Penulis / Worldbuilder',
  version: '1.0.0',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  cards: [],
  connections: [],
  documents: [
    {
      id: 'doc-sample-1',
      title: 'Mukadimah: Bangkitnya Elemen Rahasia',
      content: '# Mukadimah: Bangkitnya Elemen Rahasia\n\nDi balik bukit pasir Valoria, angin kuno berhembus membawa pesan masa lalu. Catatan ini menyimpan kisah awal mula perjalanan para wira...\n\n- Bab 1: Pertemuan di Gerbang Awal\n- Bab 2: Rahasia Sihir Yang Hilang\n',
      category: 'story',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
};

async function protectAdminPage() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('nama, role')
    .eq('id', session.user.id)
    .single();

  if (error || !profile || profile.role !== 'admin') {
    alert("Halaman ini khusus Admin.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById('userInfo').innerHTML = `Halo, ${profile.nama || session.user.email} (admin)`;
}

protectAdminPage();

function findColIndex(headerRow, predicate) {
  for (let i = 0; i < headerRow.length; i++) {
    const val = headerRow[i];
    if (val && predicate(String(val).toUpperCase())) return i;
  }
  return -1;
}

document.getElementById('prosesBtn').addEventListener('click', async function () {
  const statusMsg = document.getElementById('statusMsg');
  const shpFile = document.getElementById('shpInput').files[0];
  const dd1File = document.getElementById('dd1Input').files[0];
  const tahun = document.getElementById('tahunInput').value;

  if (!shpFile || !dd1File || !tahun) {
    statusMsg.textContent = "Lengkapi tahun, file SHP, dan file Excel dulu.";
    return;
  }

  statusMsg.textContent = "Memproses file SHP...";

  const shpArrayBuffer = await shpFile.arrayBuffer();
  let geojson = await shp(shpArrayBuffer);
  if (Array.isArray(geojson)) {
    geojson = geojson[0];
  }
  console.log("=== Hasil baca SHP ===");
  console.log("Jumlah ruas:", geojson.features.length);

  statusMsg.textContent = "Memproses file Excel DD1...";

  const dd1ArrayBuffer = await dd1File.arrayBuffer();
  const workbook = XLSX.read(dd1ArrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Cari baris yang mengandung "NAMA RUAS" sebagai titik acuan
  const anchorRowIndex = allRows.findIndex(row =>
    row.some(cell => cell && String(cell).toUpperCase().includes("NAMA RUAS"))
  );

  if (anchorRowIndex === -1) {
    statusMsg.textContent = "Tidak ditemukan baris header di Excel. Cek format file.";
    return;
  }

  // Gabungkan beberapa baris di sekitar acuan (header bertingkat) jadi satu "header gabungan"
  const blockStart = Math.max(0, anchorRowIndex - 2);
  const blockEnd = anchorRowIndex + 2;
  const mergedHeader = [];
  for (let r = blockStart; r <= blockEnd; r++) {
    const row = allRows[r] || [];
    row.forEach((val, i) => {
      if (val) mergedHeader[i] = (mergedHeader[i] ? mergedHeader[i] + " " : "") + String(val);
    });
  }
  console.log("=== Header gabungan ===");
  console.log(mergedHeader);

  const colNoRuas = findColIndex(mergedHeader, t => t.startsWith("NO") && t.includes("RUAS"));
  const colNamaRuas = findColIndex(mergedHeader, t => t.includes("NAMA") && t.includes("RUAS"));
  const colKecamatan = findColIndex(mergedHeader, t => t.includes("KECAMATAN"));
  const colPanjang = findColIndex(mergedHeader, t => t.includes("PANJANG") && t.includes("RUAS"));
  const colLebar = findColIndex(mergedHeader, t => t.includes("LEBAR") && t.includes("RUAS"));
  const colHotmix = findColIndex(mergedHeader, t => t.includes("HOTMIX"));
  const colLapen = findColIndex(mergedHeader, t => t.includes("LAPEN") || t.includes("MACADAM"));
  const colPerkerasanBeton = findColIndex(mergedHeader, t => t.includes("PERKERASAN") && t.includes("BETON"));
  const colTelford = findColIndex(mergedHeader, t => t.includes("TELFORD") || t.includes("KERIKIL"));
  const colTanah = findColIndex(mergedHeader, t => t.includes("TANAH"));
  const colBaik = findColIndex(mergedHeader, t => t.includes("BAIK"));
  const colSedang = findColIndex(mergedHeader, t => t.includes("SEDANG"));
  const colRusakRingan = findColIndex(mergedHeader, t => t.includes("RUSAK") && t.includes("RINGAN"));
  const colRusakBerat = findColIndex(mergedHeader, t => t.includes("RUSAK") && t.includes("BERAT"));
  // Kolom % selalu tepat di sebelah kanan kolom KM masing-masing kategori
  const colBaikPersen = colBaik + 1;
  const colSedangPersen = colSedang + 1;
  const colRusakRinganPersen = colRusakRingan + 1;
  const colRusakBeratPersen = colRusakBerat + 1;
  const colLhr = findColIndex(mergedHeader, t => t.includes("LHR"));
  const colAkses = findColIndex(mergedHeader, t => t.includes("AKSES"));
  const colKet = findColIndex(mergedHeader, t => t.startsWith("KET"));

  console.log("=== Posisi kolom yang ditemukan ===");
  console.log({ colNoRuas, colNamaRuas, colKecamatan, colPanjang, colLebar, colHotmix, colLapen, colPerkerasanBeton, colTelford, colTanah, colBaik, colBaikPersen, colSedang, colSedangPersen, colRusakRingan, colRusakRinganPersen, colRusakBerat, colRusakBeratPersen, colLhr, colAkses, colKet });

  // Cari baris data pertama secara otomatis: baris di mana kolom "nama ruas" berisi TEKS (bukan angka)
  let dataStartIndex = anchorRowIndex + 1;
  while (dataStartIndex < allRows.length) {
    const row = allRows[dataStartIndex];
    const namaVal = row && row[colNamaRuas];
    if (namaVal && isNaN(namaVal)) break;
    dataStartIndex++;
  }
  console.log("=== Baris data pertama ditemukan di index:", dataStartIndex, "===");

  const dataRows = allRows.slice(dataStartIndex);

    const dd1Data = dataRows
    .filter(row => row[colNoRuas] && row[colNamaRuas])
    .map(row => {
      const baikKm = parseFloat(row[colBaik]) || 0;
      const sedangKm = parseFloat(row[colSedang]) || 0;
      const rusakRinganKm = parseFloat(row[colRusakRingan]) || 0;
      const rusakBeratKm = parseFloat(row[colRusakBerat]) || 0;

      const kondisiMap = { baik: baikKm, sedang: sedangKm, rusak_ringan: rusakRinganKm, rusak_berat: rusakBeratKm };
      const kondisiDominan = Object.keys(kondisiMap).reduce((a, b) => kondisiMap[a] >= kondisiMap[b] ? a : b);

      return {
        ruas_id: String(row[colNoRuas]).trim(),
        nama_ruas: row[colNamaRuas],
        kecamatan: row[colKecamatan],
        panjang_km: parseFloat(row[colPanjang]) || 0,
        kondisi: kondisiDominan,
        lebar_m: parseFloat(row[colLebar]) || 0,
        hotmix_km: parseFloat(row[colHotmix]) || 0,
        lapen_km: parseFloat(row[colLapen]) || 0,
        perkerasan_beton_km: parseFloat(row[colPerkerasanBeton]) || 0,
        telford_km: parseFloat(row[colTelford]) || 0,
        tanah_km: parseFloat(row[colTanah]) || 0,
        baik_km: baikKm,
        baik_persen: parseFloat(row[colBaikPersen]) || 0,
        sedang_km: sedangKm,
        sedang_persen: parseFloat(row[colSedangPersen]) || 0,
        rusak_ringan_km: rusakRinganKm,
        rusak_ringan_persen: parseFloat(row[colRusakRinganPersen]) || 0,
        rusak_berat_km: rusakBeratKm,
        rusak_berat_persen: parseFloat(row[colRusakBeratPersen]) || 0,
        lhr: parseFloat(row[colLhr]) || 0,
        akses_jalan: row[colAkses] || '',
        keterangan: row[colKet] || ''
      };
    });

  console.log("=== Data DD1 setelah dipetakan ===");
  console.log("Jumlah ruas valid:", dd1Data.length);
  console.log("Contoh ruas pertama:", dd1Data[0]);
  console.log("Contoh ruas kedua:", dd1Data[1]);
  console.log("Contoh ruas ketiga:", dd1Data[2]);

    // Cocokkan data SHP dengan data DD1 berdasarkan ruas_id (OBJECTID_1 <-> NO. RUAS)
  const dd1Map = {};
  dd1Data.forEach(item => { dd1Map[item.ruas_id] = item; });

  const gabungan = [];
  const shpTanpaDD1 = [];

  geojson.features.forEach(feature => {
    const ruasId = String(feature.properties.OBJECTID_1).trim();
    const dd1Item = dd1Map[ruasId];

    if (!dd1Item) {
      shpTanpaDD1.push(ruasId);
      return;
    }

    gabungan.push({
      ...dd1Item,
      ruas_id: ruasId,
      geometry: feature.geometry
    });
  });

  console.log("=== Hasil Pencocokan ===");
  console.log("Jumlah ruas berhasil digabung:", gabungan.length);
  console.log("Ruas SHP yang TIDAK ada di DD1 (perlu dicek):", shpTanpaDD1);
  console.log("Contoh hasil gabungan pertama:", gabungan[0]);

  statusMsg.textContent = `Selesai diproses. ${gabungan.length} ruas berhasil digabung. Cek Console untuk detail.`;

  // Cek apakah ini upload pertama (baseline) - lihat apakah tabel ruas_jalan masih kosong
  const { count } = await supabaseClient
    .from('ruas_jalan')
    .select('*', { count: 'exact', head: true });

  const isBaseline = count === 0;
  console.log("Apakah ini upload pertama (baseline)?", isBaseline);

  // Tampilkan preview sederhana
  const previewContainer = document.getElementById('previewContainer');
  let tableHtml = `
    <h3>Preview Data (${gabungan.length} ruas) ${isBaseline ? '— Data Baseline Pertama' : ''}</h3>
    <table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%; background: white; font-size: 13px;">
      <tr style="background:#e5e7eb;">
        <th>Ruas ID</th><th>Nama Ruas</th><th>Kecamatan</th><th>Panjang (KM)</th><th>Kondisi</th>
      </tr>
  `;
  gabungan.slice(0, 10).forEach(item => {
    tableHtml += `<tr>
      <td>${item.ruas_id}</td><td>${item.nama_ruas}</td><td>${item.kecamatan}</td>
      <td>${item.panjang_km}</td><td>${item.kondisi}</td>
    </tr>`;
  });
  tableHtml += `</table>`;
  tableHtml += `<p style="font-size:13px; color:#666;">Menampilkan 10 dari ${gabungan.length} ruas.</p>`;
  tableHtml += `<button id="konfirmasiBtn" style="margin-top:12px; padding:10px 20px; background:#16a34a; color:white; border:none; border-radius:4px; cursor:pointer;">Konfirmasi & Simpan ke Database</button>`;

  previewContainer.innerHTML = tableHtml;

  window._dataUntukDisimpan = { gabungan, tahun: parseInt(tahun), isBaseline };
});
document.addEventListener('click', async function (e) {
  if (e.target.id !== 'konfirmasiBtn') return;

  const btn = e.target;
  const statusMsg = document.getElementById('statusMsg');
  const { gabungan, tahun, isBaseline } = window._dataUntukDisimpan;

  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  // 1. Simpan ke tabel ruas_jalan (geometri + info dasar)
  const ruasJalanRows = gabungan.map(item => ({
    ruas_id: item.ruas_id,
    nama_ruas: item.nama_ruas,
    kecamatan: item.kecamatan,
    panjang_km: item.panjang_km,
    geometry: item.geometry
  }));

  const { error: errorRuas } = await supabaseClient
    .from('ruas_jalan')
    .upsert(ruasJalanRows, { onConflict: 'ruas_id' });

  if (errorRuas) {
    statusMsg.textContent = "Gagal menyimpan data ruas_jalan.";
    console.error(errorRuas);
    btn.disabled = false;
    btn.textContent = "Konfirmasi & Simpan ke Database";
    return;
  }

  // 2. Simpan ke tabel riwayat_kondisi (kondisi tahun ini)
  const riwayatRows = gabungan.map(item => ({
    ruas_id: item.ruas_id,
    tahun: tahun,
    kondisi: item.kondisi,
    status: 'disurvei', // baseline pertama - semua otomatis disurvei
    lebar_m: item.lebar_m,
    hotmix_km: item.hotmix_km,
    lapen_km: item.lapen_km,
    perkerasan_beton_km: item.perkerasan_beton_km,
    telford_km: item.telford_km,
    tanah_km: item.tanah_km,
    baik_km: item.baik_km,
    baik_persen: item.baik_persen,
    sedang_km: item.sedang_km,
    sedang_persen: item.sedang_persen,
    rusak_ringan_km: item.rusak_ringan_km,
    rusak_ringan_persen: item.rusak_ringan_persen,
    rusak_berat_km: item.rusak_berat_km,
    rusak_berat_persen: item.rusak_berat_persen,
    lhr: item.lhr,
    akses_jalan: item.akses_jalan,
    keterangan: item.keterangan
  }));

  const { error: errorRiwayat } = await supabaseClient
    .from('riwayat_kondisi')
    .upsert(riwayatRows, { onConflict: 'ruas_id,tahun' });

  if (errorRiwayat) {
    statusMsg.textContent = "Gagal menyimpan data riwayat_kondisi.";
    console.error(errorRiwayat);
    btn.disabled = false;
    btn.textContent = "Konfirmasi & Simpan ke Database";
    return;
  }

  statusMsg.innerHTML = `<strong style="color:#16a34a;">✅ Berhasil! ${gabungan.length} ruas tersimpan ke database untuk tahun ${tahun}.</strong>`;
  btn.textContent = "Tersimpan ✓";
  document.getElementById('previewContainer').innerHTML = '';
});
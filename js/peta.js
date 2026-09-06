const warnaKondisi = {
  baik: '#22c55e',
  sedang: '#eab308',
  rusak_ringan: '#f97316',
  rusak_berat: '#ef4444'
};

const map = L.map('map').setView([3.6, 125.5], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let semuaRuasData = [];
let layerByRuasId = {};

function ambilLatLngs(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'LineString') {
    return geometry.coordinates.map(c => [c[1], c[0]]);
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.map(line => line.map(c => [c[1], c[0]]));
  }
  return null;
}

async function muatPeta() {
  const { data: ruasList, error: errorRuas } = await supabaseClient
    .from('ruas_jalan')
    .select('*');

  if (errorRuas) {
    console.error(errorRuas);
    alert("Gagal memuat data ruas jalan.");
    return;
  }
  
  // Ambil semua riwayat penanganan
  const { data: penangananList, error: errorPenanganan } = await supabaseClient
    .from('riwayat_penanganan')
    .select('*')
    .order('tahun', { ascending: false });

  if (errorPenanganan) {
    console.error(errorPenanganan);
  }

  // Kelompokkan riwayat penanganan per ruas_id
  const penangananMap = {};
  (penangananList || []).forEach(item => {
    if (!penangananMap[item.ruas_id]) penangananMap[item.ruas_id] = [];
    penangananMap[item.ruas_id].push(item);
  });

  function formatRupiah(angka) {
    if (!angka) return '-';
    return 'Rp ' + Number(angka).toLocaleString('id-ID');
  }

  const { data: riwayatList, error: errorRiwayat } = await supabaseClient
    .from('riwayat_kondisi')
    .select('*')
    .order('tahun', { ascending: false });

  if (errorRiwayat) {
    console.error(errorRiwayat);
    alert("Gagal memuat data kondisi.");
    return;
  }

  const kondisiTerkini = {};
  riwayatList.forEach(item => {
    if (!kondisiTerkini[item.ruas_id]) {
      kondisiTerkini[item.ruas_id] = item;
    }
  });

  const semuaRuasGroup = L.featureGroup().addTo(map);
  let jumlahBermasalah = 0;

  ruasList.forEach(ruas => {
    const kondisiInfo = kondisiTerkini[ruas.ruas_id];
    const kondisi = kondisiInfo ? kondisiInfo.kondisi : 'baik';
    const warna = warnaKondisi[kondisi] || '#999';

    const coordsLatLng = ambilLatLngs(ruas.geometry);

    if (!coordsLatLng) {
      jumlahBermasalah++;
      console.warn("Geometri tidak dikenali untuk ruas:", ruas.ruas_id, ruas.geometry ? ruas.geometry.type : ruas.geometry);
      return;
    }

    const polyline = L.polyline(coordsLatLng, { color: warna, weight: 4 });
        const daftarPenanganan = penangananMap[ruas.ruas_id] || [];
    let penangananHtml = '';
    if (daftarPenanganan.length > 0) {
      penangananHtml = '<hr style="margin:6px 0;"><strong>Riwayat Penanganan:</strong><br>';
      daftarPenanganan.forEach(p => {
        penangananHtml += `
          ${p.tahun} - ${p.jenis_penanganan || '-'}<br>
          No. Kontrak: ${p.nomor_kontrak || '-'}<br>
          Nilai: ${formatRupiah(p.nilai_kontrak)}<br>
          Penyedia: ${p.penyedia_jasa || '-'}<br><br>
        `;
      });
    }

    polyline.bindPopup(`
      <strong>${ruas.nama_ruas}</strong><br>
      Kecamatan: ${ruas.kecamatan}<br>
      Panjang: ${ruas.panjang_km} km<br>
      Kondisi (${kondisiInfo ? kondisiInfo.tahun : '-'}): <strong>${kondisi.replace('_', ' ')}</strong>
      ${penangananHtml}
    `);

    polyline.addTo(semuaRuasGroup);

    layerByRuasId[ruas.ruas_id] = polyline;
    semuaRuasData.push(ruas);
  });

  if (jumlahBermasalah > 0) {
    console.warn(`${jumlahBermasalah} ruas memiliki geometri bertipe tidak dikenali dan dilewati.`);
  }

  setTimeout(() => {
    map.invalidateSize();
    if (semuaRuasGroup.getLayers().length > 0) {
      map.fitBounds(semuaRuasGroup.getBounds());
    }
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
  }, 300);

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML = `
      <strong>Kondisi</strong><br>
      <span style="background:${warnaKondisi.baik}"></span> Baik<br>
      <span style="background:${warnaKondisi.sedang}"></span> Sedang<br>
      <span style="background:${warnaKondisi.rusak_ringan}"></span> Rusak Ringan<br>
      <span style="background:${warnaKondisi.rusak_berat}"></span> Rusak Berat
    `;
    return div;
  };
  legend.addTo(map);
}

muatPeta();

// ==== Fitur Cari Ruas Jalan ====
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', function () {
  const query = this.value.trim().toLowerCase();
  searchResults.innerHTML = '';

  if (query.length < 2) {
    searchResults.style.display = 'none';
    return;
  }

  const hasil = semuaRuasData.filter(ruas =>
    ruas.nama_ruas && ruas.nama_ruas.toLowerCase().includes(query)
  ).slice(0, 8);

  if (hasil.length === 0) {
    searchResults.innerHTML = '<div style="padding:8px; color:#999;">Tidak ditemukan</div>';
    searchResults.style.display = 'block';
    return;
  }

  hasil.forEach(ruas => {
    const item = document.createElement('div');
    item.textContent = `${ruas.nama_ruas} (${ruas.kecamatan})`;
    item.style.padding = '8px';
    item.style.cursor = 'pointer';
    item.style.borderBottom = '1px solid #eee';
    item.addEventListener('mouseenter', () => item.style.background = '#f3f4f6');
    item.addEventListener('mouseleave', () => item.style.background = 'white');
    item.addEventListener('click', () => pilihRuas(ruas));
    searchResults.appendChild(item);
  });

  searchResults.style.display = 'block';
});

function pilihRuas(ruas) {
  const layer = layerByRuasId[ruas.ruas_id];
  if (!layer) return;

  map.fitBounds(layer.getBounds(), { maxZoom: 16 });
  layer.openPopup();

  const warnaAsli = layer.options.color;
  layer.setStyle({ color: '#3b82f6', weight: 8 });
  setTimeout(() => {
    layer.setStyle({ color: warnaAsli, weight: 4 });
  }, 2000);

  searchResults.style.display = 'none';
  searchInput.value = ruas.nama_ruas;
}
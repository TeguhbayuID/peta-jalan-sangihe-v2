let semuaRuas = [];
let ruasTerpilihId = null;

async function protectAdminPage() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return false;
  }
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('nama, role')
    .eq('id', session.user.id)
    .single();
  if (error || !profile || profile.role !== 'admin') {
    alert("Halaman ini khusus Admin.");
    window.location.href = "index.html";
    return false;
  }
  document.getElementById('userInfo').innerHTML = `Halo, ${profile.nama || session.user.email} (admin)`;
  return true;
}

function formatRupiah(angka) {
  if (!angka) return '-';
  return 'Rp ' + Number(angka).toLocaleString('id-ID');
}

async function init() {
  const boleh = await protectAdminPage();
  if (!boleh) return;

  const { data: ruasList } = await supabaseClient.from('ruas_jalan').select('ruas_id, nama_ruas, kecamatan');
  semuaRuas = ruasList;

  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  searchInput.addEventListener('input', function () {
    const query = this.value.trim().toLowerCase();
    searchResults.innerHTML = '';
    if (query.length < 2) {
      searchResults.style.display = 'none';
      return;
    }
    const hasil = semuaRuas.filter(r => r.nama_ruas && r.nama_ruas.toLowerCase().includes(query)).slice(0, 8);
    if (hasil.length === 0) {
      searchResults.innerHTML = '<div style="color:#999;">Tidak ditemukan</div>';
    } else {
      hasil.forEach(ruas => {
        const div = document.createElement('div');
        div.textContent = `${ruas.nama_ruas} (${ruas.kecamatan})`;
        div.addEventListener('click', () => pilihRuas(ruas));
        searchResults.appendChild(div);
      });
    }
    searchResults.style.display = 'block';
  });

  document.getElementById('simpanBtn').addEventListener('click', simpanData);
  document.getElementById('batalEditBtn').addEventListener('click', batalEdit);
}

function pilihRuas(ruas) {
  ruasTerpilihId = ruas.ruas_id;
  document.getElementById('ruasTerpilih').textContent = `Ruas terpilih: ${ruas.nama_ruas} (${ruas.kecamatan})`;
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('searchInput').value = ruas.nama_ruas;
  document.getElementById('formCard').style.display = 'block';
  document.getElementById('tabelCard').style.display = 'block';
  muatRiwayatPenanganan();
}

async function muatRiwayatPenanganan() {
  const { data, error } = await supabaseClient
    .from('riwayat_penanganan')
    .select('*')
    .eq('ruas_id', ruasTerpilihId)
    .order('tahun', { ascending: false });

  const tbody = document.querySelector('#tabelRiwayat tbody');
  tbody.innerHTML = '';

  if (error) {
    console.error(error);
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999;">Belum ada riwayat penanganan</td></tr>';
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.tahun}</td>
      <td>${item.jenis_penanganan || '-'}</td>
      <td>${item.nomor_kontrak || '-'}</td>
      <td>${formatRupiah(item.nilai_kontrak)}</td>
      <td>${item.penyedia_jasa || '-'}</td>
      <td>
        <button class="edit-btn" onclick='mulaiEdit(${JSON.stringify(item)})'>Edit</button>
        <button class="hapus-btn" onclick="hapusData(${item.id})">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function mulaiEdit(item) {
  document.getElementById('formTitle').textContent = 'Edit Riwayat Penanganan';
  document.getElementById('editId').value = item.id;
  document.getElementById('tahunInput').value = item.tahun;
  document.getElementById('jenisInput').value = item.jenis_penanganan || '';
  document.getElementById('kontrakInput').value = item.nomor_kontrak || '';
  document.getElementById('nilaiInput').value = item.nilai_kontrak || '';
  document.getElementById('penyediaInput').value = item.penyedia_jasa || '';
  document.getElementById('keteranganInput').value = item.keterangan || '';
  document.getElementById('batalEditBtn').style.display = 'inline-block';
  window.scrollTo(0, document.getElementById('formCard').offsetTop);
}

function batalEdit() {
  document.getElementById('formTitle').textContent = 'Tambah Riwayat Penanganan';
  document.getElementById('editId').value = '';
  document.getElementById('tahunInput').value = '';
  document.getElementById('jenisInput').value = '';
  document.getElementById('kontrakInput').value = '';
  document.getElementById('nilaiInput').value = '';
  document.getElementById('penyediaInput').value = '';
  document.getElementById('keteranganInput').value = '';
  document.getElementById('batalEditBtn').style.display = 'none';
}

async function simpanData() {
  const editId = document.getElementById('editId').value;
  const payload = {
    ruas_id: ruasTerpilihId,
    tahun: parseInt(document.getElementById('tahunInput').value),
    jenis_penanganan: document.getElementById('jenisInput').value,
    nomor_kontrak: document.getElementById('kontrakInput').value,
    nilai_kontrak: parseFloat(document.getElementById('nilaiInput').value) || null,
    penyedia_jasa: document.getElementById('penyediaInput').value,
    keterangan: document.getElementById('keteranganInput').value
  };

  if (!payload.tahun) {
    alert("Tahun wajib diisi.");
    return;
  }

  let error;
  if (editId) {
    ({ error } = await supabaseClient.from('riwayat_penanganan').update(payload).eq('id', editId));
  } else {
    ({ error } = await supabaseClient.from('riwayat_penanganan').insert(payload));
  }

  if (error) {
    alert("Gagal menyimpan data.");
    console.error(error);
    return;
  }

  batalEdit();
  muatRiwayatPenanganan();
}

async function hapusData(id) {
  if (!confirm("Yakin ingin menghapus riwayat ini?")) return;
  const { error } = await supabaseClient.from('riwayat_penanganan').delete().eq('id', id);
  if (error) {
    alert("Gagal menghapus data.");
    console.error(error);
    return;
  }
  muatRiwayatPenanganan();
}

init();
# 🚀 Panduan Release Multi-Platform & Sertifikasi Keamanan (Anti-Malware)

Dokumentasi ini menjelaskan cara kerja GitHub Actions Workflow untuk melakukan *build* dan *bundling* otomatis ke semua platform, serta cara konfigurasi sertifikat digital resmi agar aplikasi tidak dianggap sebagai *malware* atau *unknown publisher* oleh sistem operasi (macOS Gatekeeper dan Windows SmartScreen).

---

## 1. Daftar Platform Hasil Build Otomatis

Setiap kali Anda membuat tag versi baru (misal `v0.1.0`), GitHub Actions di file `.github/workflows/release.yml` akan secara paralel memproses:

| Platform | Format File Installer | Arsitektur CPU |
| :--- | :--- | :--- |
| **macOS (Apple Silicon)** | `.dmg` dan `.app` (Stapled / Notarized) | M1 / M2 / M3 / M4 (`aarch64-apple-darwin`) |
| **macOS (Intel Core)** | `.dmg` dan `.app` (Stapled / Notarized) | Intel x64 (`x86_64-apple-darwin`) |
| **Windows** | `.exe` (NSIS Installer) dan `.msi` | 64-bit (`x86_64-pc-windows-msvc`) |
| **Linux Desktop** | `.deb` (Debian/Ubuntu) dan `.AppImage` | 64-bit (`x86_64-unknown-linux-gnu`) |
| **VPS Server (Docker)** | Image Container di GitHub Packages (`ghcr.io`) | Multi-Arch: `linux/amd64` dan `linux/arm64` |
| **VPS Server (Non-Docker)** | Skrip instalasi otomatis *systemd* service | Skrip satu baris via `install-vps.sh` |

---

## 2. Mengapa OS Menampilkan Peringatan "Sumber Tidak Diketahui / Malware"?

Sistem operasi modern (terutama macOS dan Windows) memiliki mekanisme pertahanan ketat terhadap aplikasi baru:

1. **macOS Gatekeeper:**
   Jika aplikasi tidak ditandatangani menggunakan sertifikat *Apple Developer ID* dan tidak diverifikasi oleh server Apple (*Notarization*), macOS akan menampilkan pesan:
   > *"Apple cannot check it for malicious software"* atau *"App is damaged and can't be opened"*.

2. **Windows Defender SmartScreen:**
   Jika file `.exe` tidak ditandatangani dengan sertifikat *Authenticode (Code Signing)* resmi, Windows akan memblokir peluncuran dengan layar biru:
   > *"Windows protected your PC: Unknown publisher"*.

---

## 3. Konfigurasi Sertifikat Resmi di GitHub Actions

Agar aplikasi Anda dipercaya sepenuhnya oleh sistem operasi tanpa muncul peringatan di atas, masukkan *Secret Keys* berikut ke dalam **Repository Settings > Secrets and variables > Actions**:

### A. Untuk macOS (Apple Developer ID & Notarization)
1. Ekspor sertifikat **Developer ID Application** dari Keychain Access ke file `.p12`.
2. Ubah file `.p12` menjadi string base64:
   ```bash
   base64 -i AuthKey.p12 | pbcopy
   ```
3. Tambahkan rahasia berikut di GitHub Repository:
   - `APPLE_CERTIFICATE`: Isi string base64 dari file `.p12`.
   - `APPLE_CERTIFICATE_PASSWORD`: Password file `.p12`.
   - `APPLE_SIGNING_IDENTITY`: Nama identitas sertifikat (contoh: `Developer ID Application: Notane (TEAM_ID)`).
   - `APPLE_ID`: Alamat email Apple Developer Anda.
   - `APPLE_PASSWORD`: App-Specific Password (dibuat di [appleid.apple.com](https://appleid.apple.com)).
   - `APPLE_TEAM_ID`: 10 karakter ID Tim Apple Developer Anda.

> Saat secret di atas terisi, GitHub Actions akan otomatis menandatangani binary dan mengirimkannya ke server Apple untuk proses Notarisasi resmi. File `.dmg` yang dihasilkan akan bebas dari blokir Gatekeeper.

### B. Untuk Windows (Authenticode Signing)
1. Siapkan sertifikat *Code Signing* (format `.pfx` dari CA seperti DigiCert, Sectigo, atau SignPath).
2. Ubah file `.pfx` menjadi string base64:
   ```bash
   certutil -encode cert.pfx cert.txt
   ```
3. Tambahkan rahasia berikut di GitHub Repository:
   - `WINDOWS_CERTIFICATE`: Isi string base64 dari file `.pfx`.
   - `WINDOWS_CERTIFICATE_PASSWORD`: Password sertifikat `.pfx`.

---

## 4. Cara Buka Jika Belum Memiliki Akun Developer Berbayar

Jika Anda mendistribusikan versi beta internal sebelum membeli lisensi Apple Developer / Windows Certificate:

- **Pengguna macOS:**
  1. Klik kanan pada aplikasi > pilih **Open** > klik **Open**.
  2. Atau jalankan perintah terminal sekali saja:
     ```bash
     xattr -cr "/Applications/Notane LibSQL Management.app"
     ```
- **Pengguna Windows:**
  1. Klik tautan teks **More info** (*Info selengkapnya*).
  2. Klik tombol **Run anyway** (*Tetap jalankan*).

---

## 5. Cara Memicu Build Rilis Otomatis

### Opsi 1: Lewat Git Tag (Rilis Produksi)
Jalankan perintah ini di terminal lokal Anda:

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions akan otomatis mendeteksi tag tersebut, melakukan kompilasi seluruh platform, dan membuat draft rilis resmi di halaman GitHub Releases repository Anda.

### Opsi 2: Manual Lewat GitHub Web UI
1. Buka tab **Actions** di repository GitHub Anda.
2. Pilih workflow **Release & Multi-Platform Bundles**.
3. Klik tombol **Run workflow**.

---

## 6. Cara Deploy di VPS Server

### A. Menggunakan Docker / Docker Compose
Cukup buat file `docker-compose.yml` di VPS Anda:

```yaml
version: '3.8'

services:
  notane-libsql:
    image: ghcr.io/<username-github>/notane-libsql-management:latest
    container_name: notane-libsql-server
    restart: unless-stopped
    ports:
      - "8080:8080" # Port Query HTTP
      - "127.0.0.1:8082:8082" # Port Admin (akses lokal)
    volumes:
      - libsql-data:/var/lib/sqld

volumes:
  libsql-data:
```

Jalankan:
```bash
docker compose up -d
```

### B. Menggunakan Skrip Tanpa Docker (Native Linux Service)
Pada VPS Ubuntu, Debian, atau CentOS, jalankan perintah satu baris berikut sebagai root:

```bash
curl -fsSL https://raw.githubusercontent.com/<username-github>/notane-libsql-management/main/scripts/install-vps.sh | sudo bash
```

Skrip ini akan mengunduh binary resmi sesuai arsitektur CPU VPS Anda (x86_64 atau ARM64), membuat user sistem `sqld`, dan mendaftarkan service `systemd` yang otomatis berjalan saat VPS dinyalakan (*auto-restart*).

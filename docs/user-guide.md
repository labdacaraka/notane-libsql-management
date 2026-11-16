# 📖 Panduan Penggunaan Lengkap: Notane LibSQL Management

Dokumentasi ini menjelaskan tata cara penggunaan Notane LibSQL Management, arsitektur port, mekanisme otentikasi, serta panduan menghubungkan database ke berbagai aplikasi client seperti **libSQL Studio**, **aplikasi mobile Android (POS)**, **backend SDK**, dan **cURL**.

---

## 1. Konsep Utama & Arsitektur

Notane LibSQL Management berfungsi ganda di komputer Anda:
1. **Engine Server**: Menjalankan binary `sqld` (engine open-source Turso libSQL) secara lokal di komputer Anda sehingga komputer bertindak sebagai database server independen di jaringan lokal (LAN) maupun internet.
2. **Dashboard Manajemen**: Mengelola pembuatan instance, database (namespace), pasangan kunci kriptografi Ed25519, dan penerbitan token JWT melalui antarmuka grafis (GUI).

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Komputer Server Notane                            │
│                                                                        │
│   [ Client Aplikasi ] ──> HTTP Port (8080) ──> [ Smart Reverse Proxy ] │
│   (libSQL Studio / POS)                             │ (Otentikasi &    │
│                                                     │  Routing DB)     │
│                                                     ▼                  │
│   [ Notane GUI ] ────> Admin Port (8082) ───> [ sqld Engine Core ]     │
│   (Internal CRUD DB)                           (Multi-tenant DBs)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Perbedaan HTTP Port vs Admin Port

Setiap kali Anda membuat instance baru, Anda akan diminta mengisi **HTTP Port** dan **Admin Port**. Kedua port ini memiliki fungsi yang berbeda:

| Fitur | HTTP Port (misal: `8080`) | Admin Port (misal: `8082`) |
| :--- | :--- | :--- |
| **Tujuan Utama** | Lalu lintas query data SQL (DQL, DML, DDL). | Manajemen internal engine database. |
| **Pengguna** | Aplikasi client: libSQL Studio, Mobile POS, Backend API, dsb. | Sistem Notane LibSQL Management (GUI). |
| **Protokol** | libSQL Wire Protocol, WebSocket, HTTP Pipeline (`/v2/pipeline`). | HTTP REST API khusus perintah administrasi `sqld`. |
| **Jenis Operasi** | `SELECT`, `INSERT`, `UPDATE`, `CREATE TABLE`, transaksi. | Buat namespace database baru, hapus database, fork, injeksi public key. |
| **Otentikasi** | Database JWT Token (ditandatangani Ed25519 per database). | Admin Secret Auth Key (Bearer Token statis). |
| **Akses Jaringan** | Perlu dibuka ke jaringan LAN (`0.0.0.0`) agar bisa diakses client. | Cukup lokal (`127.0.0.1`) atau dijaga ketat agar tidak disalahgunakan. |

> [!WARNING]
> Jangan pernah memasukkan **Admin Port** ke dalam aplikasi client data (seperti libSQL Studio atau aplikasi POS). Aplikasi client **harus selalu terhubung ke HTTP Port**.

---

## 3. Mekanisme Smart Reverse Proxy

Pada mode multi-tenant `sqld`, beberapa database (namespace) hidup di bawah satu proses server. Untuk mencegah error `400 Bad Request: namespace ... doesn't exist` atau `404 Not Found` pada client standar seperti libSQL Studio dan Android SDK, Notane LibSQL Management menyertakan **Smart Reverse Proxy** bawaan.

Ketika client mengirim query ke HTTP Port, proxy akan mendeteksi target database secara otomatis melalui:

1. **Klaim Token JWT (`ns`)**:
   Setiap token yang Anda buat dari menu **Token** di aplikasi secara otomatis menyertakan identitas namespace database di dalam payload JWT. Proxy membaca klaim ini dan langsung mengarahkan query ke database yang benar.
2. **Kecocokan Signature Kriptografi**:
   Proxy mencocokkan verifikasi tanda tangan token dengan pasangan kunci Ed25519 yang terdaftar di database.
3. **URL Path Namespace**:
   Mendukung penulisan URL berbasis path seperti `http://<ip>:<port>/v1/namespaces/<nama_db>/...`.
4. **Subdomain Routing**:
   Mendukung pemanggilan via Host header seperti `<nama_db>.localhost:<port>`.
5. **Single Database Fallback**:
   Jika instance hanya memiliki satu database, semua query tanpa namespace otomatis dialihkan ke database tersebut.

---

## 4. Panduan Langkah Demi Langkah

### Langkah 1: Membuat & Menjalankan Instance
1. Buka aplikasi Notane LibSQL Management.
2. Klik tombol **New Instance** di navigasi atas.
3. Masukkan parameter:
   - **Instance Name**: Nama pengenal server (contoh: `pos_production`).
   - **HTTP Port**: Port client data (default: `8080`).
   - **Admin Port**: Port administrasi internal (default: `8082`).
   - **Listen Address**:
     - Pilih `0.0.0.0` jika ingin server dapat diakses dari perangkat lain di LAN/Wi-Fi.
     - Pilih `127.0.0.1` jika server hanya digunakan di komputer ini saja.
   - **Admin Auth Key**: Biarkan kosong untuk membuat kunci acak aman secara otomatis.
4. Klik **Create Instance**.
5. Pada kartu instance yang baru dibuat, klik tombol hijau **Start**. Status akan berubah menjadi **Starting...** lalu **Running**.

---

### Langkah 2: Membuat Database (Namespace)
1. Pada kartu instance yang sedang berjalan, klik tombol **Databases**.
2. Klik tombol **Create Database**.
3. Masukkan nama database (gunakan huruf kecil, angka, garis bawah: contoh `store_central`).
4. Pastikan opsi **Generate Ed25519 Keypair automatically** tercentang.
5. Klik **Create Database**. Kunci publik kriptografi akan didaftarkan ke engine `sqld`.

---

### Langkah 3: Membuat Auth Token (JWT)
1. Pada baris database yang ingin diakses, klik tombol biru **Token**.
2. Pilih konfigurasi token:
   - **Permission Level**:
     - `Read & Write (rw)`: Untuk aplikasi operasional (bisa membaca dan mengubah data).
     - `Read Only (ro)`: Untuk laporan atau dashboard analisis data saja.
   - **Token Expiration**: Pilih masa berlaku (7 hari, 30 hari, 1 tahun, atau `Never Expires`).
   - **Token Label**: Catatan pengenal (contoh: `Kasir Tablet 1`).
3. Klik **Generate New Token**.
4. Simpan nilai **Auth Token (JWT)** dan salin URL koneksi yang disediakan.

---

## 5. Panduan Koneksi dari Aplikasi Client

### 5.1. Koneksi dari LibSQL Studio

[libSQL Studio](https://github.com/MathieuLoutre/libsql-studio) adalah tool visual desktop/web untuk mengelola tabel dan isi database libSQL.

1. Buka libSQL Studio.
2. Buat koneksi baru dan pilih driver / provider: **libSQL / Turso**.
3. Masukkan parameter:
   - **URL**:
     - Jika berada di satu komputer yang sama:
       ```
       http://127.0.0.1:8080
       ```
     - Jika libSQL Studio dibuka dari komputer lain di jaringan LAN yang sama:
       ```
       http://192.168.x.x:8080
       ```
       *(Ganti `192.168.x.x` dengan LAN IP yang tertera pada kartu instance Notane)*.
   - **Auth Token**:
     Tempelkan string token JWT lengkap yang dihasilkan pada Langkah 3.
4. Klik **Connect**. libSQL Studio akan langsung menampilkan tabel-tabel dari database tersebut.

---

### 5.2. Koneksi dari Aplikasi Mobile Android (POS / Flutter / Kotlin / React Native)

Aplikasi mobile pada perangkat Android/iOS yang terhubung ke jaringan Wi-Fi lokal dapat langsung mengakses database:

1. **Pastikan Komputer dan Smartphone berada dalam satu jaringan Wi-Fi / LAN yang sama.**
2. Pada Notane LibSQL Management, catat alamat **LAN IP** yang ditampilkan di kartu database (misalnya: `http://192.168.0.199:8080`).
3. Pada form konfigurasi database di aplikasi Android:
   - **Database URL / Host**:
     ```
     http://192.168.0.199:8080
     ```
     *(Gunakan format URL dasar tanpa path tambahan).*
   - **Auth Token**:
     Masukkan token JWT lengkap milik database tersebut.
4. Aplikasi mobile sekarang dapat menjalankan query offline-first atau direct sync tanpa error 400 namespace.

---

### 5.3. Koneksi dari Node.js / TypeScript (@libsql/client)

Gunakan SDK resmi `@libsql/client`:

```typescript
import { createClient } from "@libsql/client";

const client = createClient({
  // Gunakan IP lokal jika di komputer yang sama, atau LAN IP jika dari server lain
  url: "http://192.168.0.199:8080",
  authToken: "eyJhbGciOiJFZERTQSI...", // Token JWT dari Notane
});

async function run() {
  const rs = await client.execute("SELECT datetime('now') as waktu, sqlite_version() as versi");
  console.log(rs.rows);
}

run();
```

---

### 5.4. Koneksi dari Python (libsql-client)

```python
import asyncio
import libsql_client

async def main():
    url = "http://192.168.0.199:8080"
    auth_token = "eyJhbGciOiJFZERTQSI..."

    async with libsql_client.create_client_service(url=url, auth_token=auth_token) as client:
        result = await client.execute("SELECT 'Koneksi Berhasil' AS status")
        for row in result.rows:
            print(row)

asyncio.run(main())
```

---

### 5.5. Koneksi Langsung melalui cURL (HTTP Pipeline API)

Anda dapat mengirim query SQL langsung melalui antarmuka HTTP REST API `sqld`:

```bash
curl -X POST "http://192.168.0.199:8080/v2/pipeline" \
  -H "Authorization: Bearer eyJhbGciOiJFZERTQSI..." \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "type": "execute",
        "stmt": { "sql": "SELECT 1 + 1 AS hasil" }
      },
      { "type": "close" }
    ]
  }'
```

---

## 6. Tips Keamanan & Pemecahan Masalah

### Firewall Sistem Operasi
Jika perangkat mobile atau komputer lain tidak dapat terhubung ke server Notane:
- **macOS**: Buka *System Settings > Network > Firewall*, pastikan aplikasi Notane LibSQL Management diizinkan menerima koneksi masuk (*incoming connections*).
- **Windows**: Buat aturan inbound pada *Windows Defender Firewall* untuk TCP port `8080`.
- **Linux**: Jalankan `sudo ufw allow 8080/tcp`.

### Menjaga IP Tetap Stabil (Static IP / DHCP Reservation)
Agar aplikasi client seperti Android POS tidak perlu mengganti alamat IP setiap hari:
- Atur pengaturan DHCP pada router Wi-Fi Anda untuk memberikan IP statis (*Static Lease*) ke komputer server Notane.

### Trigger WAL Checkpoint
libSQL menggunakan mode Write-Ahead Logging (WAL) untuk kinerja tinggi. Jika Anda ingin memastikan data di file WAL segera disinkronkan ke database utama SQLite di disk:
- Buka tampilan **Databases** pada instance terkait.
- Klik tombol **Checkpoint**. Indikator akan menampilkan **Checkpointing...** lalu **Done**.

### Melakukan Clone / Fork Database
Untuk keperluan pengujian atau backup cepat sebelum perubahan struktur tabel:
- Klik tombol ikon **Fork** di samping database.
- Masukkan nama database baru (misal: `store_central_testing`).
- Database baru akan langsung terklon secara independen dengan seluruh skema dan data yang sama pada titik waktu tersebut.

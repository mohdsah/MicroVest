# 🚀 MicroVest v8 — Panduan Deployment
## GitHub → Netlify → Supabase

---

## 📋 Keperluan Awal

| Tool | Versi | Muat Turun |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Git | Terbaru | [git-scm.com](https://git-scm.com) |
| Netlify CLI | Terbaru | `npm i -g netlify-cli` |
| Supabase CLI | Terbaru | `npm i -g supabase` |

---

## ⚡ Quick Start (Satu Arahan)

```bash
bash scripts/setup.sh
```

Atau ikut panduan manual di bawah.

---

## 🗄️ BAHAGIAN 1 — Supabase Setup

### 1.1 Cipta Projek Supabase

1. Pergi ke [supabase.com](https://supabase.com) → **New Project**
2. Isi:
   - **Name**: `microvest`
   - **Password**: Simpan dengan selamat
   - **Region**: Southeast Asia (Singapore)
3. Tunggu projek dibuat (~2 minit)

### 1.2 Jalankan Schema

1. Supabase Dashboard → **SQL Editor** → **New Query**
2. Copy isi `schema_v7.sql` → Paste → **Run**
3. Copy isi `supabase/migrations/20250309000002_v8_upgrades.sql` → Run

### 1.3 Tetapkan Admin Pertama

```sql
UPDATE profiles 
SET is_admin = TRUE 
WHERE email = 'emel-admin-anda@gmail.com';
```

### 1.4 Aktifkan Realtime

Supabase Dashboard → **Database** → **Replication** → Enable untuk:
- ✅ `transactions`
- ✅ `notifications`
- ✅ `profiles`
- ✅ `user_machines`
- ✅ `announcements`
- ✅ `support_tickets`
- ✅ `user_robots`
- ✅ `push_subscriptions`

### 1.5 Jana VAPID Keys (Push Notification)

```bash
npx web-push generate-vapid-keys
```

Output:
```
Public Key:  BEl62iUYgUivxIk...  ← Simpan ini
Private Key: abc123def456...      ← Simpan ini (RAHSIA!)
```

### 1.6 Supabase CLI Link (Pilihan — untuk migrations)

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

---

## 🌐 BAHAGIAN 2 — GitHub Setup

### 2.1 Cipta Repository

1. GitHub.com → **New repository**
2. Nama: `microvest` (atau pilihan anda)
3. **Private** (disyorkan untuk projek production)
4. Jangan init dengan README

### 2.2 Push Kod

```bash
cd /path/to/microvest-v8
git init
git add .
git commit -m "feat: MicroVest v8 initial release"
git branch -M main
git remote add origin https://github.com/USERNAME/microvest.git
git push -u origin main
```

### 2.3 Tambah GitHub Secrets

GitHub → Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name | Nilai / Cara Dapat |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify → User Settings → OAuth → Personal access tokens |
| `NETLIFY_SITE_ID` | Netlify → Site → Settings → General → **Site ID** |
| `SUPABASE_URL` | `https://[project-ref].supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → **anon / public** key |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → **service_role** key ⚠️ |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → **Access Tokens** |
| `SUPABASE_PROJECT_REF` | `zmyiaviafmmwpgxfvsbq` |
| `SUPABASE_DB_PASSWORD` | Password yang anda set masa buat projek |
| `VAPID_PUBLIC_KEY` | Dari `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Dari `npx web-push generate-vapid-keys` ⚠️ |
| `ADMIN_SECRET_KEY` | Jana sendiri: `openssl rand -hex 32` |

> ⚠️ **JANGAN** simpan `service_role` key atau `VAPID_PRIVATE_KEY` dalam kod!

### 2.4 Cipta Branch Structure

```bash
git checkout -b develop
git push origin develop

git checkout -b staging  
git push origin staging
```

| Branch | Tujuan | Auto-deploy |
|---|---|---|
| `main` | Production | ✅ Netlify Production |
| `develop` | Development | ✅ Netlify Preview |
| `feature/*` | Feature branches | PR Preview |

---

## 🔷 BAHAGIAN 3 — Netlify Setup

### 3.1 Buat Netlify Account & Site

1. [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Pilih **GitHub** → Pilih repo `microvest`
3. Build settings:
   - **Base directory**: (kosong)
   - **Build command**: (kosong / `echo done`)
   - **Publish directory**: `.`
4. Klik **Deploy site**

### 3.2 Tambah Environment Variables di Netlify

Netlify → Site → **Settings** → **Environment variables** → **Add variable**

```
SUPABASE_URL         = https://zmyiaviafmmwpgxfvsbq.supabase.co
SUPABASE_ANON_KEY    = eyJhbGci...
SUPABASE_SERVICE_KEY = eyJhbGci...  (service role)
VAPID_PUBLIC_KEY     = BEl62i...
VAPID_PRIVATE_KEY    = abc123...
VAPID_EMAIL          = mailto:admin@microvest.app
APP_VERSION          = 8.0
APP_ENV              = production
APP_URL              = https://microvest.app
ADMIN_SECRET_KEY     = your-secret-key
```

### 3.3 Custom Domain (Pilihan)

Netlify → Domain management → **Add custom domain** → `microvest.app`

DNS Settings (di domain registrar anda):
```
CNAME  www  →  your-site-name.netlify.app
A      @    →  75.2.60.5   (Netlify IP)
```

### 3.4 Deploy Manual

```bash
npm install -g netlify-cli
netlify login
netlify link  (pilih site anda)
netlify deploy --prod
```

---

## 🔄 BAHAGIAN 4 — CI/CD Pipeline

Selepas setup, setiap `git push` akan:

```
git push origin main
       ↓
GitHub Actions trigger
       ↓
[JOB 1] Validate
  ✅ Check HTML files
  ✅ Scan for secrets
  ✅ Verify required files
       ↓
[JOB 2] Deploy Production
  ✅ Inject env vars
  ✅ Netlify deploy --prod
  ✅ Create GitHub Release
       ↓
[JOB 3] Supabase Migration
  ✅ Apply new SQL migrations
  ✅ Deploy Edge Functions
```

### Workflow Harian:

```bash
# Kerja pada feature baru
git checkout -b feature/my-feature
# ... buat perubahan ...
git add .
git commit -m "feat: add new feature"
git push origin feature/my-feature

# Buat Pull Request → Preview deploy auto-dibuat
# Merge ke develop → Staging deploy
# Merge ke main → Production deploy
```

---

## 🔔 BAHAGIAN 5 — Web Push Setup

### 5.1 Jana VAPID Keys

```bash
npx web-push generate-vapid-keys --url-safe-base64
```

### 5.2 Kemas kini push.js

```javascript
// js/push.js — line ~15
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';
```

### 5.3 Deploy Netlify Function

Function sudah ada di `netlify/functions/send-push.js`.
Ia akan auto-deploy semasa Netlify deploy.

Test:
```bash
curl -X POST https://microvest.netlify.app/.netlify/functions/send-push \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_SECRET" \
  -d '{"title":"Test","message":"Push test!","target":"all"}'
```

---

## 🎯 BAHAGIAN 6 — Pengesahan Akhir

### Checklist Sebelum Live:

- [ ] Schema_v7.sql + migration 002 dijalankan
- [ ] Admin pertama ditetapkan (`is_admin=true`)
- [ ] Realtime diaktifkan untuk semua jadual
- [ ] VAPID keys ditetapkan dalam Netlify env vars
- [ ] GitHub Secrets semua diisi
- [ ] CI/CD pipeline berjaya (cek GitHub Actions)
- [ ] Netlify deploy berjaya
- [ ] Custom domain connected + SSL active
- [ ] Login berfungsi
- [ ] Admin panel accessible
- [ ] Deposit flow berfungsi
- [ ] Push notification berfungsi (test dari broadcast panel)
- [ ] PWA installable (Chrome → install button)

### URLs Penting:

| | URL |
|---|---|
| Production | https://microvest.app |
| Admin Panel | https://microvest.app/admin/dashboard.html |
| Supabase Dashboard | https://supabase.com/dashboard/project/zmyiaviafmmwpgxfvsbq |
| Netlify Dashboard | https://app.netlify.com |
| GitHub Actions | https://github.com/USERNAME/microvest/actions |

---

## 🆘 Penyelesaian Masalah (Troubleshooting)

| Masalah | Penyelesaian |
|---|---|
| Login tidak berfungsi | Semak SUPABASE_URL dan ANON_KEY dalam Netlify env |
| Realtime tidak berfungsi | Aktifkan Realtime untuk jadual berkenaan di Supabase |
| Push tidak sampai | Semak VAPID keys + browser permission |
| Deploy gagal | Semak GitHub Actions log → Jobs → lihat error |
| 404 pada halaman | Semak `_redirects` atau `netlify.toml` redirects |
| `{css,js,admin}` folder muncul | Padam — ia berlaku semasa unzip dengan glob conflict |

---

*MicroVest v8 — Built with Supabase + Netlify + GitHub Actions*

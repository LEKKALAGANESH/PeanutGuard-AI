# PeanutGuard — Supabase Backend

> **Zero-Cost Architecture:** Supabase FREE tier handles metadata sync only. All AI inference runs on-device. Images never leave the farmer's phone.

---

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Note your **Project URL** and **anon key** from Settings > API

### 2. Run Database Migration

```bash
# Option A: Supabase CLI (recommended)
npx supabase db push

# Option B: Manual — copy-paste into SQL Editor
# Open supabase/migrations/001_initial_schema.sql
# Paste into Supabase Dashboard > SQL Editor > Run
```

### 3. Deploy Edge Functions

```bash
# Login to Supabase CLI
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Deploy all functions
npx supabase functions deploy sync-scans
npx supabase functions deploy disease-alerts
npx supabase functions deploy check-reviews
```

### 4. Configure Environment

Create `.env.local` in the peanutguard root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

---

## Database Schema

| Table | Purpose | RLS |
|-------|---------|-----|
| `users` | Farmer profiles (phone OTP auth) | Own data only |
| `fields` | Farm field records (GPS, planting date) | Own data only |
| `scans` | Scan metadata (~2KB each, no images) | Own data only |
| `scan_results` | Per-prediction results (disease, confidence, severity) | Via scan ownership |
| `harvest_tracking` | Weekly harvest readiness assessments | Via field ownership |
| `disease_reports` | Anonymous community disease map (H3 grid) | Public read, auth insert |
| `expert_reviews` | Async expert review queue | Device-based |
| `reviewers` | Verified expert profiles | Own + public verified |
| `diseases` | Reference table (admin/analytics only) | Public read |
| `disease_library_versions` | OTA library update tracking | Public read |

## Edge Functions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/functions/v1/sync-scans` | POST | Upload scan metadata, update fields, delete scans |
| `/functions/v1/disease-alerts` | GET | Get disease reports near GPS grid (`?h3=xxx&days=30`) |
| `/functions/v1/check-reviews` | GET | Check review status (`?device_id=xxx`) |
| `/functions/v1/check-reviews` | POST | Submit expert review request |

## Cost

| Resource | FREE Tier Limit | PeanutGuard Usage (10K users) |
|----------|----------------|-------------------------------|
| Database | 500 MB | ~50 MB (metadata only) |
| Auth | 50,000 MAU | ~10,000 MAU |
| Edge Functions | 500K invocations/mo | ~100K invocations/mo |
| Storage | 1 GB | ~100 MB (thumbnails) |
| **Total** | **$0/month** | **$0/month** |

# Expert Validation Protocol — PeanutGuard V1.0

> **Version:** 1.0
> **Last Updated:** 2026-03-18
> **Constraint:** Zero-Cost tier uses async community review. No paid expert API.

---

## 1. Purpose

When AI confidence is low, the diagnosis is ambiguous, or severity is high, farmers need a path to **human expert verification**. This protocol defines how scan results are packaged, routed, and resolved — all within the Zero-Cost architecture.

---

## 2. Trigger Conditions

A review request is surfaced to the user when ANY of these conditions are met:

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| **Low confidence** | Top prediction < 60% | Model uncertain — likely edge case or novel presentation |
| **Narrow margin** | Top-1 vs Top-2 difference < 10% | Ambiguous between two diseases (e.g., early vs. late leaf spot) |
| **High severity** | Severity ≥ 4/5 | Misdiagnosis at high severity = major yield/financial risk |
| **Aflatoxin flag** | `aspergillus_aflatoxin` in top-3 | Regulatory/health implications — requires human confirmation |
| **Peanut gate borderline** | Gate confidence 50-65% | Image may not be peanut leaf — uncertain input |
| **User-initiated** | Manual "Request Review" button | Farmer override — always available regardless of confidence |

---

## 3. Review Request Data Package

When a review is triggered, the following is assembled **client-side** (nothing leaves device until user explicitly confirms):

```typescript
interface ExpertReviewRequest {
  // Identification
  id: string;                    // UUID
  created_at: string;            // ISO 8601
  device_id: string;             // Anonymous device fingerprint

  // Scan Data
  image_thumbnail: string;       // Base64 JPEG, 400×400, quality 60 (~30KB)
  image_full?: string;           // Base64 JPEG, original resolution (only if user opts in)

  // AI Results
  predictions: {
    label: string;
    confidence: number;
    severity: number;
  }[];
  quality_report: {
    blur_score: number;
    brightness: string;
    clahe_applied: boolean;
  };
  lesion_boxes: {
    x: number; y: number;
    width: number; height: number;
    confidence: number;
  }[];

  // Context
  field_id?: string;
  gps_lat?: number;
  gps_lng?: number;
  crop_variety?: string;
  days_after_sowing?: number;
  weather_summary?: string;      // "28°C, 85% humidity, 3 days rain"

  // Request
  farmer_note?: string;          // Voice-to-text or typed note
  urgency: 'routine' | 'urgent'; // Urgent = severity ≥ 4 or aflatoxin
  trigger_reason: string;        // Why review was triggered
}
```

---

## 4. Review Routing Tiers

### Tier 1: Community Review (Zero-Cost)

**Channel:** Supabase `expert_reviews` table (FREE tier).

**Flow:**
1. Farmer taps "Request Expert Review" → confirmation dialog explains data sharing
2. Review package uploaded to Supabase (metadata + thumbnail only, ~35KB)
3. Community reviewers (verified extension officers, ag students, experienced farmers) see pending reviews in a web dashboard
4. Reviewer submits: confirmed diagnosis, alternate diagnosis, or "inconclusive"
5. Result synced back to farmer's device on next online check

**SLA:** Best-effort, typically 24-48 hours.

**Reviewer Verification:**
- Sign up via extension officer referral code
- Minimum 50 confirmed reviews to earn "Trusted Reviewer" badge
- Consensus: 2 agreeing reviewers required for "Confirmed" status
- Disagreement: escalated to Tier 2

### Tier 2: Expert Panel (Post-MVP / Partnership)

**Channel:** Partnered agricultural extension services (ICRISAT, state ag universities).

**Flow:**
1. Escalated from Tier 1 disagreement or aflatoxin cases
2. Full-resolution image shared (with explicit farmer consent)
3. Panel of 3 plant pathologists reviews within 72 hours
4. Consensus diagnosis returned with treatment protocol

**SLA:** 72 hours (dependent on partnership agreements).

### Tier 3: In-Person Referral (Offline Fallback)

**Flow:**
1. App generates a printable/shareable summary card (PDF or screenshot)
2. Contains: image, AI diagnosis, confidence, location, QR code linking to review
3. Farmer takes to nearest Krishi Vigyan Kendra (KVK) or extension office
4. Physical referral — no internet required

---

## 5. UI Components

### 5.1 Review Trigger Banner (`ExpertReviewBanner.tsx`)

Appears on the result page when trigger conditions are met:

```
┌──────────────────────────────────────────────┐
│  ⚠ AI Confidence: 52%                        │
│                                              │
│  The diagnosis may be uncertain. We recommend │
│  getting an expert review for confirmation.  │
│                                              │
│  [📤 Request Expert Review]  [✓ I Accept AI] │
└──────────────────────────────────────────────┘
```

### 5.2 Review Confirmation Dialog (`ReviewConfirmDialog.tsx`)

```
┌──────────────────────────────────────────────┐
│  Send for Expert Review?                     │
│                                              │
│  The following will be shared:               │
│  ✓ Scan image (thumbnail, 400×400)           │
│  ✓ AI diagnosis & confidence scores          │
│  ✓ Approximate location (GPS, if available)  │
│  ✓ Crop variety & planting date              │
│                                              │
│  □ Also share full-resolution image          │
│                                              │
│  Add a note for the reviewer:                │
│  ┌────────────────────────────────────────┐  │
│  │ "Leaves yellowing for 5 days, sprayed  │  │
│  │  fungicide last week"                  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Cancel]              [Send for Review →]   │
└──────────────────────────────────────────────┘
```

### 5.3 Review Status Tracker (`ReviewStatusBadge.tsx`)

On the history page, reviewed scans show a badge:

| Status | Badge | Color |
|--------|-------|-------|
| Pending | "Awaiting review" | Yellow |
| In Review | "Expert reviewing" | Blue |
| Confirmed | "Expert confirmed: [disease]" | Green |
| Revised | "Expert revised: [new disease]" | Amber |
| Inconclusive | "Inconclusive — visit KVK" | Gray |

---

## 6. Supabase Schema

```sql
CREATE TABLE expert_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL,
  device_id TEXT NOT NULL,

  -- Request data
  image_thumbnail TEXT NOT NULL,       -- Base64 JPEG
  predictions JSONB NOT NULL,
  quality_report JSONB,
  lesion_boxes JSONB,
  field_context JSONB,                 -- GPS, variety, DAS, weather
  farmer_note TEXT,
  urgency TEXT DEFAULT 'routine',
  trigger_reason TEXT NOT NULL,

  -- Review response
  status TEXT DEFAULT 'pending',       -- pending, in_review, confirmed, revised, inconclusive
  reviewer_id UUID REFERENCES reviewers(id),
  reviewer_diagnosis TEXT,
  reviewer_confidence TEXT,            -- high, medium, low
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,

  -- Consensus
  review_count INT DEFAULT 0,
  consensus_reached BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: farmers see only their own reviews; reviewers see all pending
ALTER TABLE expert_reviews ENABLE ROW LEVEL SECURITY;
```

---

## 7. Privacy & Consent

1. **Opt-in only:** Review requests are never auto-sent. Farmer must explicitly tap "Send for Review"
2. **Data minimization:** Thumbnail (400×400) by default. Full image only with checkbox opt-in
3. **GPS anonymization:** Coordinates rounded to H3 resolution 5 (~253 km²) for reviewer view
4. **Right to delete:** Farmer can retract review request at any time; data deleted within 24 hours
5. **No PII:** No name, phone, or account info sent with review. Device ID is a random UUID
6. **Reviewer access:** Reviewers see scan data only — no farmer identity, no field history

---

## 8. Offline Behavior

- Review requests queued in IndexedDB if offline
- Synced on next connectivity (via `sync-queue.ts`)
- Farmer sees "Queued — will send when online" badge
- Review responses checked every 30 minutes when online (lightweight poll)

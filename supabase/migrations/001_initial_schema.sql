-- ============================================================================
-- PeanutGuard AI — Supabase Database Schema
-- Migration: 001_initial_schema
-- Description: Core tables, RLS policies, indexes, and seed data
-- Cost: $0/month (Supabase FREE tier — 500MB DB, 50K MAU auth)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE,
    name TEXT,
    language TEXT DEFAULT 'en',
    region TEXT DEFAULT 'IN',
    device_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE users IS 'Farmer profiles — minimal PII, phone-based OTP auth';
COMMENT ON COLUMN users.region IS 'ISO country code for treatment filtering (IN, NG, US, etc.)';
COMMENT ON COLUMN users.device_id IS 'Anonymous device fingerprint for sync deduplication';

-- ============================================================================
-- 2. FIELDS
-- ============================================================================

CREATE TABLE fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    area_hectares DECIMAL(10,2),
    planting_date DATE,
    variety TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE fields IS 'Farmer field records — GPS, planting date, variety';

CREATE INDEX idx_fields_user_id ON fields(user_id);

-- ============================================================================
-- 3. SCANS
-- ============================================================================

CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    thumbnail_hash TEXT,
    image_type TEXT DEFAULT 'leaf' CHECK (image_type IN ('leaf', 'root', 'stem', 'pod')),
    device_ram_gb DECIMAL(3,1),
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE scans IS 'Scan metadata only — images stay on device (IndexedDB). ~2KB per record';
COMMENT ON COLUMN scans.thumbnail_hash IS 'SHA-256 of thumbnail for dedup, NOT the actual image';

CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_field_id ON scans(field_id);
CREATE INDEX idx_scans_created_at ON scans(created_at DESC);

-- ============================================================================
-- 4. SCAN RESULTS
-- ============================================================================

CREATE TABLE scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
    disease_label TEXT NOT NULL,
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    severity INT CHECK (severity BETWEEN 1 AND 5),
    affected_area_pct DECIMAL(5,2),
    lesion_count INT DEFAULT 0,
    model_used TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE scan_results IS 'Per-prediction results — top-3 predictions per scan';
COMMENT ON COLUMN scan_results.disease_label IS 'Matches labels.ts: early_leaf_spot, rust, etc.';
COMMENT ON COLUMN scan_results.model_used IS 'mobilenetv3_large | mobilenetv3_small';

CREATE INDEX idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX idx_scan_results_disease ON scan_results(disease_label);

-- ============================================================================
-- 5. DISEASES (admin/analytics only — bundled JSON is the runtime source)
-- ============================================================================

CREATE TABLE diseases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    scientific_name TEXT,
    category TEXT CHECK (category IN ('fungal', 'viral', 'bacterial', 'nematode', 'nutritional', 'abiotic')),
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE diseases IS 'Reference table for analytics — disease_library.json is the app runtime source';

-- ============================================================================
-- 6. HARVEST TRACKING
-- ============================================================================

CREATE TABLE harvest_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    health_score DECIMAL(5,2) CHECK (health_score >= 0 AND health_score <= 100),
    disease_pressure_index DECIMAL(5,4) CHECK (disease_pressure_index >= 0 AND disease_pressure_index <= 1),
    estimated_days_to_harvest INT,
    readiness_score DECIMAL(5,2) CHECK (readiness_score >= 0 AND readiness_score <= 100),
    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE harvest_tracking IS 'Weekly harvest readiness assessments per field';

CREATE INDEX idx_harvest_field_id ON harvest_tracking(field_id);
CREATE INDEX idx_harvest_recorded_at ON harvest_tracking(recorded_at DESC);

-- ============================================================================
-- 7. DISEASE REPORTS (anonymous community disease map)
-- ============================================================================

CREATE TABLE disease_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gps_grid TEXT NOT NULL,
    disease_label TEXT NOT NULL,
    severity INT CHECK (severity BETWEEN 1 AND 5),
    confidence DECIMAL(5,4),
    reported_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE disease_reports IS 'Anonymous prevalence map — H3 hex grid (~1km resolution), NO user_id';
COMMENT ON COLUMN disease_reports.gps_grid IS 'H3 hex grid cell ID — anonymizes location to ~1km';

CREATE INDEX idx_disease_reports_grid ON disease_reports(gps_grid);
CREATE INDEX idx_disease_reports_label ON disease_reports(disease_label);
CREATE INDEX idx_disease_reports_time ON disease_reports(reported_at DESC);

-- ============================================================================
-- 8. EXPERT REVIEWS
-- ============================================================================

CREATE TABLE reviewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'community' CHECK (role IN ('community', 'extension_officer', 'agronomist')),
    verified BOOLEAN DEFAULT false,
    total_reviews INT DEFAULT 0,
    accuracy_score DECIMAL(5,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE reviewers IS 'Verified expert reviewers — extension officers, agronomists, experienced farmers';

CREATE TABLE expert_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL,
    device_id TEXT NOT NULL,

    -- Request data (from farmer)
    image_thumbnail TEXT NOT NULL,
    predictions JSONB NOT NULL,
    quality_report JSONB,
    lesion_boxes JSONB,
    field_context JSONB,
    farmer_note TEXT,
    urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'critical')),
    trigger_reason TEXT NOT NULL,

    -- Review response (from reviewer)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'confirmed', 'revised', 'inconclusive')),
    reviewer_id UUID REFERENCES reviewers(id),
    reviewer_diagnosis TEXT,
    reviewer_confidence TEXT CHECK (reviewer_confidence IN ('high', 'medium', 'low')),
    reviewer_note TEXT,
    reviewed_at TIMESTAMPTZ,

    -- Consensus
    review_count INT DEFAULT 0,
    consensus_reached BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE expert_reviews IS 'Async expert review queue — farmers submit, reviewers respond';

CREATE INDEX idx_expert_reviews_status ON expert_reviews(status);
CREATE INDEX idx_expert_reviews_device ON expert_reviews(device_id);

-- ============================================================================
-- 9. DISEASE LIBRARY VERSION (for OTA updates)
-- ============================================================================

CREATE TABLE disease_library_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT UNIQUE NOT NULL,
    hash TEXT NOT NULL,
    released_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE disease_library_versions IS 'Tracks disease_library.json versions for client update checks';

-- ============================================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================================

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Fields
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fields" ON fields FOR ALL USING (auth.uid() = user_id);

-- Scans
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scans" ON scans FOR ALL USING (auth.uid() = user_id);

-- Scan Results (via scan ownership)
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own scan results" ON scan_results FOR SELECT
    USING (scan_id IN (SELECT id FROM scans WHERE user_id = auth.uid()));
CREATE POLICY "Users insert own scan results" ON scan_results FOR INSERT
    WITH CHECK (scan_id IN (SELECT id FROM scans WHERE user_id = auth.uid()));

-- Harvest Tracking (via field ownership)
ALTER TABLE harvest_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own harvest data" ON harvest_tracking FOR ALL
    USING (field_id IN (SELECT id FROM fields WHERE user_id = auth.uid()));

-- Disease Reports (anonymous — world readable, auth insert)
ALTER TABLE disease_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads disease reports" ON disease_reports FOR SELECT USING (true);
CREATE POLICY "Auth users insert disease reports" ON disease_reports FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Expert Reviews
ALTER TABLE expert_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farmers see own reviews" ON expert_reviews FOR SELECT
    USING (device_id = current_setting('request.jwt.claims', true)::jsonb->>'device_id');
CREATE POLICY "Auth users create reviews" ON expert_reviews FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Reviewers update assigned reviews" ON expert_reviews FOR UPDATE
    USING (reviewer_id IN (SELECT id FROM reviewers WHERE user_id = auth.uid()));

-- Reviewers
ALTER TABLE reviewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviewers see own profile" ON reviewers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Public reviewer list" ON reviewers FOR SELECT USING (verified = true);

-- Disease Library Versions (public read)
ALTER TABLE disease_library_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads library versions" ON disease_library_versions FOR SELECT USING (true);

-- ============================================================================
-- 11. HELPER FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_fields_updated_at BEFORE UPDATE ON fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_expert_reviews_updated_at BEFORE UPDATE ON expert_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 12. SEED DATA — Disease Reference
-- ============================================================================

INSERT INTO diseases (label, name, scientific_name, category) VALUES
    ('healthy', 'Healthy', NULL, 'abiotic'),
    ('early_leaf_spot', 'Early Leaf Spot', 'Cercospora arachidicola', 'fungal'),
    ('late_leaf_spot', 'Late Leaf Spot', 'Cercosporidium personatum', 'fungal'),
    ('rust', 'Rust', 'Puccinia arachidis', 'fungal'),
    ('white_mold', 'White Mold / Stem Rot', 'Sclerotium rolfsii', 'fungal'),
    ('aspergillus_aflatoxin', 'Aspergillus Crown Rot / Aflatoxin', 'Aspergillus flavus', 'fungal'),
    ('web_blotch', 'Web Blotch', 'Didymella arachidicola', 'fungal'),
    ('collar_rot', 'Collar Rot', 'Aspergillus niger', 'fungal'),
    ('rosette_virus', 'Groundnut Rosette Virus', 'GRV + GRAV', 'viral'),
    ('bud_necrosis', 'Bud Necrosis Disease', 'PBNV', 'viral'),
    ('peanut_mottle', 'Peanut Mottle Virus', 'PMV', 'viral'),
    ('bacterial_wilt', 'Bacterial Wilt', 'Ralstonia solanacearum', 'bacterial'),
    ('root_knot_nematode', 'Root-Knot Nematode', 'Meloidogyne arenaria', 'nematode'),
    ('iron_chlorosis', 'Iron Chlorosis', NULL, 'nutritional'),
    ('nitrogen_deficiency', 'Nitrogen Deficiency', NULL, 'nutritional'),
    ('calcium_deficiency', 'Calcium Deficiency (Pops / Empty Pods)', NULL, 'nutritional'),
    ('boron_deficiency', 'Boron Deficiency (Hollow Heart)', NULL, 'nutritional'),
    ('drought_stress', 'Drought Stress', NULL, 'abiotic'),
    ('herbicide_injury', 'Herbicide Injury', NULL, 'abiotic');

-- Seed initial library version
INSERT INTO disease_library_versions (version, hash) VALUES
    ('1.0.0', 'sha256:initial');

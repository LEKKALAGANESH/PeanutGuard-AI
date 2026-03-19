# PeanutGuard AI - Farmer Needs Analysis & Market Gap Assessment

---

## 1. The Human Element: Understanding Our Users

### 1.1 Farmer Personas

**Persona A: Smallholder Farmer (Primary Target - 70% of users)**

- Farm size: 0.5 - 5 hectares
- Device: Low-to-mid range Android (2-4GB RAM, Android 10+)
- Connectivity: Intermittent 2G/3G, no WiFi at farm; occasional 4G in town
- Tech literacy: Can use WhatsApp and camera; unfamiliar with complex apps
- Language: Local/regional language preferred (Hindi, Hausa, Portuguese, Swahili, etc.)
- Budget: Cannot afford subscription software; willingness to pay: $0-2/month
- Pain point: "I see something wrong with my crop but I don't know what it is or what to do."

**Persona B: Commercial Farmer (Secondary Target - 20% of users)**

- Farm size: 5 - 100+ hectares
- Device: Mid-to-high range smartphone or tablet; may have drone
- Connectivity: 4G/LTE available; WiFi at farmhouse
- Tech literacy: Comfortable with apps; uses weather and market apps already
- Language: English, Spanish, or Portuguese
- Budget: $10-50/month for actionable tools
- Pain point: "I need field-level monitoring and yield forecasting across multiple plots."

**Persona C: Agricultural Extension Officer (Tertiary Target - 10% of users)**

- Serves 50-200 farmers in a region
- Device: Government/NGO-provided smartphone or tablet
- Connectivity: Variable; often travels to remote areas
- Tech literacy: Moderate to high; trained in agronomy
- Language: Bilingual (local + English/French)
- Budget: Institutional; price-insensitive if value is proven
- Pain point: "I need to diagnose issues quickly in the field and provide evidence-based recommendations."

### 1.2 Critical User Requirements

| Requirement           | Why It Matters                                                                                                   | Our Solution                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Offline-first**     | 60% of peanut farming occurs in areas with unreliable internet (Sub-Saharan Africa, rural India, Southeast Asia) | PWA with cached UI shell + ONNX edge model (~15MB) for instant offline inference; results sync when connected                                  |
| **Low data usage**    | Mobile data costs $2-5/GB in many target markets; farmers budget <$5/month for all data                          | Compressed image upload (<500KB after client-side resize); API responses <10KB JSON; monthly app data budget target <50MB                      |
| **Local language**    | Farmers cannot act on English-only disease names and treatment instructions                                      | i18n framework with 12 launch languages; treatment protocols localized with region-specific product names; voice output for low-literacy users |
| **Simple UI**         | Complex interfaces cause abandonment; farmers need answers in <3 taps                                            | "Camera-first" design: open app -> tap scan -> see results; no login required for basic scanning                                               |
| **Fast results**      | Farmer is standing in the field when they scan; they need answers immediately                                    | Edge inference: <300ms; cloud inference: <2s; no loading spinners longer than 3s                                                               |
| **Actionable output** | Knowing "this is leaf spot" is useless without "spray X product at Y rate"                                       | Every diagnosis includes specific treatment with product names, doses, timing, and local availability                                          |
| **Trust & accuracy**  | One wrong recommendation = farmer loses money and trust                                                          | Confidence thresholds: only show results >60% confidence; below 60% = "Uncertain - consult expert"; accuracy target >90% for top-5 diseases    |

---

## 2. Key Features: Deep Dive

### 2.1 One-Tap PDF Export

**User Story:** "As a farmer, I want to generate a professional report of my crop scan so I can show it to my agronomist, input supplier, or loan officer."

**Implementation:**

```
[Scan Complete Screen]
     |
     +-- [Export PDF] button (single tap)
           |
           +-- OFFLINE: @react-pdf/renderer generates PDF client-side
           |   - Uses cached scan results from IndexedDB
           |   - Includes: annotated image, disease name, severity, treatment
           |   - Saves to device Downloads folder
           |   - File size: <1MB
           |
           +-- ONLINE: Server-side WeasyPrint generates enhanced PDF
               - Higher quality annotated images
               - Includes weather context, field history, yield impact estimate
               - Auto-saves to Supabase Storage
               - Shareable link generated
```

**PDF Report Contents:**

1. Header: PeanutGuard AI logo, date, field name, GPS coordinates
2. Scan Image: Original + annotated (bounding boxes on lesions)
3. Diagnosis: Disease name (local language + scientific name), confidence %
4. Severity: Visual scale (1-5) with color-coded indicator
5. Treatment Plan: Step-by-step instructions, product names, dosages
6. Weather Context: Recent rainfall, humidity, temperature (if online)
7. Follow-up: "Rescan in 7 days to track progress"
8. QR Code: Links to the digital report in the cloud

### 2.2 Voice-to-Text Querying

**User Story:** "As a farmer who cannot read well, I want to ask questions about my crop by speaking, and hear the answer spoken back to me."

**Implementation:**

```
[Results Screen]
     |
     +-- [Ask a Question] microphone button
           |
           +-- Web Speech API (browser-native, zero data cost)
           |   Supported: Chrome Android, Safari iOS
           |
           +-- Fallback: Whisper-small ONNX model (local)
           |   For browsers without Web Speech API
           |   Model size: ~150MB (downloaded once)
           |
           +-- Speech -> Text -> Local NLP matching
           |   (No cloud call needed for common questions)
           |
           +-- Common question patterns (pre-mapped):
               "What should I spray?"     -> Treatment details
               "Is this serious?"         -> Severity explanation
               "When should I harvest?"   -> Harvest readiness
               "What caused this?"        -> Disease explanation
               "How much will I lose?"    -> Yield impact estimate
           |
           +-- Response: Text-to-Speech (Web Speech Synthesis API)
               Reads the answer aloud in the farmer's language
```

**Supported Languages at Launch:**
English, Hindi, Telugu, Tamil, Kannada, Hausa, Yoruba, Swahili, Portuguese (Brazilian), Spanish, French, Mandarin

### 2.3 Harvest Readiness Tracker

**User Story:** "As a farmer, I want the app to tell me when my crop is ready to harvest so I don't dig too early (low yield) or too late (increased disease/aflatoxin risk)."

**Implementation:**

- Farmer sets planting date and variety when creating a field
- Weekly scans build a health timeline
- System calculates a **Harvest Readiness Score (0-100%)** based on:
  - Days to maturity for the variety (110-150 days typical)
  - Leaf senescence pattern (natural yellowing = approaching maturity)
  - Disease pressure index (high disease may warrant early harvest)
  - Weather forecast (rain before harvest increases aflatoxin risk)
- Push notification when score exceeds 80%: "Consider harvesting Field A this week"

---

## 3. Market Gap Analysis

### 3.1 Existing Solutions & Their Failures

| Software                           | What It Does                      | Why It Fails for Peanut Farmers                                                                                                                                    |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Plantix** (Germany)              | General crop disease ID via photo | Not peanut-specialized; weak on peanut-specific diseases (Rosette, PBNV); requires internet for every scan; free tier is ad-heavy and limited; no harvest tracking |
| **AgriApp** (India)                | Marketplace + advisory app        | Disease identification is secondary feature, not AI-powered; generic advice, not scan-based; primarily a product sales channel                                     |
| **Cropio / Syngenta**              | Satellite-based field monitoring  | Enterprise-priced ($5-15/ha/year); requires satellite subscription; too coarse for individual plant diagnosis; no offline mode                                     |
| **PlantVillage Nuru** (Penn State) | Offline AI crop disease detection | Limited to cassava, maize, potato; no peanut support; model accuracy degrades for conditions outside training data; no treatment protocols                         |
| **FarmLogs / Granular**            | Farm management + yield tracking  | US/EU focused; subscription $500+/year; desktop-first design; no disease detection; irrelevant for smallholders                                                    |
| **iCrisat / ICRISAT tools**        | Research-grade peanut tools       | Academic, not farmer-friendly; no mobile app; data requires agronomist interpretation                                                                              |
| **Generic ChatGPT/LLM**            | Ask about crop issues             | No visual analysis; hallucination risk on treatment dosages; no offline mode; no structured reporting                                                              |

### 3.2 Why They All Fail: The 5 Critical Gaps

**Gap 1: No Peanut Specialist**

- Every existing tool is a generalist. Peanut has unique diseases (Rosette, PBNV, Aflatoxin) that require specialized training data and domain knowledge.
- **PeanutGuard fills this:** Purpose-built model trained exclusively on peanut pathology. 18 classification labels covering every major peanut disease and disorder.

**Gap 2: Cloud Dependency**

- Plantix, Cropio, and generic AI tools require constant internet. A farmer standing in a field in rural Kano State, Nigeria, has zero connectivity.
- **PeanutGuard fills this:** ONNX Runtime Web edge model delivers results in <300ms with zero internet. Results sync when connectivity returns.

**Gap 3: Diagnosis Without Action**

- Most tools say "This is Leaf Spot" but don't say "Spray Chlorothalonil at 1.5L/ha on a 14-day interval, and here are the local brand names available in your region."
- **PeanutGuard fills this:** Every diagnosis maps to a treatment protocol with specific products, dosages, timing, and localized product names.

**Gap 4: Unaffordable for Smallholders**

- Cropio costs $5-15/ha/year. FarmLogs costs $500+/year. Even Plantix's premium is $3/month — meaningful for a farmer earning $100/month.
- **PeanutGuard fills this:** Core scanning is free forever (edge inference costs us nothing). Premium features (cloud history, PDF export, harvest tracker) at $1/month or supported by agricultural NGO partnerships.

**Gap 5: English-Only, Literate-Only**

- Most tools assume English literacy. 80% of our target users prefer local languages, and 30% have limited reading ability.
- **PeanutGuard fills this:** 12-language support at launch. Voice input AND voice output. Visual severity indicators (color-coded, no reading required). Icon-driven UI.

### 3.3 Competitive Positioning Matrix

```
                    Peanut-Specific
                         ^
                         |
                         |  PeanutGuard AI
                         |  [FREE, OFFLINE, SPECIALIZED]
                         |
                         |
  Offline ---------------+--------------> Online-Only
                         |
           PlantVillage  |   Plantix
           Nuru          |   [GENERIC, ONLINE]
           [NO PEANUT]   |
                         |   Cropio
                         |   [EXPENSIVE, SATELLITE]
                         |
                         v
                    General/Generic
```

---

## 4. Accessibility & Inclusion Design

### 4.1 Low-Literacy UI Principles

- **Icon-first navigation:** Every action has a recognizable icon (camera, download, microphone)
- **Color-coded severity:** Red (critical) -> Orange (severe) -> Yellow (moderate) -> Light green (light) -> Green (healthy). No reading required to understand urgency
- **Photo-based tutorials:** Onboarding uses example photos, not text instructions
- **Large tap targets:** Minimum 48x48dp touch targets; primary actions are 64x64dp
- **Minimal text screens:** Maximum 3 lines of visible text at any time; expandable sections for detail

### 4.2 Device Compatibility

| Spec    | Minimum                  | Recommended                  |
| ------- | ------------------------ | ---------------------------- |
| OS      | Android 10 / iOS 14      | Android 12+ / iOS 16+        |
| RAM     | 2GB                      | 4GB+                         |
| Storage | 100MB (app + edge model) | 500MB+ (with cached history) |
| Camera  | 5MP                      | 12MP+                        |
| Screen  | 5" 720p                  | 6"+ 1080p                    |
| Network | Works fully offline      | 3G+ for cloud features       |

### 4.3 Data Sovereignty & Privacy

- Scan images stored on-device by default; cloud upload is opt-in
- No farmer data sold to third parties (ever)
- Anonymous aggregate data (disease prevalence by region) shared with agricultural research institutes for public good — with farmer consent
- GDPR and local data protection compliance
- Farmers can delete all their data with one tap ("Delete My Account")

---

## 5. Monetization Strategy

| Tier                  | Price         | Features                                                                                 | Target User                              |
| --------------------- | ------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Free**              | $0            | Unlimited offline scans, basic diagnosis, treatment summary, 5 cloud scans/month         | Smallholder farmer                       |
| **Pro**               | $1/month      | Unlimited cloud scans, full scan history, PDF export, harvest tracker, field management  | Active farmer                            |
| **Enterprise**        | $5/user/month | Multi-user dashboard, regional analytics, API access, priority support, custom reporting | Extension officers, agribusinesses, NGOs |
| **NGO/Institutional** | Custom        | Bulk licensing, co-branding, custom language packs, training materials                   | CGIAR, USAID, GIZ, World Bank projects   |

**Revenue Sustainability:**

- Free tier costs near-zero (edge inference = no server cost)
- Pro tier at $1/month is viable: 100K paying farmers = $100K/month = self-sustaining
- NGO partnerships provide funding runway during growth phase
- Agricultural input companies (Syngenta, BASF, UPL) may sponsor treatment recommendations (clearly labeled as sponsored, never biasing the diagnosis)

---

## 6. Go-to-Market: Farmer Acquisition

| Channel                             | Strategy                                                                         | Expected Reach                             |
| ----------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| **Agricultural Extension Networks** | Partner with ICRISAT, national extension services                                | 500K+ farmers via trusted advisors         |
| **Farmer Cooperatives**             | Onboard cooperatives as Enterprise accounts                                      | 100K+ farmers through cooperative networks |
| **WhatsApp/SMS Campaigns**          | Farmers share scan results via WhatsApp; viral loop                              | Organic growth in connected communities    |
| **Demo Days at Local Markets**      | In-person demonstrations at agricultural markets/fairs                           | High-conversion local adoption             |
| **NGO Partnerships**                | USAID Feed the Future, GIZ, Bill & Melinda Gates Foundation agriculture programs | Funded deployments in target regions       |
| **Radio & Local Media**             | Radio spots in farming communities (still #1 media in rural Africa/Asia)         | Mass awareness in offline-first regions    |

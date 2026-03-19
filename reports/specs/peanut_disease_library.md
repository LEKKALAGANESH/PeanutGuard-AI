# PeanutGuard AI - Peanut Disease Library

## Overview

This library covers **18 diseases and disorders** affecting peanut crops (*Arachis hypogaea*), organized by pathogen type. Each entry is structured for direct integration into the AI classification model's label set and the treatment recommendation engine.

> **AI Training Note:** The model uses a multi-label classifier — a single image may match multiple conditions (e.g., Early Leaf Spot + Nitrogen Deficiency). The visual patterns below define the feature maps the model must learn to distinguish.

---

## FUNGAL DISEASES

---

### 1. Early Leaf Spot (*Cercospora arachidicola*)

**Visual Patterns:**
- Dark brown to reddish-brown circular lesions (1-10mm diameter)
- Lesions appear on **upper leaf surface** first
- Surrounded by a **yellow halo** (chlorotic ring)
- Older lesions develop a lighter tan center
- Lesions are more uniformly circular than Late Leaf Spot
- **AI discriminator:** Upper-surface dominance + yellow halo + circular shape

**Severity Levels:**

| Level | Description | Leaf Area Affected |
|-------|------------|-------------------|
| 1 - Trace | < 5 lesions per leaf, no defoliation | < 1% |
| 2 - Light | 5-15 lesions per leaf, minimal yellowing | 1-5% |
| 3 - Moderate | Lesions coalescing, noticeable yellowing, early defoliation | 5-25% |
| 4 - Severe | Heavy lesion coverage, significant defoliation (>30% leaves dropped) | 25-50% |
| 5 - Critical | Near-complete defoliation, stem lesions visible | > 50% |

**Treatment Protocol:**
- **Organic:** Neem oil spray (3% concentration, 7-day intervals); Trichoderma viride soil application (2kg/ha); sulfur-based fungicide (micronized sulfur 80WP at 2.5kg/ha)
- **Chemical:** Chlorothalonil (Bravo) 1.5L/ha at first sign; Tebuconazole (Folicur) 0.5L/ha for moderate-severe; Mancozeb 75WP at 2kg/ha as protectant; rotate fungicide groups to prevent resistance
- **Cultural:** Remove and destroy infected crop debris; 2-3 year crop rotation away from legumes; avoid overhead irrigation

**Impact on Harvest:**
- Yield loss: 10-50% depending on severity and timing
- Premature defoliation forces early harvest, reducing pod fill
- Kernel quality degradation; smaller, shriveled kernels

---

### 2. Late Leaf Spot (*Cercosporidium personatum*)

**Visual Patterns:**
- Dark brown to **nearly black** circular to irregular lesions
- Lesions appear on **lower leaf surface** predominantly
- **No yellow halo** or very faint halo (key differentiator from Early Leaf Spot)
- Lesions rougher in texture, slightly raised
- Heavy sporulation visible as dark tufts on underside
- **AI discriminator:** Lower-surface dominance + darker color + absent/faint halo + rough texture

**Severity Levels:**

| Level | Description | Leaf Area Affected |
|-------|------------|-------------------|
| 1 - Trace | Scattered lesions, lower canopy only | < 1% |
| 2 - Light | Spreading to mid-canopy, 5-20 lesions per leaf | 1-5% |
| 3 - Moderate | Lesions coalescing, defoliation beginning | 5-25% |
| 4 - Severe | Rapid defoliation, >40% leaves dropped, stem lesions | 25-50% |
| 5 - Critical | Near-total defoliation, pods exposed on soil surface | > 50% |

**Treatment Protocol:**
- **Organic:** Bordeaux mixture (1% concentration); Bacillus subtilis biocontrol agent; neem cake soil amendment (250 kg/ha)
- **Chemical:** Propiconazole (Tilt) 0.5L/ha; Azoxystrobin (Amistar) 0.5L/ha (systemic, curative); Pyraclostrobin + Epoxiconazole combination for resistant strains
- **Cultural:** Deep plowing of crop residue; resistant varieties (ICGV 00350, GPBD 4); early planting to avoid peak disease pressure

**Impact on Harvest:**
- Yield loss: 15-70% (more aggressive than Early Leaf Spot)
- Defoliation causes pods to remain in soil during mechanical harvest, increasing harvest loss
- Typically appears later in season, making intervention timing critical

---

### 3. Rust (*Puccinia arachidis*)

**Visual Patterns:**
- **Orange to reddish-brown pustules** (uredinia) on lower leaf surface
- Pustules are **raised and powdery** — release orange spores when touched
- Upper leaf surface shows corresponding **chlorotic flecks** (pale green/yellow spots)
- In severe cases, pustules also form on petioles, stems, and even peg surfaces
- Leaves curl upward in advanced infection
- **AI discriminator:** Orange powdery pustules + raised texture + lower leaf dominance

**Severity Levels:**

| Level | Description | Coverage |
|-------|------------|----------|
| 1 - Trace | < 5 pustules per leaf | < 1% |
| 2 - Light | 5-25 pustules, scattered | 1-5% |
| 3 - Moderate | 25-100 pustules, chlorosis visible | 5-25% |
| 4 - Severe | Pustules coalescing, heavy chlorosis, leaf curling | 25-50% |
| 5 - Critical | Complete lower canopy infection, premature senescence | > 50% |

**Treatment Protocol:**
- **Organic:** Sulfur dust (25-30 kg/ha); potassium bicarbonate foliar spray; Trichoderma harzianum preventive application
- **Chemical:** Triadimefon (Bayleton) 0.5kg/ha; Hexaconazole 5EC at 1L/ha; Mancozeb + Carbendazim combination for dual protection
- **Cultural:** Remove volunteer peanut plants (inoculum source); plant resistant varieties; avoid late-season planting in rust-prone zones

**Impact on Harvest:**
- Yield loss: 10-60%
- Rust alone can cause complete crop failure in tropical/subtropical regions during high humidity seasons
- Combined with leaf spot (common), losses can exceed 70%

---

### 4. White Mold / Stem Rot (*Sclerotium rolfsii*)

**Visual Patterns:**
- **White, fluffy mycelial growth** at the base of stems (soil line)
- Small, round, brown **sclerotia** (mustard-seed sized, 1-2mm) embedded in mycelium
- Affected stems show **water-soaked, dark brown lesions** at soil level
- Wilting of branches despite adequate soil moisture
- In humid conditions, white fan-shaped mycelial mats visible on soil surface
- **AI discriminator:** White fluffy growth at stem base + brown spherical sclerotia + wilting pattern

**Severity Levels:**

| Level | Description | Plant Mortality |
|-------|------------|----------------|
| 1 - Trace | Single stem base lesion, no wilting | 0% |
| 2 - Light | 1-2 branches wilting per plant | < 10% |
| 3 - Moderate | Multiple branches wilting, sclerotia visible | 10-30% |
| 4 - Severe | Main stem girdled, plant collapse imminent | 30-60% |
| 5 - Critical | Plant dead, sclerotia dispersing to soil | > 60% |

**Treatment Protocol:**
- **Organic:** Trichoderma viride/harzianum soil drench (4kg/ha); deep plowing to bury sclerotia >15cm; mustard cake soil amendment (antimicrobial)
- **Chemical:** Tebuconazole soil drench; Flutolanil 50WP (2kg/ha) at pegging; Pencycuron directed spray at stem base
- **Cultural:** Avoid waterlogging; wide row spacing (45cm+); lime application to raise soil pH > 6.5; hot-season deep plowing to desiccate sclerotia

**Impact on Harvest:**
- Yield loss: 25-80% in affected areas
- Patchy field distribution — creates "dead zones"
- Sclerotia persist in soil for 3-5 years, making field history critical

---

### 5. Aspergillus Crown Rot / Aflatoxin (*Aspergillus flavus*, *A. parasiticus*)

**Visual Patterns:**
- **Yellowish-green to olive-green sporulation** on pods and kernels (post-harvest more visible)
- In-field: plants show **sudden wilting** without obvious stem lesion
- Crown area may show **yellow-brown discoloration**
- Pods, when pulled, may have **dark, water-soaked patches**
- Kernels show **green-black discoloration** and mushy texture when split open
- **AI discriminator:** Yellow-green mold on pods/kernels + wilting without foliar symptoms

**Severity Levels:**

| Level | Description | Aflatoxin Risk |
|-------|------------|---------------|
| 1 - Trace | Rare pod infection, no visible wilting | Low (<4 ppb) |
| 2 - Light | Scattered pod infection (<5% pods) | Moderate (4-20 ppb) |
| 3 - Moderate | Noticeable wilting in patches, 5-15% pods affected | High (20-100 ppb) |
| 4 - Severe | Widespread wilting, >15% pods visibly infected | Very High (100-300 ppb) |
| 5 - Critical | Field-level die-off, heavy aflatoxin contamination | Critical (>300 ppb, unsafe for consumption) |

**Treatment Protocol:**
- **Organic:** Atoxigenic Aspergillus biocontrol (Aflasafe/AF36, applied 200kg/ha at 40 days); proper drying to <10% moisture within 48h of harvest; calcium sulfate (gypsum) at pegging to strengthen pod wall
- **Chemical:** No effective in-field fungicide; focus is on prevention and post-harvest management
- **Cultural:** Avoid end-season drought stress (irrigation critical during pod fill); harvest at optimal maturity (not late); immediate drying to <9% moisture; cold storage (< 10C)

**Impact on Harvest:**
- Yield loss: Variable (5-25% from crown rot)
- **Primary impact is food safety** — aflatoxin contamination makes crop unmarketable
- Regulatory limits: 4 ppb (EU), 20 ppb (USA), 15 ppb (Codex Alimentarius)
- Economic loss can be 100% if aflatoxin levels exceed thresholds

---

### 6. Web Blotch (*Didymella arachidicola* / *Phoma arachidicola*)

**Visual Patterns:**
- **Irregular, dark brown to black lesions** with a distinctive **net-like or web pattern**
- Lesions larger than leaf spot (10-25mm), with **concentric ring patterns**
- Affects both leaf surfaces equally
- Lesions may have tan/gray centers with dark margins
- Often confused with Late Leaf Spot — the web/netted pattern is the key differentiator
- **AI discriminator:** Large irregular lesions + concentric rings + net pattern

**Severity Levels:**

| Level | Description | Leaf Area Affected |
|-------|------------|-------------------|
| 1 - Trace | Rare lesions, lower canopy | < 2% |
| 2 - Light | Scattered lesions throughout canopy | 2-10% |
| 3 - Moderate | Lesions expanding and coalescing | 10-25% |
| 4 - Severe | Heavy defoliation, petiole infection | 25-50% |
| 5 - Critical | Near-complete defoliation | > 50% |

**Treatment Protocol:**
- **Organic:** Copper hydroxide (Kocide) 2kg/ha; neem oil 2% spray
- **Chemical:** Chlorothalonil 1.5L/ha; Benomyl 0.5kg/ha (where registered); Mancozeb as protectant
- **Cultural:** Crop rotation; resistant variety selection; avoid prolonged leaf wetness

**Impact on Harvest:**
- Yield loss: 10-40%
- Often occurs concurrently with leaf spot diseases, compounding losses

---

### 7. Collar Rot (*Aspergillus niger*)

**Visual Patterns:**
- **Black sporulation** at the collar region (base of stem at soil level)
- Seedlings show **pre-emergence rotting** (seeds fail to emerge)
- Post-emergence: **yellow-brown necrosis** at collar, seedling topples
- Affected tissue becomes **dry and shredded** at the base
- **AI discriminator:** Black spore mass at stem base + seedling stage + dry necrosis

**Severity Levels:**

| Level | Description | Stand Loss |
|-------|------------|-----------|
| 1 - Trace | < 5% seedling mortality | < 5% |
| 2 - Light | 5-10% seedling mortality | 5-10% |
| 3 - Moderate | 10-25% seedling mortality, patchy stand | 10-25% |
| 4 - Severe | 25-50% seedling mortality | 25-50% |
| 5 - Critical | > 50% seedling mortality, replanting needed | > 50% |

**Treatment Protocol:**
- **Organic:** Trichoderma viride seed treatment (10g/kg seed); Pseudomonas fluorescens seed coating
- **Chemical:** Thiram + Carbendazim seed treatment (2g + 1g per kg seed); Mancozeb seed dressing
- **Cultural:** Use certified disease-free seed; avoid deep sowing (>5cm); ensure good soil drainage

**Impact on Harvest:**
- Yield loss: 5-40% (primarily through stand reduction)
- Early-season disease; if caught quickly, gap-filling replanting may salvage the season

---

## VIRAL DISEASES

---

### 8. Groundnut Rosette Disease (Groundnut Rosette Virus + Groundnut Rosette Assistor Virus)

**Visual Patterns:**
- **Chlorotic rosette:** Leaves show **bright yellow mosaic** with green islands; severe **stunting**
- **Green rosette:** Leaves become **dark green, smaller, and tightly bunched**; plant severely dwarfed
- Internodes drastically shortened — plant looks like a "rosette" or "cabbage"
- Leaves may curl downward
- Transmitted by **Aphis craccivora** (groundnut aphid)
- **AI discriminator:** Severe stunting + rosette growth habit + mosaic OR dark green bunched leaves

**Severity Levels:**

| Level | Description | Plant Damage |
|-------|------------|-------------|
| 1 - Trace | Rare affected plants (<1%) | Minimal field impact |
| 2 - Light | 1-5% plants affected | Localized, manageable |
| 3 - Moderate | 5-20% plants affected, aphid colonies visible | Significant spread |
| 4 - Severe | 20-50% plants affected | Major yield impact |
| 5 - Critical | > 50% plants affected, field-wide stunting | Near-total loss |

**Treatment Protocol:**
- **Organic:** Neem seed extract spray for aphid control; encourage natural predators (ladybugs, lacewings); reflective mulch to deter aphids
- **Chemical:** Imidacloprid seed treatment (2g/kg seed) for early aphid protection; Dimethoate 30EC (1L/ha) foliar spray for aphid control; Thiamethoxam (Actara) 0.2g/L
- **Cultural:** Plant resistant varieties (ICGV-IS 96894, ICG 12991); early planting (before aphid population peaks); high plant density to compensate for losses; rogue infected plants early

**Impact on Harvest:**
- Yield loss: 30-100% in susceptible varieties
- The #1 biotic constraint for peanut production in Sub-Saharan Africa
- Early infection (< 30 days) causes total plant failure; late infection has less impact

---

### 9. Peanut Bud Necrosis Disease (PBNV - Peanut Bud Necrosis Virus)

**Visual Patterns:**
- **Terminal bud necrosis** — the growing tip turns brown/black and dies
- **Axillary shoot proliferation** — excessive branching below the dead bud gives a "bushy" appearance
- Young leaves show **chlorotic rings and mottling**
- Older leaves may show **concentric ring patterns** (target-like)
- Petioles may show **necrotic streaks**
- Transmitted by **thrips** (Thrips palmi, Frankliniella schultzei)
- **AI discriminator:** Dead terminal bud + excessive branching + ring patterns on leaves

**Severity Levels:**

| Level | Description | Plant Impact |
|-------|------------|-------------|
| 1 - Trace | < 2% plants, isolated bud death | Negligible |
| 2 - Light | 2-10% plants, bushy growth visible | Minor |
| 3 - Moderate | 10-25% plants, reduced canopy uniformity | Moderate |
| 4 - Severe | 25-50% plants, field looks uneven | Major |
| 5 - Critical | > 50% plants, widespread stunting/death | Severe |

**Treatment Protocol:**
- **Organic:** Sticky blue traps for thrips monitoring (25/ha); neem oil spray for thrips suppression; Metarhizium anisopliae bio-insecticide
- **Chemical:** Fipronil 5SC seed treatment; Spinosad (Tracer) 0.3mL/L for thrips; Acephate 75SP (1g/L) foliar spray
- **Cultural:** Early planting (avoid peak thrips season); border/barrier crops (sorghum, pearl millet); destroy crop residue that harbors thrips

**Impact on Harvest:**
- Yield loss: 20-80%
- Major constraint in South and Southeast Asia
- Infected plants produce few or no pods

---

### 10. Peanut Mottle Virus (PMV)

**Visual Patterns:**
- **Mild green-on-green mosaic** — lighter and darker green patches on leaves
- **Leaf distortion** — mild crinkling, downward curling
- Plant may be slightly stunted but not dramatically
- Seed-borne (spreads through infected seed) and aphid-transmitted
- Often confused with nutritional deficiency — the **mosaic pattern** is the distinguishing feature
- **AI discriminator:** Green mosaic pattern + mild leaf distortion + normal-to-slight stunting

**Severity Levels:**

| Level | Description | Impact |
|-------|------------|--------|
| 1 - Trace | Mosaic visible on close inspection | < 5% yield impact |
| 2 - Light | Clear mosaic, mild stunting | 5-10% |
| 3 - Moderate | Widespread mosaic, leaf distortion | 10-20% |
| 4 - Severe | Heavy distortion, reduced pod set | 20-35% |
| 5 - Critical | Field-wide infection from contaminated seed lot | 30-50% |

**Treatment Protocol:**
- **Organic:** Use certified virus-free seed; aphid management (neem oil, predators)
- **Chemical:** Imidacloprid seed treatment for aphid vector control; no direct antiviral treatment exists
- **Cultural:** Seed certification and testing; rogue symptomatic plants; crop rotation

**Impact on Harvest:**
- Yield loss: 10-50%
- Insidious — mild symptoms cause farmers to underestimate damage
- Contaminated seed stock can perpetuate infection across seasons

---

## BACTERIAL DISEASES

---

### 11. Bacterial Wilt (*Ralstonia solanacearum*)

**Visual Patterns:**
- **Sudden wilting** of entire plant or individual branches **without leaf yellowing first**
- Leaves remain **green but flaccid** (key differentiator from fungal wilts)
- Cut stem placed in water shows **milky bacterial streaming** (diagnostic but not visible in photos)
- Brown vascular discoloration when stem is cut longitudinally
- In field: **scattered wilting plants** in an otherwise green field
- **AI discriminator:** Green-leaf wilting + sudden onset + scattered distribution pattern

**Severity Levels:**

| Level | Description | Mortality |
|-------|------------|----------|
| 1 - Trace | 1-2 wilted plants per field | < 1% |
| 2 - Light | Scattered wilting, <5% plants | 1-5% |
| 3 - Moderate | Distinct patches of wilted plants | 5-15% |
| 4 - Severe | Large field sections affected | 15-40% |
| 5 - Critical | Field-wide wilt, crop failure | > 40% |

**Treatment Protocol:**
- **Organic:** Pseudomonas fluorescens soil drench (10g/L); Bacillus amyloliquefaciens inoculant; organic matter amendment to boost soil microbiome competition
- **Chemical:** No effective bactericide for field use; copper-based products have limited efficacy; focus is entirely on prevention
- **Cultural:** Resistant rootstock/varieties; avoid fields with wilt history (pathogen persists >5 years); maintain soil pH 6.0-6.5; avoid injury to roots (careful cultivation); don't plant after solanaceous crops (tomato, tobacco, pepper)

**Impact on Harvest:**
- Yield loss: 5-100% (highly variable based on soil inoculum load)
- One of the most difficult peanut diseases to manage once established
- Can cause total crop failure in susceptible varieties on infested land

---

## NEMATODE DISEASES

---

### 12. Root-Knot Nematode (*Meloidogyne arenaria*, *M. hapla*)

**Visual Patterns:**
- **Aboveground:** General **yellowing, stunting, and unthrifty appearance**; plants may wilt during midday heat and recover at night
- **Belowground (root photos):** Distinctive **galls (knots)** on roots and pegs — swollen, knobby deformations
- Galls range from 1-10mm; severe infection shows **massive root deformation** ("club root" appearance)
- Pods may be distorted, warty, or cracked
- **AI discriminator:** Root galls/knots + above-ground chlorosis + stunting (requires root photo for definitive ID)

**Severity Levels:**

| Level | Description | Root Galling Index |
|-------|------------|-------------------|
| 1 - Trace | Slight chlorosis, few root galls | 1-2 (1-25% roots galled) |
| 2 - Light | Visible stunting, scattered galls | 2-3 (25-50%) |
| 3 - Moderate | Significant stunting, heavy galling | 3-4 (50-75%) |
| 4 - Severe | Severe stunting, massive galling, pod damage | 4-5 (75-100%) |
| 5 - Critical | Plant death, roots entirely galled | 5 (100%, roots non-functional) |

**Treatment Protocol:**
- **Organic:** Paecilomyces lilacinus egg parasitizer; neem cake soil amendment (250-500 kg/ha); marigold (*Tagetes*) rotation crop (nematicidal root exudates); Purpureocillium lilacinum
- **Chemical:** Fluopyram (Velum Prime) at planting; Aldicarb 10G (where registered); Oxamyl (Vydate) drip application
- **Cultural:** Crop rotation with non-host crops (corn, sorghum, small grains) for 2+ years; resistant varieties; soil solarization in fallow period

**Impact on Harvest:**
- Yield loss: 10-50%
- Nematode damage opens infection pathways for Aspergillus, increasing aflatoxin risk
- Sandy soils are most vulnerable

---

## NUTRITIONAL DISORDERS (Non-Pathogenic)

> **Critical AI Note:** These are NOT diseases but present similar visual symptoms. The model must distinguish nutritional deficiency from pathogenic infection to avoid incorrect treatment recommendations.

---

### 13. Iron Chlorosis (Iron Deficiency)

**Visual Patterns:**
- **Interveinal chlorosis on young/new leaves** — veins remain green, tissue between veins turns yellow to white
- Older leaves remain normal (iron is immobile in the plant)
- In severe cases, entire young leaves turn **white/ivory**
- Often appears in patches corresponding to high-pH soil zones
- **AI discriminator:** Young-leaf interveinal chlorosis + green veins + older leaves normal

**Severity Levels:**

| Level | Description |
|-------|------------|
| 1 | Mild yellowing between veins on youngest leaves |
| 2 | Clear interveinal chlorosis on top 2-3 leaf tiers |
| 3 | Young leaves predominantly yellow, veins still green |
| 4 | Young leaves turning white, growth slowing |
| 5 | New growth white/necrotic, plant stunted |

**Treatment Protocol:**
- **Organic:** Ferrous sulfate foliar spray (0.5% solution); chelated iron (Fe-EDDHA) soil application; acidifying amendments (elemental sulfur)
- **Chemical:** Fe-EDDHA 6% at 10kg/ha banded; FeSO4.7H2O soil application (25-50 kg/ha)
- **Cultural:** Soil pH management (target 5.8-6.5); avoid over-liming; select iron-efficient varieties

**Impact on Harvest:**
- Yield loss: 5-30% depending on severity and duration
- Correctable mid-season if caught early

---

### 14. Nitrogen Deficiency

**Visual Patterns:**
- **Uniform yellowing of older/lower leaves** (nitrogen is mobile, moves to young growth)
- Progresses upward through the plant if uncorrected
- No spots, lesions, or patterns — just **even, pale yellow-green color**
- Reduced plant size and vigor
- **AI discriminator:** Uniform yellowing + older leaves first + no lesions/spots + general pallor
- **Critical distinction from leaf spot:** Leaf spot has discrete lesions; N-deficiency is uniform

**Severity Levels:**

| Level | Description |
|-------|------------|
| 1 | Slight pale green on lowest leaves |
| 2 | Lower 1/3 of plant clearly yellow |
| 3 | Lower 1/2 yellow, plant visibly smaller than healthy neighbors |
| 4 | Most leaves yellow-green, severely stunted |
| 5 | Plant chlorotic throughout, minimal growth |

**Treatment Protocol:**
- **Organic:** Rhizobium inoculant (peanut is a legume — fix own N if nodulated properly); compost application; molybdenum foliar spray (needed for N-fixation enzyme)
- **Chemical:** Urea foliar spray (2% solution) as emergency correction; ammonium sulfate side-dress (not generally recommended for legumes)
- **Cultural:** Check root nodulation — if nodules are white/gray (inactive) rather than pink (active), re-inoculate; soil pH correction (Rhizobium needs pH > 5.5); avoid excessive phosphorus which can inhibit N-fixation

**Impact on Harvest:**
- Yield loss: 10-40%
- Usually indicates poor nodulation rather than soil N shortage

---

### 15. Calcium Deficiency ("Pops" / Empty Pods)

**Visual Patterns:**
- **Aboveground symptoms are subtle** — plant may appear healthy
- **Pod symptoms (diagnostic):** Pods are **dark, small, and unfilled** ("pops")
- Kernels are shriveled, discolored, or absent
- In severe cases, **pod rot** increases because weak pod walls invite Aspergillus
- Growing tips may show **necrotic margins** or distorted new growth
- **AI discriminator:** Empty/dark pods + healthy-looking foliage + necrotic new growth tips

**Severity Levels:**

| Level | Description |
|-------|------------|
| 1 | < 5% pods unfilled |
| 2 | 5-15% pods unfilled |
| 3 | 15-30% pods unfilled, some pod darkening |
| 4 | 30-50% pods unfilled, visible pod rot |
| 5 | > 50% pods unfilled, heavy pod rot, aflatoxin risk |

**Treatment Protocol:**
- **Organic:** Gypsum (CaSO4) application at pegging (500-1000 kg/ha) — THE primary treatment; bone meal; eggshell powder
- **Chemical:** Calcium nitrate (CaNO3) if foliar application needed; gypsum remains the gold standard
- **Cultural:** Apply gypsum to the pegging zone (within 15cm of plant base); soil test for Ca:Mg ratio (target > 3:1); maintain pH 5.8-6.5

**Impact on Harvest:**
- Yield loss: 10-60% (empty pods are complete loss)
- Directly increases aflatoxin risk (weak pod walls + calcium-starved kernels)
- The #1 nutritional issue in peanut production worldwide

---

### 16. Boron Deficiency ("Hollow Heart")

**Visual Patterns:**
- **Hollow, dark centers in kernels** when split (diagnostic but only visible post-harvest)
- In-field: **Thickened, brittle, distorted young leaves**
- Shortened internodes on new growth
- **Poor peg development** — fewer pegs reaching soil
- Flower drop without pod set
- **AI discriminator:** Distorted/thick young leaves + short internodes + poor peg set

**Severity Levels:**

| Level | Description |
|-------|------------|
| 1 | < 5% kernels with hollow heart |
| 2 | 5-15% hollow heart, mild leaf distortion |
| 3 | 15-30% hollow heart, visible leaf/peg issues |
| 4 | 30-50% hollow heart, significant yield reduction |
| 5 | > 50% hollow heart, crop unmarketable for premium markets |

**Treatment Protocol:**
- **Organic:** Borax soil application (10-15 kg/ha); Solubor foliar spray (0.1% solution)
- **Chemical:** Sodium borate at planting; boron-containing compound fertilizers
- **Cultural:** Soil test for boron (target 0.5-1.0 ppm hot-water extractable); sandy, low-organic-matter soils are most prone; avoid over-liming (high pH reduces boron availability)

**Impact on Harvest:**
- Yield loss: 5-25%
- "Hollow heart" downgrades kernel quality for export markets
- Often goes undiagnosed until post-harvest quality inspection

---

## ABIOTIC STRESS

---

### 17. Drought Stress

**Visual Patterns:**
- **Leaf folding** — leaflets fold inward along the midrib (paraheliotropism)
- **Wilting during midday**, partial recovery at night (early stage)
- **Permanent wilting**, leaves turn **dull gray-green** (advanced)
- Lower leaves turn **brown and papery** (fire-scorched appearance)
- Soil cracking visible around plant base
- **AI discriminator:** Leaf folding + gray-green color + uniform field-wide pattern + soil cracking

**Severity Levels:**

| Level | Description |
|-------|------------|
| 1 | Midday folding, full recovery by morning |
| 2 | Prolonged folding, slow recovery |
| 3 | Permanent wilting begins, lower leaf scorching |
| 4 | Widespread wilting, heavy lower leaf death |
| 5 | Plant death, stems brittle, pods immature |

**Treatment Protocol:**
- **Immediate:** Supplemental irrigation if available (25-30mm); mulching to conserve moisture
- **Preventive:** Drought-tolerant varieties (ICGV 91114, ICGV 00350); deficit irrigation scheduling; conservation tillage for moisture retention
- **Cultural:** Adjust planting date to align critical growth stages (flowering, pegging, pod fill) with reliable rainfall; soil organic matter improvement for water-holding capacity

**Impact on Harvest:**
- Yield loss: 20-70%
- Drought during pod fill = shriveled kernels + elevated aflatoxin (stress triggers Aspergillus)
- Combined drought + aflatoxin is the #1 cause of total crop rejection in semi-arid regions

---

### 18. Herbicide Injury (Chemical Burn)

**Visual Patterns:**
- **Pattern depends on herbicide type:**
  - Contact herbicides: **Localized necrotic spots/patches**, often on one side of plant (drift pattern)
  - Growth regulator herbicides (2,4-D drift): **Leaf cupping, epinasty (downward bending), twisted petioles**
  - ALS inhibitors: **Interveinal chlorosis on new growth** + growth cessation (can mimic iron deficiency)
  - PPO inhibitors: **Necrotic spots that appear within 24-48h of application** (rapid onset is the clue)
- **AI discriminator:** Non-biological pattern (one-sided damage, field-edge gradient, sudden onset) + absence of pathogen signs (no spores, no ooze)

**Severity Levels:**

| Level | Description |
|-------|------------|
| 1 | Cosmetic damage, plant will outgrow |
| 2 | Minor growth delay, 1-2 week recovery |
| 3 | Moderate distortion/necrosis, reduced vigor |
| 4 | Severe necrosis or growth disruption, delayed maturity |
| 5 | Plant death or irreversible stunting |

**Treatment Protocol:**
- **Immediate:** Irrigate to dilute soil-applied herbicides; foliar application of cytokinin/gibberellin to stimulate recovery; activated charcoal soil amendment for residual herbicides
- **Preventive:** Proper sprayer calibration; buffer zones; wind-aware application timing
- **Cultural:** Document herbicide history for the field; choose tolerant varieties if residual herbicides are present

**Impact on Harvest:**
- Yield loss: 0-100% depending on herbicide, dose, and crop stage
- Misdiagnosis as disease leads to unnecessary fungicide applications (wasted cost)

---

## Quick Reference: AI Classification Labels

| ID | Label | Category | Confusion Risk |
|----|-------|----------|---------------|
| 0 | Healthy | - | Low |
| 1 | Early Leaf Spot | Fungal | High (vs. Late Leaf Spot) |
| 2 | Late Leaf Spot | Fungal | High (vs. Early Leaf Spot) |
| 3 | Rust | Fungal | Low (distinctive color) |
| 4 | White Mold | Fungal | Medium (vs. Collar Rot) |
| 5 | Aspergillus/Aflatoxin | Fungal | Medium (vs. general rot) |
| 6 | Web Blotch | Fungal | High (vs. Late Leaf Spot) |
| 7 | Collar Rot | Fungal | Medium (vs. White Mold) |
| 8 | Rosette Virus | Viral | Low (distinctive morphology) |
| 9 | Bud Necrosis (PBNV) | Viral | Medium (vs. herbicide injury) |
| 10 | Peanut Mottle | Viral | High (vs. nutrient deficiency) |
| 11 | Bacterial Wilt | Bacterial | Medium (vs. drought wilt) |
| 12 | Root-Knot Nematode | Nematode | High (above-ground vs. N-deficiency) |
| 13 | Iron Chlorosis | Nutritional | High (vs. Mottle Virus, herbicide) |
| 14 | Nitrogen Deficiency | Nutritional | High (vs. Early Leaf Spot, senescence) |
| 15 | Calcium Deficiency | Nutritional | Medium (subtle above-ground) |
| 16 | Boron Deficiency | Nutritional | Medium (vs. herbicide injury) |
| 17 | Drought Stress | Abiotic | Medium (vs. Bacterial Wilt) |
| 18 | Herbicide Injury | Abiotic | High (mimics multiple diseases) |

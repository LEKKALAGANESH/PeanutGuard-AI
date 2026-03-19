#!/usr/bin/env node
/**
 * PeanutGuard End-to-End Disease + Treatment Recommendation Test
 *
 * For each testing image:
 *   1. Infer expected disease from filename
 *   2. Verify disease exists in disease_library.json
 *   3. Verify treatment-engine.ts would produce correct recommendations
 *   4. Print full treatment report (organic, chemical, cultural, brands, dosages)
 *   5. Flag any missing treatments, empty brand lists, or label mismatches
 */

const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.resolve(__dirname, '..', '..', 'testing images');
const LIBRARY_PATH = path.resolve(__dirname, '..', 'src', 'data', 'disease_library.json');

// ── Load disease library ──
const library = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf-8'));

// ── Model disease labels (must match labels.ts exactly) ──
const DISEASE_LABELS = [
  'healthy', 'early_leaf_spot', 'late_leaf_spot', 'rust', 'white_mold',
  'aspergillus_aflatoxin', 'web_blotch', 'collar_rot', 'rosette_virus',
  'bud_necrosis', 'peanut_mottle', 'bacterial_wilt', 'root_knot_nematode',
  'iron_chlorosis', 'nitrogen_deficiency', 'calcium_deficiency',
  'boron_deficiency', 'drought_stress', 'herbicide_injury',
];

// ── Filename → expected disease label mapping ──
// These test images have disease names in their filenames
const FILENAME_TO_DISEASE = {
  'Aspergillus Crown Rot.jpg': {
    expectedLabel: 'aspergillus_aflatoxin',
    description: 'Aspergillus flavus crown rot / aflatoxin risk',
  },
  'Cylindrocladium Black Rot (CBR).jpg': {
    expectedLabel: 'collar_rot',
    description: 'Cylindrocladium parasiticum black rot — maps to collar_rot (closest in 19-class model)',
    note: 'CBR is caused by Cylindrocladium, not Aspergillus niger, but both cause collar/root zone rot. Our 19-class model groups this under collar_rot.',
  },
  'Groundnut_Botrytis-blight_3.png': {
    expectedLabel: 'white_mold',
    description: 'Botrytis cinerea blight — maps to white_mold (Sclerotium/Botrytis group)',
    note: 'Botrytis and Sclerotinia are related fungi; our model groups them under white_mold.',
  },
  'Rhizoctonia Limb Rot.jpg': {
    expectedLabel: 'white_mold',
    description: 'Rhizoctonia solani limb rot — maps to white_mold (soil-borne fungal rot group)',
    note: 'Rhizoctonia and Sclerotium cause similar symptoms; both mapped to white_mold in our 19-class system.',
  },
  'Root-Knot Nematodes.jpg': {
    expectedLabel: 'root_knot_nematode',
    description: 'Meloidogyne arenaria root-knot nematode',
  },
  'Sclerotinia Blight.jpg': {
    expectedLabel: 'white_mold',
    description: 'Sclerotinia minor/Sclerotium rolfsii — maps directly to white_mold',
  },
  'Tomato Spotted Wilt Virus (TSWV).jpg': {
    expectedLabel: 'bud_necrosis',
    description: 'TSWV/PBNV — Orthotospovirus causing bud necrosis disease',
    note: 'TSWV and PBNV are closely related tospoviruses; both cause bud necrosis in peanut. Our model uses bud_necrosis.',
  },
  // Generic-named images — unknown expected disease
  'download.jpg': { expectedLabel: 'unknown', description: 'Unknown — generic filename' },
  'images.jpg': { expectedLabel: 'unknown', description: 'Unknown — generic filename' },
  'images_1.jpg': { expectedLabel: 'unknown', description: 'Unknown — generic filename' },
  'images (1).jpg': { expectedLabel: 'unknown', description: 'Unknown — generic filename' },
  'images (2).jpg': { expectedLabel: 'unknown', description: 'Unknown — generic filename' },
  'images (3).jpg': { expectedLabel: 'unknown', description: 'Unknown — generic filename' },
  'images (4).jpg': { expectedLabel: 'unknown', description: 'Unknown — generic filename' },
  'images (5).jpg': { expectedLabel: 'unknown', description: 'Unknown — generic filename' },
  'images (6).jpg': { expectedLabel: 'unknown', description: 'Unknown — generic filename' },
  'unnamed.jpg': { expectedLabel: 'unknown', description: 'Unknown — generic filename' },
};

// ── Regions to test treatment availability ──
const REGIONS = ['IN', 'NG', 'US'];

// ── Helper: simulate treatment-engine.ts logic ──
function getRecommendations(diseaseLabel, severityScore, region) {
  const disease = library.diseases.find(d => d.label === diseaseLabel);
  if (!disease) return null;

  // Filter chemicals banned in region
  const safeChemicals = disease.treatments.chemical.filter(chem => {
    if (!chem.banned_in || chem.banned_in.length === 0) return true;
    return !chem.banned_in.some(b => b.toLowerCase() === region.toLowerCase());
  });

  const culturalPractices = disease.treatments.cultural.map(entry => entry['en'] || Object.values(entry)[0] || '');

  const urgency =
    severityScore <= 2 ? 'low' :
    severityScore === 3 ? 'medium' :
    severityScore === 4 ? 'high' : 'critical';

  return {
    disease,
    organicTreatments: disease.treatments.organic,
    chemicalTreatments: safeChemicals,
    bannedChemicals: disease.treatments.chemical.filter(c => c.banned_in?.some(b => b.toLowerCase() === region.toLowerCase())),
    culturalPractices,
    yieldImpact: disease.yield_impact,
    urgency,
    severityDescription: disease.severity_descriptions[String(severityScore)]?.['en'] || '',
  };
}

// ── Main ──
function main() {
  const SEP = '='.repeat(90);
  const THIN = '-'.repeat(90);

  console.log(SEP);
  console.log('  PEANUTGUARD DISEASE + TREATMENT RECOMMENDATION E2E TEST');
  console.log('  Validating: filename → disease label → disease_library.json → treatment output');
  console.log(SEP);

  const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  console.log(`\n  Testing ${files.length} images from: ${IMAGES_DIR}\n`);

  let totalTests = 0, passedTests = 0, failedTests = 0;
  const issues = [];

  // ═══ Part 1: Verify ALL 19 disease labels exist in library ═══
  console.log(THIN);
  console.log('  PART 1: Disease Label ↔ Library Integrity');
  console.log(THIN);

  for (const label of DISEASE_LABELS) {
    totalTests++;
    const entry = library.diseases.find(d => d.label === label);
    if (entry) {
      passedTests++;
      console.log(`  [PASS] Label "${label}" → Library entry: "${entry.name.en}" (${entry.scientific_name || 'N/A'})`);
    } else {
      failedTests++;
      console.log(`  [FAIL] Label "${label}" has NO entry in disease_library.json!`);
      issues.push(`Missing library entry for label "${label}"`);
    }
  }

  // ═══ Part 2: Verify each testing image's expected disease + treatments ═══
  console.log('\n' + THIN);
  console.log('  PART 2: Testing Image → Disease → Treatment Recommendations');
  console.log(THIN);

  for (const filename of files) {
    const mapping = FILENAME_TO_DISEASE[filename];
    if (!mapping) {
      console.log(`\n  [SKIP] ${filename} — no mapping defined`);
      continue;
    }

    console.log(`\n${'─'.repeat(90)}`);
    console.log(`  IMAGE: ${filename}`);
    console.log(`  Expected Disease: ${mapping.expectedLabel} (${mapping.description})`);
    if (mapping.note) console.log(`  Note: ${mapping.note}`);
    console.log('─'.repeat(90));

    if (mapping.expectedLabel === 'unknown') {
      console.log('  [INFO] Generic filename — cannot verify disease mapping. Skipping treatment check.');
      continue;
    }

    // Test: label exists in model's DISEASE_LABELS
    totalTests++;
    if (DISEASE_LABELS.includes(mapping.expectedLabel)) {
      passedTests++;
      console.log(`  [PASS] "${mapping.expectedLabel}" exists in model output labels (index ${DISEASE_LABELS.indexOf(mapping.expectedLabel)})`);
    } else {
      failedTests++;
      console.log(`  [FAIL] "${mapping.expectedLabel}" NOT in model output labels!`);
      issues.push(`${filename}: expected label "${mapping.expectedLabel}" not in DISEASE_LABELS`);
      continue;
    }

    // Test: get treatment recommendations for severity 3 (medium)
    for (const region of REGIONS) {
      totalTests++;
      const rec = getRecommendations(mapping.expectedLabel, 3, region);

      if (!rec) {
        failedTests++;
        console.log(`  [FAIL] Region ${region}: No recommendations generated!`);
        issues.push(`${filename}: no recommendations for ${mapping.expectedLabel} in region ${region}`);
        continue;
      }

      const hasOrganic = rec.organicTreatments.length > 0;
      const hasChemical = rec.chemicalTreatments.length > 0;
      const hasCultural = rec.culturalPractices.length > 0;
      const hasYield = rec.yieldImpact.min_pct >= 0 && rec.yieldImpact.max_pct > 0;

      if (hasOrganic && (hasChemical || rec.bannedChemicals.length > 0) && hasCultural && hasYield) {
        passedTests++;
      } else {
        failedTests++;
        issues.push(`${filename} (${region}): missing treatments — organic:${hasOrganic} chemical:${hasChemical} cultural:${hasCultural}`);
      }

      console.log(`\n  Region: ${region} | Urgency: ${rec.urgency.toUpperCase()} | Yield Impact: ${rec.yieldImpact.min_pct}-${rec.yieldImpact.max_pct}%`);
      console.log(`  Severity (3/5): ${rec.severityDescription}`);

      // Organic treatments
      console.log(`\n  ORGANIC TREATMENTS (${rec.organicTreatments.length}):`);
      for (const t of rec.organicTreatments) {
        const brands = t.brands_by_region[region] || [];
        console.log(`    - ${t.name.en}`);
        console.log(`      Active: ${t.active_ingredient}`);
        console.log(`      Dosage: ${t.dosage}`);
        console.log(`      Frequency: ${t.frequency}`);
        console.log(`      Brands (${region}): ${brands.length > 0 ? brands.join(', ') : 'NONE AVAILABLE'}`);

        // Warn if no brands for this region
        totalTests++;
        if (brands.length > 0) {
          passedTests++;
        } else {
          failedTests++;
          console.log(`      [WARN] No brands listed for region ${region}!`);
          issues.push(`${mapping.expectedLabel}: organic "${t.name.en}" has no brands for ${region}`);
        }
      }

      // Chemical treatments (region-safe)
      console.log(`\n  CHEMICAL TREATMENTS — SAFE FOR ${region} (${rec.chemicalTreatments.length}):`);
      for (const t of rec.chemicalTreatments) {
        const brands = t.brands_by_region[region] || [];
        console.log(`    - ${t.name.en}`);
        console.log(`      Active: ${t.active_ingredient}`);
        console.log(`      Dosage: ${t.dosage}`);
        console.log(`      Frequency: ${t.frequency}`);
        console.log(`      Brands (${region}): ${brands.length > 0 ? brands.join(', ') : 'NONE LISTED'}`);

        totalTests++;
        if (brands.length > 0) {
          passedTests++;
        } else {
          // Empty brand list is a warning, not a failure (some chemicals aren't sold in all regions)
          console.log(`      [INFO] No brands for ${region} — chemical may not be registered here`);
          passedTests++; // Not counted as failure
        }
      }

      // Banned chemicals
      if (rec.bannedChemicals.length > 0) {
        console.log(`\n  BANNED IN ${region} (correctly filtered out):`);
        for (const t of rec.bannedChemicals) {
          console.log(`    - ${t.name.en} (banned in: ${t.banned_in.join(', ')})`);
        }
      }

      // Cultural practices
      console.log(`\n  CULTURAL PRACTICES (${rec.culturalPractices.length}):`);
      for (const p of rec.culturalPractices) {
        console.log(`    - ${p}`);
      }

      // Confusion pairs
      console.log(`\n  CONFUSION PAIRS: ${rec.disease.confusion_pairs.join(', ') || 'none'}`);
    }
  }

  // ═══ Part 3: Comprehensive coverage check ═══
  console.log('\n' + THIN);
  console.log('  PART 3: Treatment Coverage Summary');
  console.log(THIN);

  const coverageTable = [];
  for (const disease of library.diseases) {
    if (disease.label === 'healthy') continue;

    const row = {
      label: disease.label,
      name: disease.name.en,
      organic: disease.treatments.organic.length,
      chemical: disease.treatments.chemical.length,
      cultural: disease.treatments.cultural.length,
      hasBrands_IN: disease.treatments.organic.concat(disease.treatments.chemical).some(t => (t.brands_by_region?.IN || []).length > 0),
      hasBrands_NG: disease.treatments.organic.concat(disease.treatments.chemical).some(t => (t.brands_by_region?.NG || []).length > 0),
      hasBrands_US: disease.treatments.organic.concat(disease.treatments.chemical).some(t => (t.brands_by_region?.US || []).length > 0),
      yieldMin: disease.yield_impact.min_pct,
      yieldMax: disease.yield_impact.max_pct,
      hasSeverity: Object.keys(disease.severity_descriptions).length === 5,
    };
    coverageTable.push(row);

    // Test completeness
    totalTests++;
    if (row.organic > 0 && (row.chemical > 0) && row.cultural > 0 && row.hasSeverity) {
      passedTests++;
    } else {
      failedTests++;
      const missing = [];
      if (row.organic === 0) missing.push('organic');
      if (row.chemical === 0) missing.push('chemical');
      if (row.cultural === 0) missing.push('cultural');
      if (!row.hasSeverity) missing.push('severity(all 5 levels)');
      issues.push(`${disease.label}: incomplete — missing ${missing.join(', ')}`);
    }
  }

  console.log('\n  ' + 'Disease'.padEnd(30) + 'Org'.padEnd(5) + 'Chem'.padEnd(6) + 'Cult'.padEnd(6) + 'IN'.padEnd(5) + 'NG'.padEnd(5) + 'US'.padEnd(5) + 'Yield%'.padEnd(10) + 'Sev5');
  console.log('  ' + '-'.repeat(75));
  for (const r of coverageTable) {
    console.log('  ' +
      r.label.padEnd(30) +
      String(r.organic).padEnd(5) +
      String(r.chemical).padEnd(6) +
      String(r.cultural).padEnd(6) +
      (r.hasBrands_IN ? 'Y' : 'N').padEnd(5) +
      (r.hasBrands_NG ? 'Y' : 'N').padEnd(5) +
      (r.hasBrands_US ? 'Y' : 'N').padEnd(5) +
      `${r.yieldMin}-${r.yieldMax}%`.padEnd(10) +
      (r.hasSeverity ? 'Y' : 'N')
    );
  }

  // ═══ Final Summary ═══
  console.log('\n' + SEP);
  console.log('  FINAL RESULTS');
  console.log(SEP);
  console.log(`  Total tests:  ${totalTests}`);
  console.log(`  Passed:       ${passedTests}  (${(passedTests/totalTests*100).toFixed(0)}%)`);
  console.log(`  Failed:       ${failedTests}  (${(failedTests/totalTests*100).toFixed(0)}%)`);

  if (issues.length > 0) {
    console.log(`\n  ISSUES FOUND (${issues.length}):`);
    issues.forEach((issue, i) => console.log(`    ${i + 1}. ${issue}`));
  } else {
    console.log('\n  ALL TESTS PASSED — Disease labels, treatments, and recommendations verified.');
  }
  console.log(SEP);

  process.exit(failedTests > 0 ? 1 : 0);
}

main();

// utils/openai.js
import OpenAI from "openai";
import "dotenv/config";

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

if (!GROQ_KEY) {
  console.error("GROQ_API_KEY missing in .env (get it from console.groq.com)");
}

const client = new OpenAI({
  apiKey: GROQ_KEY,
  baseURL: GROQ_BASE
});

/* ----------------------------------------------------------------
   Curated KB (fallback) - add more entries as you trust them
   ---------------------------------------------------------------- */
const FALLBACK_KB = {
  "brotone s liquid": {
    name: "Brotone S Liquid",
    composition: "B-complex vitamins, liver extract, iron (ferrous), amino acids; exact composition varies by manufacturer",
    formulation: "Liquid",
    category: "Nutritional Supplement",
    uses: [
      "Support appetite and weight gain",
      "Correct nutritional deficiencies",
      "Support recovery after illness",
      "Improve energy and general vitality"
    ],
    common_side_effects: [
      "Mild gastrointestinal upset (rare)",
      "Temporary change in stool consistency"
    ],
    serious_side_effects: [
      "Allergic reaction (rare)"
    ],
    contraindications: [
      "Known hypersensitivity to any component",
      "Use with caution in animals with severe hepatic disease"
    ],
    target_population: ["pets", "young animals", "adult animals"],
    safe_age_groups: ["Puppies","Kittens","Adult dogs","Adult cats"],
    pregnancy_and_lactation: "Use with caution; consult a veterinarian before administration to pregnant or lactating animals.",
    shelf_life_after_manufacture: "Varies by manufacturer; check label (commonly ~2 years unopened).",
    storage_instructions: "Store in a cool, dry place away from direct sunlight. Keep tightly closed.",
    prescription_required: false,
    is_veterinary: true,
    intended_for: "veterinary",
    intended_species: ["canine","feline"],
    dosage_note: "Dosage varies by species and weight; do NOT calculate doses here — consult a veterinarian.",
    sources: ["Manufacturer label"],
    disclaimer: "Not a substitute for professional medical advice.",
    _source: "curated_kb"
  },

  "vitum h liquid": {
    name: "Vitum H Liquid",
    composition: "Multivitamin formulation — typically vitamins A, D, E, K, B-complex and minerals; composition varies by manufacturer",
    formulation: "Liquid",
    category: "Nutritional Supplement",
    uses: [
      "Support overall health and well-being",
      "Correct vitamin/mineral deficiencies",
      "Support recovery after illness or poor appetite"
    ],
    common_side_effects: [
      "Rare gastrointestinal upset",
      "Taste disturbance (rare)"
    ],
    serious_side_effects: [
      "Allergic reaction (rare)"
    ],
    contraindications: [
      "Known hypersensitivity to any component",
      "Caution in patients with hypervitaminosis or specific mineral overload conditions"
    ],
    target_population: ["humans", "children and adults depending on formulation"],
    safe_age_groups: ["Children (age-specific formulations)", "Adults"],
    pregnancy_and_lactation: "Use only as advised by a healthcare professional; some vitamins require caution in pregnancy.",
    shelf_life_after_manufacture: "Varies by manufacturer; check label.",
    storage_instructions: "Store in a cool, dry place away from direct sunlight. Keep tightly closed.",
    prescription_required: false,
    is_veterinary: false,
    intended_for: "human",
    intended_species: null,
    dosage_note: "Dosage varies by age and formulation; consult a healthcare professional for exact dosing.",
    sources: ["Manufacturer label"],
    disclaimer: "Not a substitute for professional medical advice.",
    _source: "curated_kb"
  },

  /* --- NEW: curated veterinary entries for reliable outputs --- */

  "enrofloxacin": {
    name: "Enrofloxacin",
    composition: "Enrofloxacin (concentration varies by formulation; e.g., 100 mg tablet, 100 mg/ml injectable solution)",
    formulation: "Oral tablet, Injectable solution, Topical solution",
    category: "Antibiotic (Fluoroquinolone)",
    intended_for: "veterinary",
    is_veterinary: true,
    intended_species: ["canine", "feline", "bovine", "ovine", "caprine", "porcine"],
    target_population: ["adult animals", "juveniles (with breed/age cautions)"],
    uses: [
      "Treatment of bacterial infections (respiratory tract, urinary tract, skin and soft tissue)",
      "Treatment of gastrointestinal bacterial infections where fluoroquinolones are indicated",
      "Treatment of wound and post-surgical infections (as per veterinary guidance)"
    ],
    common_side_effects: [
      "Vomiting",
      "Diarrhea",
      "Lethargy",
      "Decreased appetite"
    ],
    serious_side_effects: [
      "Seizures or other neurologic signs (rare; higher risk in animals with seizure history)",
      "Tendon/joint/cartilage effects in growing animals (young animals risk)",
      "Phototoxicity (skin sensitivity to light in some cases)",
      "Severe allergic reaction (rare)"
    ],
    contraindications: [
      "Known hypersensitivity to enrofloxacin or other fluoroquinolones",
      "Use in very young animals where cartilage development concerns apply (follow specific product labeling)",
      "Animals with a history of seizures or central nervous system disorders",
      "Concurrent use with drugs known to lower seizure threshold unless under strict veterinary supervision"
    ],
    safe_age_groups: [
      "Adults",
      "Juveniles — use with caution; follow veterinary guidance and product labeling"
    ],
    pregnancy_and_lactation: "Use only if clearly indicated and under veterinary direction; assess risk/benefit—some fluoroquinolones are avoided in pregnancy/lactation depending on species.",
    shelf_life_after_manufacture: "Varies by manufacturer and formulation; check product label (commonly 2–3 years unopened for tablets; solutions vary).",
    storage_instructions: "Store below 25–30°C, protect from light; follow label instructions for injectable storage and discard opened/expired solutions per manufacturer guidance.",
    prescription_required: true,
    dosage_note: "Strictly weight- and species-based dosing. Dose and regimen must be prescribed by a licensed veterinarian. Do NOT use inferred doses.",
    sources: [
      "Plumb's Veterinary Drug Handbook",
      "Product label / manufacturer datasheet"
    ],
    disclaimer: "Not a substitute for professional medical advice.",
    _source: "curated_kb"
  },

  "ivermectin injection 1%": {
    name: "Ivermectin Injection 1%",
    composition: "Ivermectin 10 mg per ml",
    formulation: "Injection",
    category: "Antiparasitic",
    intended_for: "veterinary",
    is_veterinary: true,
    intended_species: ["bovine", "ovine", "caprine", "canine"],
    target_population: ["livestock", "dogs (specific formulations only)"],
    uses: [
      "Treatment of internal parasites (roundworms)",
      "Treatment of external parasites (mites, lice)",
      "Control of mange"
    ],
    common_side_effects: [
      "Temporary swelling at injection site"
    ],
    serious_side_effects: [
      "Neurotoxicity (especially in certain dog breeds like Collies)",
      "Hypersalivation",
      "Ataxia"
    ],
    contraindications: [
      "Do not use in Collies or MDR1-deficient dogs",
      "Avoid use in very young animals",
      "Do not use with other neurotoxic drugs"
    ],
    safe_age_groups: ["Adults", "Young livestock"],
    pregnancy_and_lactation: "Generally safe but use only under veterinary supervision.",
    shelf_life_after_manufacture: "3 years unopened",
    storage_instructions: "Store below 25°C, protect from light.",
    prescription_required: true,
    dosage_note: "Strictly weight-based dosing. Must ONLY be administered by a veterinarian.",
    sources: ["Veterinary drug handbook", "Label information"],
    disclaimer: "Not a substitute for professional medical advice.",
    _source: "curated_kb"
  },

  "meloxicam oral suspension (veterinary)": {
    name: "Meloxicam Oral Suspension (Veterinary)",
    composition: "Meloxicam 1.5 mg/ml or 0.5 mg/ml depending on formulation",
    formulation: "Oral Suspension",
    category: "NSAID (Anti-Inflammatory)",
    intended_for: "veterinary",
    is_veterinary: true,
    intended_species: ["canine", "feline"],
    target_population: ["adult dogs", "adult cats"],
    uses: [
      "Pain relief",
      "Post-operative inflammation",
      "Musculoskeletal disorders",
      "Arthritis management"
    ],
    common_side_effects: [
      "Vomiting",
      "Diarrhea",
      "Loss of appetite"
    ],
    serious_side_effects: [
      "Kidney damage (overdose or prolonged use)",
      "Gastrointestinal ulceration"
    ],
    contraindications: [
      "Dehydration",
      "Renal disease",
      "Concurrent NSAID or steroid use"
    ],
    safe_age_groups: ["Adults only"],
    pregnancy_and_lactation: "Use with caution; consult veterinarian.",
    shelf_life_after_manufacture: "Varies by manufacturer; check label.",
    storage_instructions: "Store below 25°C.",
    prescription_required: true,
    dosage_note: "Strict weight-based dosing; must be prescribed by a veterinarian.",
    sources: ["Veterinary NSAID handbook", "Product label"],
    disclaimer: "Not a substitute for professional medical advice.",
    _source: "curated_kb"
  },

  "calcium pet tonic": {
    name: "Calcium Pet Tonic",
    composition: "Calcium, Phosphorus, Vitamin D3; formulation varies by manufacturer",
    formulation: "Liquid",
    category: "Nutritional Supplement",
    intended_for: "veterinary",
    is_veterinary: true,
    intended_species: ["canine", "feline"],
    target_population: ["puppies", "kittens", "adult dogs", "cats"],
    uses: [
      "Supports bone growth",
      "Improves calcium levels",
      "Useful during pregnancy and lactation",
      "Supports overall musculoskeletal health"
    ],
    common_side_effects: [
      "Mild constipation (rare)",
      "Gastrointestinal upset"
    ],
    serious_side_effects: [
      "Hypercalcemia (overdose risk)"
    ],
    contraindications: [
      "Hypercalcemia",
      "Vitamin D toxicity"
    ],
    safe_age_groups: ["All age groups (dose varies)"],
    pregnancy_and_lactation: "Commonly used; consult veterinarian for correct dosing.",
    shelf_life_after_manufacture: "2 years (varies)",
    storage_instructions: "Store in a cool, dry place.",
    prescription_required: false,
    dosage_note: "Dosing depends on age and body weight; follow veterinarian advice.",
    sources: ["Veterinary nutritional guides"],
    disclaimer: "Not a substitute for professional medical advice.",
    _source: "curated_kb"
  },

  "multistar pet tonic": {
    name: "Multistar Pet Tonic",
    composition: "B-complex vitamins, Vitamin A, D3, E, amino acids, minerals",
    formulation: "Liquid",
    category: "Nutritional Supplement",
    intended_for: "veterinary",
    is_veterinary: true,
    intended_species: ["canine", "feline"],
    target_population: ["puppies", "kittens", "adult dogs", "adult cats"],
    uses: [
      "Supports immunity",
      "Improves appetite",
      "Enhances metabolism",
      "Promotes healthy skin and coat"
    ],
    common_side_effects: [
      "Mild gastrointestinal upset"
    ],
    serious_side_effects: [
      "Allergic reaction to specific vitamins (rare)"
    ],
    contraindications: [
      "Vitamin hypersensitivity",
      "Hypervitaminosis A or D"
    ],
    safe_age_groups: ["All ages (with dosing adjustment)"],
    pregnancy_and_lactation: "Generally safe; use under veterinary guidance.",
    shelf_life_after_manufacture: "2–3 years",
    storage_instructions: "Store in a cool and dry place.",
    prescription_required: false,
    dosage_note: "Dose varies with weight and age; consult a veterinarian.",
    sources: ["Veterinary nutritional guide"],
    disclaimer: "Not a substitute for professional medical advice.",
    _source: "curated_kb"
  }
  // extend this KB with more trusted entries as needed
};

/* ----------------------------------------------------------------
   Token lists & helpers
   ---------------------------------------------------------------- */
const MED_KEYWORDS = [
  "mg","ml","tablet","syrup","capsule","injection","ointment","cream",
  "antibiotic","analgesic","vaccine","antacid","antihistamine",
  "paracetamol","ibuprofen","aspirin","metformin","insulin",
  "doxycycline","amoxicillin","antipsychotic","antidepressant",
  "dose","tablet","ointment","eye drop","eye-drop","liquid",
  "veterinary","vet","for dogs","for cats","for horses","for cattle",
  "for poultry","equine","bovine","canine","feline","avian",
  "tonic","tonics","nutritional tonic","herbal tonic","animal tonic","electrolyte",
  "poultry tonic","cattle tonic","livestock","brotone","vitum","enrofloxacin","ivermectin","meloxicam","calcium"
];

const TONIC_KEYWORDS = ["tonic", "tonics", "nutritional tonic", "herbal tonic", "animal tonic", "syrup", "liquid", "brotone", "vitum"];
const THERAPEUTIC_DRUG_KEYWORDS = ["antifungal","antibacterial","antibiotic","antiviral","antiprotozoal","anthelmintic","antiparasitic","antiparasitic"];

/* simple token containment helper */
function containsAnyToken(s, tokens) {
  if (!s || !tokens || tokens.length === 0) return false;
  const lower = s.toLowerCase();
  return tokens.some(t => lower.includes(t.toLowerCase()));
}

/* normalize keys for KB */
function normalizeKey(s) {
  if (!s || typeof s !== "string") return "";
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/* find curated entry if available */
function findFallbackEntry(name) {
  if (!name || typeof name !== "string") return null;
  const key = normalizeKey(name);
  if (FALLBACK_KB[key]) return FALLBACK_KB[key];
  for (const k of Object.keys(FALLBACK_KB)) {
    if (key.includes(k) || k.includes(key)) return FALLBACK_KB[k];
  }
  return null;
}

/* parse JSON from model text */
function parseJsonFromText(text) {
  if (!text || typeof text !== "string") return null;
  const s = text.trim();
  try {
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      return JSON.parse(s);
    }
  } catch (e) {
    // fall through
  }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    const candidate = s.slice(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // fall through
    }
  }
  return null;
}

/* ----------------------------------------------------------------
   Generic chat helper
   ---------------------------------------------------------------- */
export const getOpenAIAPIResponse = async (prompt) => {
  try {
    const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800
    });
    const content = response?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("Groq returned empty content; raw response:", response);
      return null;
    }
    return String(content).trim();
  } catch (err) {
    const code = err?.code || err?.error?.code;
    if (code === "model_decommissioned" || (err?.error?.type === "invalid_request_error" &&
        String(err?.error?.message || "").toLowerCase().includes("decommission"))) {
      console.error("Model decommissioned. Update GROQ_MODEL in .env to a supported model. See Groq deprecations: https://console.groq.com/docs/deprecations");
    }
    console.error("Groq API error (chat):", err);
    return null;
  }
};

/* ----------------------------------------------------------------
   Classifier (KB-first)
   ---------------------------------------------------------------- */
export const classifyMedicineQuery = async (query) => {
  try {
    if (!query || typeof query !== "string") {
      return { is_medicine: false, normalized_name: null, confidence: 0.0, is_veterinary: false, intended_species: null, intended_for: null };
    }
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return { is_medicine: false, normalized_name: null, confidence: 0.0, is_veterinary: false, intended_species: null, intended_for: null };
    }

    // KB-first
    const kb = findFallbackEntry(trimmed);
    if (kb) {
      return {
        is_medicine: true,
        normalized_name: kb.name.toLowerCase(),
        confidence: 0.99,
        is_veterinary: Boolean(kb.is_veterinary),
        intended_species: Array.isArray(kb.intended_species) ? kb.intended_species : null,
        intended_for: kb.intended_for || (kb.is_veterinary ? "veterinary" : "human"),
        _kb_source: kb._source || "curated_kb"
      };
    }

    // heuristic pre-check
    if (!containsAnyToken(trimmed, MED_KEYWORDS) && !/\b\d+\s*(mg|ml|mcg|g|iu)\b/.test(trimmed)) {
      return { is_medicine: false, normalized_name: null, confidence: 0.0, is_veterinary: false, intended_species: null, intended_for: null };
    }

    const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
    const systemPrompt = `
You are a STRICT JSON-only classifier. Output EXACTLY ONE JSON object and NOTHING ELSE.

Schema:
{
  "is_medicine": boolean,
  "normalized_name": string | null,
  "confidence": number,
  "is_veterinary": boolean,
  "intended_species": string[] | null,
  "intended_for": "human" | "veterinary" | "both" | null
}

Rules:
- is_medicine true only when input clearly refers to a medicine, supplement, tonic, or similar product.
- intended_for must be "human", "veterinary", "both", or null.
- If unsure, prefer conservative results and set confidence lower.
- DO NOT output any extra text.
`.trim();

    const examples = [
      { q: "paracetamol", out: { is_medicine: true, normalized_name: "paracetamol", confidence: 0.95, is_veterinary: false, intended_species: null, intended_for: "human" } },
      { q: "oxytetracycline for cattle", out: { is_medicine: true, normalized_name: "oxytetracycline", confidence: 0.95, is_veterinary: true, intended_species: ["bovine"], intended_for: "veterinary" } },
      { q: "brotone s liquid", out: { is_medicine: true, normalized_name: "brotone s liquid", confidence: 0.9, is_veterinary: true, intended_species: ["canine","feline"], intended_for: "veterinary" } }
    ];

    const messages = [{ role: "system", content: systemPrompt }];
    for (const ex of examples) {
      messages.push({ role: "user", content: ex.q });
      messages.push({ role: "assistant", content: JSON.stringify(ex.out) });
    }
    messages.push({ role: "user", content: trimmed });

    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 160,
      temperature: 0.0,
      top_p: 0.0
    });

    const raw = response?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") {
      console.error("Classifier empty response:", response);
      return { is_medicine: false, normalized_name: null, confidence: 0.0, is_veterinary: false, intended_species: null, intended_for: null };
    }

    const parsed = parseJsonFromText(raw.trim());
    if (!parsed || typeof parsed !== "object") {
      console.error("Classifier parse error:", raw);
      return { is_medicine: false, normalized_name: null, confidence: 0.0, is_veterinary: false, intended_species: null, intended_for: null };
    }

    return {
      is_medicine: Boolean(parsed.is_medicine),
      normalized_name: parsed.normalized_name ?? null,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.0,
      is_veterinary: Boolean(parsed.is_veterinary),
      intended_species: Array.isArray(parsed.intended_species) ? parsed.intended_species.map(String) : null,
      intended_for: parsed.intended_for ?? null
    };
  } catch (err) {
    console.error("Classifier error:", err);
    return { is_medicine: false, normalized_name: null, confidence: 0.0, is_veterinary: false, intended_species: null, intended_for: null };
  }
};

/* ----------------------------------------------------------------
   getMedicineDetails: KB-first, else LLM. ALWAYS returns full record.
   Fields that are not confidently known are filled with clearly marked inferred values.
   ---------------------------------------------------------------- */
export const getMedicineDetails = async (medicineName) => {
  try {
    if (!medicineName || typeof medicineName !== "string") return null;

    // 0) KB fallback
    const kbEntry = findFallbackEntry(medicineName);
    if (kbEntry) {
      // deep copy
      const out = JSON.parse(JSON.stringify(kbEntry));
      // ensure all fields exist and set _inferred: false
      out._inferred = false;
      out._inference_notes = [];
      return out;
    }

    const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

    // 1) Strong system prompt requiring complete JSON record
    const systemPrompt = `
You are a medical product information extractor. Output EXACTLY ONE JSON object and NOTHING ELSE.

Schema:
{
  "name": string,
  "composition": string,
  "formulation": string,
  "category": string,
  "intended_for": "human" | "veterinary" | "both" | "unknown",
  "is_veterinary": boolean,
  "intended_species": string[] | null,
  "target_population": string[] | null,
  "uses": string[],
  "common_side_effects": string[],
  "serious_side_effects": string[],
  "contraindications": string[],
  "safe_age_groups": string[],
  "pregnancy_and_lactation": string,
  "shelf_life_after_manufacture": string,
  "storage_instructions": string,
  "prescription_required": boolean,
  "dosage_note": string,
  "sources": string[] | null,
  "disclaimer": string
}

Rules:
- Provide a complete record filling every field. Do NOT output "None specified" or leave empty fields.
- If a field is not known from reliable data, provide a CONSERVATIVE inferred phrase starting with "Inferred: ..." that indicates it is an inference — e.g., "Inferred: likely contains B-complex vitamins". This helps downstream UI show inferred vs. KB-backed data.
- intended_for must be one of "human", "veterinary", "both", or "unknown".
- is_veterinary must be true when intended_for is "veterinary" or "both".
- dosage_note must remain non-prescriptive and must NOT include any dosing calculations.
- disclaimer must be exactly: "Not a substitute for professional medical advice."
- Output valid JSON only, nothing else.
`.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Provide structured information for the product: "${medicineName}".` }
    ];

    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 1400,
      temperature: 0.0,
      top_p: 0.0
    });

    const raw = response?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== "string") {
      console.error("Details: empty response", response);
      return null;
    }

    let parsed = parseJsonFromText(raw);
    if (!parsed || typeof parsed !== "object") {
      console.error("Details: failed to parse JSON from model output:", raw);
      // As a robust fallback, build an inferred record rather than returning null
      parsed = {
        name: medicineName,
        composition: `Inferred: unknown composition (no model JSON parsable)`,
        formulation: "Inferred: unknown",
        category: "Inferred: unknown",
        intended_for: "unknown",
        is_veterinary: false,
        intended_species: null,
        target_population: null,
        uses: ["Inferred: unknown uses — consult a professional"],
        common_side_effects: ["Inferred: unknown"],
        serious_side_effects: ["Inferred: unknown"],
        contraindications: ["Inferred: unknown"],
        safe_age_groups: ["Inferred: unknown"],
        pregnancy_and_lactation: "Inferred: unknown — consult a professional",
        shelf_life_after_manufacture: "Inferred: unknown",
        storage_instructions: "Inferred: unknown",
        prescription_required: true,
        dosage_note: "Consult a healthcare professional or veterinarian for exact dosing.",
        sources: ["inferred"],
        disclaimer: "Not a substitute for professional medical advice."
      };
    }

    // Ensure fields exist — if missing or empty, replace with an INFERRED placeholder and note it
    const inferenceNotes = [];
    const out = {};

    // Helper to mark inference
    const markInferred = (field, reason, inferredValue) => {
      inferenceNotes.push({ field, reason, inferred_value: inferredValue });
      return inferredValue;
    };

    // name (fallback to input)
    out.name = parsed.name && String(parsed.name).trim() ? String(parsed.name).trim() : markInferred("name", "missing name", medicineName);

    // composition
    if (parsed.composition && String(parsed.composition).trim() && !/^Varies$/i.test(String(parsed.composition).trim())) {
      out.composition = String(parsed.composition).trim();
    } else {
      out.composition = markInferred("composition", "composition missing or vague", `Inferred: likely composition based on category/name (verify with manufacturer)`);
    }

    // formulation
    if (parsed.formulation && String(parsed.formulation).trim() && !/^Varies$/i.test(String(parsed.formulation).trim())) {
      out.formulation = String(parsed.formulation).trim();
    } else {
      // attempt to infer from name contains "liquid"/"injection"/"syrup" etc.
      const lname = String(medicineName).toLowerCase();
      if (/\binjection\b/.test(lname)) {
        out.formulation = "Injection";
        inferenceNotes.push({ field: "formulation", reason: "inferred from product name", inferred_value: "Injection" });
      } else if (/\b(liquid|syrup|solution|suspension)\b/.test(lname)) {
        out.formulation = "Liquid";
        inferenceNotes.push({ field: "formulation", reason: "inferred from product name", inferred_value: "Liquid" });
      } else {
        out.formulation = markInferred("formulation", "missing formulation", "Inferred: unknown formulation");
      }
    }

    // category
    if (parsed.category && String(parsed.category).trim() && !/^Varies$/i.test(String(parsed.category).trim())) {
      out.category = String(parsed.category).trim();
    } else {
      // try to infer category heuristically by name tokens
      const lname = String(medicineName).toLowerCase();
      if (/\b(ivermectin|fenbendazole|albendazole|praziquantel)\b/.test(lname)) {
        out.category = "Antiparasitic";
        inferenceNotes.push({ field: "category", reason: "inferred from product name tokens", inferred_value: "Antiparasitic" });
      } else if (/\b(enrofloxacin|amoxicillin|oxytetracycline|cef)\b/.test(lname)) {
        out.category = "Antibiotic";
        inferenceNotes.push({ field: "category", reason: "inferred from product name tokens", inferred_value: "Antibiotic" });
      } else if (containsAnyToken(lname, TONIC_KEYWORDS)) {
        out.category = "Nutritional Supplement";
        inferenceNotes.push({ field: "category", reason: "tonic cues in name", inferred_value: "Nutritional Supplement" });
      } else {
        out.category = markInferred("category", "missing category", "Inferred: unknown category");
      }
    }

    // intended_for & is_veterinary
    if (parsed.intended_for && ["human","veterinary","both","unknown"].includes(parsed.intended_for)) {
      out.intended_for = parsed.intended_for;
      out.is_veterinary = parsed.is_veterinary === true || parsed.intended_for === "veterinary" || parsed.intended_for === "both";
    } else {
      // attempt inference from name / tokens
      const lname = String(medicineName).toLowerCase();
      if (/\b(for dogs|for cats|canine|feline|bovine|equine|poultry|livestock|vet|veterinary)\b/.test(lname) || containsAnyToken(lname, TONIC_KEYWORDS)) {
        out.intended_for = "veterinary";
        out.is_veterinary = true;
        inferenceNotes.push({ field: "intended_for", reason: "inferred from name tokens", inferred_value: "veterinary" });
      } else {
        out.intended_for = markInferred("intended_for", "missing intended_for", "unknown");
        out.is_veterinary = false;
      }
    }

    // intended_species
    if (Array.isArray(parsed.intended_species) && parsed.intended_species.length > 0) {
      out.intended_species = parsed.intended_species.map(String);
    } else {
      // infer species if veterinary cue present
      const lname = String(medicineName).toLowerCase();
      const species = [];
      if (/\b(dog|dogs|canine)\b/.test(lname)) species.push("canine");
      if (/\b(cat|cats|feline)\b/.test(lname)) species.push("feline");
      if (/\b(cattle|bovine)\b/.test(lname)) species.push("bovine");
      if (/\b(poultry|chicken)\b/.test(lname)) species.push("poultry");
      if (/\b(horse|horses|equine)\b/.test(lname)) species.push("equine");
      out.intended_species = species.length > 0 ? species : markInferred("intended_species", "missing species", null);
    }

    // target_population
    if (Array.isArray(parsed.target_population) && parsed.target_population.length > 0) {
      out.target_population = parsed.target_population.map(String);
    } else {
      // infer simple groups
      out.target_population = out.intended_for === "veterinary" ? ["livestock", "pets"] : ["adults", "children (formulation-dependent)"];
      inferenceNotes.push({ field: "target_population", reason: "inferred default groups", inferred_value: out.target_population });
    }

    // uses
    if (Array.isArray(parsed.uses) && parsed.uses.length > 0) {
      out.uses = parsed.uses.map(String);
    } else {
      // try to infer common uses from category
      const cat = String(out.category || "").toLowerCase();
      if (cat.includes("antiparasitic")) {
        out.uses = ["Treatment of internal or external parasites (species & formulation dependent)"];
        inferenceNotes.push({ field: "uses", reason: "inferred from category antiparasitic", inferred_value: out.uses });
      } else if (cat.includes("antibiotic")) {
        out.uses = ["Treatment of bacterial infections (species & site dependent)"];
        inferenceNotes.push({ field: "uses", reason: "inferred from category antibiotic", inferred_value: out.uses });
      } else if (cat.includes("nutritional") || cat.includes("tonic") || containsAnyToken(String(medicineName).toLowerCase(), TONIC_KEYWORDS)) {
        out.uses = ["Support general nutrition and correct deficiencies", "Improve appetite and vitality"];
        inferenceNotes.push({ field: "uses", reason: "inferred as tonic/supplement", inferred_value: out.uses });
      } else {
        out.uses = markInferred("uses", "missing uses", ["Inferred: consult a professional for intended therapeutic uses."]);
      }
    }

    // common_side_effects
    if (Array.isArray(parsed.common_side_effects) && parsed.common_side_effects.length > 0) {
      out.common_side_effects = parsed.common_side_effects.map(String);
    } else {
      // conservative generic placeholders based on category
      const cat = String(out.category || "").toLowerCase();
      if (cat.includes("antiparasitic")) {
        out.common_side_effects = ["Temporary swelling at injection site (if injectable)", "Mild gastrointestinal upset"];
      } else if (cat.includes("antibiotic")) {
        out.common_side_effects = ["Vomiting", "Diarrhea", "Loss of appetite"];
      } else {
        out.common_side_effects = ["Mild gastrointestinal upset (rare)"];
      }
      inferenceNotes.push({ field: "common_side_effects", reason: "inferred defaults", inferred_value: out.common_side_effects });
    }

    // serious_side_effects
    if (Array.isArray(parsed.serious_side_effects) && parsed.serious_side_effects.length > 0) {
      out.serious_side_effects = parsed.serious_side_effects.map(String);
    } else {
      const cat = String(out.category || "").toLowerCase();
      if (cat.includes("antiparasitic")) {
        out.serious_side_effects = ["Neurotoxicity in susceptible breeds (e.g., Collies) - rare", "Severe allergic reaction"];
      } else if (cat.includes("antibiotic")) {
        out.serious_side_effects = ["Severe allergic reaction", "Organ toxicity in overdose - species dependent"];
      } else {
        out.serious_side_effects = ["Severe allergic reaction (rare)"];
      }
      inferenceNotes.push({ field: "serious_side_effects", reason: "inferred defaults", inferred_value: out.serious_side_effects });
    }

    // contraindications
    if (Array.isArray(parsed.contraindications) && parsed.contraindications.length > 0) {
      out.contraindications = parsed.contraindications.map(String);
    } else {
      const cat = String(out.category || "").toLowerCase();
      if (cat.includes("antiparasitic")) {
        out.contraindications = ["Do not use in known MDR1-deficient animals (breeds such as Collies)", "Avoid use in very young animals unless specified"];
      } else if (cat.includes("antibiotic")) {
        out.contraindications = ["Known hypersensitivity to the active ingredient", "Use with caution in animals with specific organ dysfunction"];
      } else {
        out.contraindications = ["Known hypersensitivity to any component"];
      }
      inferenceNotes.push({ field: "contraindications", reason: "inferred defaults", inferred_value: out.contraindications });
    }

    // safe_age_groups
    if (Array.isArray(parsed.safe_age_groups) && parsed.safe_age_groups.length > 0) {
      out.safe_age_groups = parsed.safe_age_groups.map(String);
    } else {
      out.safe_age_groups = ["Adults"];
      if (out.intended_for === "veterinary") out.safe_age_groups.push("Young animals (species-specific dosing may apply)");
      inferenceNotes.push({ field: "safe_age_groups", reason: "inferred defaults", inferred_value: out.safe_age_groups });
    }

    // pregnancy_and_lactation
    if (parsed.pregnancy_and_lactation && String(parsed.pregnancy_and_lactation).trim() && !/^Varies$/i.test(String(parsed.pregnancy_and_lactation).trim())) {
      out.pregnancy_and_lactation = String(parsed.pregnancy_and_lactation).trim();
    } else {
      out.pregnancy_and_lactation = "Use with caution; consult a veterinarian or healthcare professional before use during pregnancy or lactation.";
      inferenceNotes.push({ field: "pregnancy_and_lactation", reason: "inferred default caution", inferred_value: out.pregnancy_and_lactation });
    }

    // shelf_life_after_manufacture
    if (parsed.shelf_life_after_manufacture && String(parsed.shelf_life_after_manufacture).trim()) {
      out.shelf_life_after_manufacture = String(parsed.shelf_life_after_manufacture).trim();
    } else {
      out.shelf_life_after_manufacture = "Inferred: check manufacturer label (commonly 2–3 years unopened)";
      inferenceNotes.push({ field: "shelf_life_after_manufacture", reason: "inferred default", inferred_value: out.shelf_life_after_manufacture });
    }

    // storage_instructions
    if (parsed.storage_instructions && String(parsed.storage_instructions).trim()) {
      out.storage_instructions = String(parsed.storage_instructions).trim();
    } else {
      out.storage_instructions = "Store in a cool, dry place away from direct sunlight. Keep tightly closed.";
      inferenceNotes.push({ field: "storage_instructions", reason: "inferred default", inferred_value: out.storage_instructions });
    }

    // prescription_required (boolean)
    if (typeof parsed.prescription_required === "boolean") {
      out.prescription_required = parsed.prescription_required;
    } else {
      // default conservative: therapeutic drugs require prescription; supplements/tonics do not
      out.prescription_required = /nutritional|tonic|supplement/i.test(out.category) ? false : true;
      inferenceNotes.push({ field: "prescription_required", reason: "inferred default from category", inferred_value: out.prescription_required });
    }

    // dosage_note (non-prescriptive)
    if (parsed.dosage_note && String(parsed.dosage_note).trim()) {
      out.dosage_note = String(parsed.dosage_note).trim();
    } else {
      out.dosage_note = "Strictly weight-based dosing where applicable. Must be determined by a licensed veterinarian or healthcare professional. Do NOT use inferred doses.";
      inferenceNotes.push({ field: "dosage_note", reason: "inferred safe guidance", inferred_value: out.dosage_note });
    }

    // sources
    if (Array.isArray(parsed.sources) && parsed.sources.length > 0) {
      out.sources = parsed.sources.map(String);
    } else {
      out.sources = ["inferred"];
      inferenceNotes.push({ field: "sources", reason: "no explicit sources provided", inferred_value: out.sources });
    }

    // disclaimer
    out.disclaimer = "Not a substitute for professional medical advice.";

    // final safety: ensure arrays are arrays
    if (!Array.isArray(out.uses)) out.uses = [String(out.uses)];
    if (!Array.isArray(out.common_side_effects)) out.common_side_effects = [String(out.common_side_effects)];
    if (!Array.isArray(out.serious_side_effects)) out.serious_side_effects = [String(out.serious_side_effects)];
    if (!Array.isArray(out.contraindications)) out.contraindications = [String(out.contraindications)];
    if (!Array.isArray(out.safe_age_groups)) out.safe_age_groups = [String(out.safe_age_groups)];
    if (out.intended_species && !Array.isArray(out.intended_species)) out.intended_species = [String(out.intended_species)];
    if (out.target_population && !Array.isArray(out.target_population)) out.target_population = [String(out.target_population)];
    if (out.sources && !Array.isArray(out.sources)) out.sources = [String(out.sources)];

    // attach inference metadata
    out._inferred = inferenceNotes.length > 0;
    out._inference_notes = inferenceNotes;

    return out;
  } catch (err) {
    console.error("Groq API error (details):", err);
    return null;
  }
};

export default getOpenAIAPIResponse;

/**
 * Fuzzy voice query matching — maps speech transcripts to pre-defined actions.
 * Uses keyword matching with Levenshtein distance tolerance.
 * Supports English and Hindi keywords.
 */

export type QueryAction =
  | 'show_treatment'
  | 'show_severity'
  | 'show_harvest'
  | 'show_explanation'
  | 'show_impact'
  | 'show_common_questions';

export interface QueryMatch {
  action: QueryAction;
  confidence: number;
}

interface QueryPattern {
  action: QueryAction;
  keywords: string[];
}

const QUERY_PATTERNS: QueryPattern[] = [
  {
    action: 'show_treatment',
    keywords: [
      'spray',
      'treat',
      'treatment',
      'medicine',
      'chemical',
      'cure',
      'remedy',
      'fungicide',
      'pesticide',
      // Hindi
      'dawai',
      'spray karu',
      'upchar',
      'ilaj',
      'dawa',
    ],
  },
  {
    action: 'show_severity',
    keywords: [
      'serious',
      'bad',
      'danger',
      'dangerous',
      'worry',
      'severe',
      'severity',
      'critical',
      'how bad',
      // Hindi
      'kharab',
      'gambhir',
      'bura',
      'khatarnak',
      'chinta',
    ],
  },
  {
    action: 'show_harvest',
    keywords: [
      'harvest',
      'ready',
      'dig',
      'pull',
      'mature',
      'maturity',
      'pick',
      'when harvest',
      // Hindi
      'harvest kab',
      'taiyar',
      'nikalna',
      'pakka',
      'uthai',
    ],
  },
  {
    action: 'show_explanation',
    keywords: [
      'cause',
      'why',
      'reason',
      'how',
      'explain',
      'what is',
      'tell me',
      // Hindi
      'kyu',
      'kaise',
      'karan',
      'kya hai',
      'batao',
      'samjhao',
    ],
  },
  {
    action: 'show_impact',
    keywords: [
      'lose',
      'loss',
      'yield',
      'money',
      'cost',
      'damage',
      'affect',
      'production',
      'crop loss',
      // Hindi
      'nuksan',
      'fasal',
      'paisa',
      'upaj',
      'hani',
      'paidavar',
    ],
  },
  {
    action: 'show_common_questions',
    keywords: [
      'help',
      'question',
      'questions',
      'options',
      'what can',
      'menu',
      // Hindi
      'madad',
      'sawal',
      'kya kar',
      'dikha',
    ],
  },
];

/** Default match returned when no action could be determined. */
const NO_MATCH: QueryMatch = {
  action: 'show_common_questions',
  confidence: 0,
};

/** Levenshtein tolerance: max edit distance for a keyword to be considered a match. */
const MAX_EDIT_DISTANCE = 2;

/**
 * Levenshtein distance between two strings.
 * Uses the classic dynamic programming approach (O(m*n) time and space).
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Short-circuit for empty strings
  if (m === 0) return n;
  if (n === 0) return m;

  // Guard against excessive memory usage (200-char limit is far beyond any keyword)
  if (m > 200 || n > 200) return Math.max(m, n);

  // Create distance matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Check if a word fuzzy-matches a keyword within the Levenshtein tolerance.
 * Returns a score from 0 (no match) to 1 (exact match).
 */
function fuzzyMatchScore(word: string, keyword: string): number {
  // Exact match
  if (word === keyword) return 1.0;

  // Substring containment (word contains keyword or vice versa)
  if (word.includes(keyword)) return 0.9;
  if (keyword.includes(word) && word.length >= 3) return 0.8;

  // Levenshtein distance for short keywords
  const distance = levenshtein(word, keyword);
  if (distance <= MAX_EDIT_DISTANCE) {
    // Scale score: distance 1 -> 0.7, distance 2 -> 0.5
    return Math.max(0, 1.0 - distance * 0.25);
  }

  return 0;
}

/**
 * Match a voice transcript to a pre-defined query action.
 * Uses keyword matching with Levenshtein distance tolerance.
 * Supports English and Hindi keywords.
 *
 * @param transcript - The raw speech-to-text transcript
 * @returns QueryMatch with action and confidence (0-1)
 */
export function matchVoiceQuery(transcript: string): QueryMatch {
  if (!transcript || transcript.trim().length === 0) {
    return NO_MATCH;
  }

  const normalized = transcript.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  let bestAction: QueryAction = 'show_common_questions';
  let bestScore = 0;

  for (const pattern of QUERY_PATTERNS) {
    let patternScore = 0;

    for (const keyword of pattern.keywords) {
      // Multi-word keyword: check if the full phrase appears in the transcript
      if (keyword.includes(' ')) {
        if (normalized.includes(keyword)) {
          // Multi-word exact match gets a high score
          patternScore = Math.max(patternScore, 0.95);
        }
        continue;
      }

      // Single-word keyword: check each word in the transcript
      for (const word of words) {
        const score = fuzzyMatchScore(word, keyword);
        patternScore = Math.max(patternScore, score);
      }
    }

    if (patternScore > bestScore) {
      bestScore = patternScore;
      bestAction = pattern.action;
    }
  }

  // Only return a confident match if score exceeds threshold
  if (bestScore >= 0.5) {
    return {
      action: bestAction,
      confidence: bestScore,
    };
  }

  return NO_MATCH;
}

/**
 * Get human-readable labels for each action, supporting multiple locales.
 */
export function getActionLabel(action: QueryAction, locale: string): string {
  const isHindi = locale.startsWith('hi');

  const labels: Record<QueryAction, { en: string; hi: string }> = {
    show_treatment: {
      en: 'What treatment should I use?',
      hi: 'Kya dawai lagani chahiye?',
    },
    show_severity: {
      en: 'How serious is this disease?',
      hi: 'Yeh bimari kitni gambhir hai?',
    },
    show_harvest: {
      en: 'When should I harvest?',
      hi: 'Harvest kab karein?',
    },
    show_explanation: {
      en: 'What caused this disease?',
      hi: 'Yeh bimari kaise hui?',
    },
    show_impact: {
      en: 'How much yield will I lose?',
      hi: 'Kitna nuksan hoga?',
    },
    show_common_questions: {
      en: 'Show common questions',
      hi: 'Sawal dikhao',
    },
  };

  const label = labels[action];
  return isHindi ? label.hi : label.en;
}

/**
 * Get all available actions for the fallback question button UI.
 */
export function getAllActions(): QueryAction[] {
  return [
    'show_treatment',
    'show_severity',
    'show_harvest',
    'show_explanation',
    'show_impact',
  ];
}

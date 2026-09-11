const { hashSecret } = require('./crypto');

/**
 * Normalizes text for comparison (lowercase, strips non-alphanumeric except space, trims)
 */
function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/['’]/g, '') // remove apostrophes so "Evan's" -> "evans"
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshtein(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = [];
  for (let i = 0; i <= bn; ++i) matrix[i] = [i];
  for (let i = 0; i <= an; ++i) matrix[0][i] = i;
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Compares two answer strings and returns similarity ratio (0.0 to 1.0)
 */
function compareAnswers(submitted, expected) {
  const normSub = normalize(submitted);
  const normExp = normalize(expected);

  if (!normSub || !normExp) return 0;
  if (normSub === normExp) return 1.0;

  // Check if expected is fully contained in submitted or vice versa
  if (normSub.includes(normExp) || normExp.includes(normSub)) {
    return 0.95;
  }

  // Also check without spaces (useful for initials e.g. "M.C." vs "mc initials")
  const compactSub = normSub.replace(/\s+/g, '');
  const compactExp = normExp.replace(/\s+/g, '');
  if (compactSub.includes(compactExp) || compactExp.includes(compactSub)) {
    return 0.9;
  }

  // Token matching (e.g. "Evan Pods 2024" vs "Evan's Pods 2024")
  const subTokens = new Set(normSub.split(' '));
  const expTokens = normExp.split(' ');
  let tokenMatches = 0;
  for (const token of expTokens) {
    if (subTokens.has(token)) tokenMatches++;
  }
  const tokenScore = tokenMatches / expTokens.length;

  // Fuzzy Levenshtein similarity
  const maxLen = Math.max(normSub.length, normExp.length);
  const dist = levenshtein(normSub, normExp);
  const levScore = Math.max(0, 1 - dist / maxLen);

  return Math.max(tokenScore, levScore);
}

/**
 * Evaluates a claimant's attempt against an item's challenge
 * @param {Object} params
 * @param {Array} params.submittedAnswers - Array of user's answers strings
 * @param {Array} params.expectedAnswers - Array of secret expected answers strings
 * @param {string} params.submittedSerial - User entered serial
 * @param {string} params.expectedSerial - Stored intake serial (or hash)
 * @param {string} params.proofNotes - Additional proof description
 * @returns {Object} { score: number, passedThreshold: boolean, serialMatched: boolean, details: string }
 */
function evaluateClaim({ submittedAnswers = [], expectedAnswers = [], submittedSerial, expectedSerial, proofNotes }) {
  let questionPoints = 0;
  let totalQuestionWeight = expectedAnswers.length > 0 ? expectedAnswers.length : 1;

  expectedAnswers.forEach((expected, idx) => {
    const submitted = submittedAnswers[idx] || '';
    const sim = compareAnswers(submitted, expected);
    // If similarity >= 0.7, consider it a strong answer
    if (sim >= 0.85) {
      questionPoints += 1.0;
    } else if (sim >= 0.65) {
      questionPoints += 0.7;
    } else if (sim >= 0.45) {
      questionPoints += 0.3;
    }
  });

  const questionScore = Math.min(100, Math.round((questionPoints / totalQuestionWeight) * 70));

  let serialScore = 0;
  let serialMatched = false;
  if (expectedSerial && submittedSerial) {
    const normSubSerial = normalize(submittedSerial).replace(/\s/g, '');
    const normExpSerial = normalize(expectedSerial).replace(/\s/g, '');
    if (normSubSerial === normExpSerial) {
      serialScore = 30;
      serialMatched = true;
    } else if (normSubSerial.length > 3 && (normSubSerial.includes(normExpSerial) || normExpSerial.includes(normSubSerial))) {
      serialScore = 20;
    }
  } else if (!expectedSerial) {
    // If no serial was recorded, scale questions to 100%
    serialScore = Math.round((questionScore / 70) * 30);
  }

  // Bonus for detailed proof notes (photos/receipt descriptions)
  let proofBonus = 0;
  if (proofNotes && proofNotes.trim().length >= 20) {
    proofBonus = 5;
  }

  const totalScore = Math.min(100, questionScore + serialScore + proofBonus);
  const passedThreshold = totalScore >= 75 || serialMatched;

  return {
    score: totalScore,
    passedThreshold,
    serialMatched,
    summary: passedThreshold 
      ? 'Strong match detected. Routed for Campus Admin final review.' 
      : 'Answers did not meet verification confidence threshold.'
  };
}

module.exports = {
  normalize,
  levenshtein,
  compareAnswers,
  evaluateClaim
};

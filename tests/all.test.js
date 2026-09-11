const assert = require('assert');
const { encryptPII, decryptPII, createLogHash, hashSecret } = require('../server/crypto');
const { evaluateClaim, compareAnswers } = require('../server/matcher');

console.log('--- Running Back2You Automated Security & Verification Tests ---');

// Test 1: PII Encryption & Decryption (AES-256-GCM)
{
  const originalLocation = 'Cabot Science Library, 3rd Floor Carrel 42, Locker B-7';
  const encrypted = encryptPII(originalLocation);
  assert.notStrictEqual(encrypted, originalLocation, 'Encrypted string must not match plaintext');
  assert(encrypted.includes(':'), 'Encrypted output should format as iv:authTag:cipher');

  const decrypted = decryptPII(encrypted);
  assert.strictEqual(decrypted, originalLocation, 'Decrypted text must match original plaintext');
  console.log('✓ Test 1: AES-256-GCM PII Encryption & Decryption passed.');
}

// Test 2: Confidential Claim Matching Engine (Fuzzy + Token + Serial)
{
  const expectedAnswers = ["Evan's Pods 2024", 'M.C.'];
  const expectedSerial = 'H9CGV42K01';

  // Exact match attempt
  const exactResult = evaluateClaim({
    submittedAnswers: ["Evan's Pods 2024", 'M.C.'],
    expectedAnswers,
    submittedSerial: 'H9CGV42K01',
    expectedSerial
  });
  assert(exactResult.score >= 95, `Expected score >= 95 for exact match, got ${exactResult.score}`);
  assert.strictEqual(exactResult.passedThreshold, true);
  assert.strictEqual(exactResult.serialMatched, true);
  console.log('✓ Test 2a: Exact claim matching passed (Score: ' + exactResult.score + '%).');

  // Fuzzy match with punctuation differences and casing
  const fuzzyResult = evaluateClaim({
    submittedAnswers: ['evans pods 2024', 'mc initials'],
    expectedAnswers,
    submittedSerial: 'h9cgv42k01',
    expectedSerial
  });
  assert(fuzzyResult.score >= 80, `Expected score >= 80 for fuzzy match, got ${fuzzyResult.score}`);
  assert.strictEqual(fuzzyResult.passedThreshold, true);
  console.log('✓ Test 2b: Fuzzy claim matching passed (Score: ' + fuzzyResult.score + '%).');

  // Malicious / Random guess attempt
  const badResult = evaluateClaim({
    submittedAnswers: ['My blue headphones', 'Nothing engraved'],
    expectedAnswers,
    submittedSerial: 'RANDOM12345',
    expectedSerial
  });
  assert(badResult.score < 50, `Expected score < 50 for bad match, got ${badResult.score}`);
  assert.strictEqual(badResult.passedThreshold, false);
  console.log('✓ Test 2c: Fraudulent claim rejected (Score: ' + badResult.score + '%).');
}

// Test 3: Immutable Chain-of-Custody SHA-256 Hash Chain
{
  const genesisHash = 'GENESIS_00000000000000000000000000000000';
  const event1 = {
    previousHash: genesisHash,
    itemId: 'REC-TEST-1',
    action: 'POSTED',
    actorId: 'user-maya',
    timestamp: '2026-09-12T00:00:00.000Z',
    notes: 'Item reported found'
  };
  const hash1 = createLogHash(event1);

  const event2 = {
    previousHash: hash1,
    itemId: 'REC-TEST-1',
    action: 'CLAIM_ATTEMPTED',
    actorId: 'user-julian',
    timestamp: '2026-09-12T00:05:00.000Z',
    notes: 'Claim submitted'
  };
  const hash2 = createLogHash(event2);

  const event3 = {
    previousHash: hash2,
    itemId: 'REC-TEST-1',
    action: 'ADMIN_APPROVED',
    actorId: 'user-admin',
    timestamp: '2026-09-12T00:10:00.000Z',
    notes: 'Claim approved by officer'
  };
  const hash3 = createLogHash(event3);

  // Validate chain:
  const chain = [
    { ...event1, hash: hash1 },
    { ...event2, hash: hash2 },
    { ...event3, hash: hash3 }
  ];

  function verifyChain(logs) {
    for (let i = 1; i < logs.length; i++) {
      if (logs[i].previousHash !== logs[i - 1].hash) return false;
      const recomputed = createLogHash({
        previousHash: logs[i].previousHash,
        itemId: logs[i].itemId,
        action: logs[i].action,
        actorId: logs[i].actorId,
        timestamp: logs[i].timestamp,
        notes: logs[i].notes
      });
      if (recomputed !== logs[i].hash) return false;
    }
    return true;
  }

  assert.strictEqual(verifyChain(chain), true, 'Valid chain must pass verification');

  // Tamper simulation
  const tamperedChain = JSON.parse(JSON.stringify(chain));
  tamperedChain[1].action = 'TAMPERED_EVENT';
  assert.strictEqual(verifyChain(tamperedChain), false, 'Tampered log must be detected and fail verification');

  console.log('✓ Test 3: Immutable SHA-256 custody chain & tamper detection passed.');
}

console.log('\nAll Back2You Security & Verification Tests Passed Successfully! (3/3)');

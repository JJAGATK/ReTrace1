const assert = require('assert');

async function runE2ETest() {
  console.log('=== Running Back2You End-to-End Claim & Handover Test ===\n');

  // 1. Julian Logs In
  const loginRes = await fetch('http://localhost:5000/api/auth/login-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId: 'user-julian' })
  });
  assert.strictEqual(loginRes.status, 200);
  const julian = await loginRes.json();
  console.log('1. Authenticated Claimant:', julian.user.name, `(${julian.user.email})`);

  // 2. Julian Submits Verification Claim on AirPods (REC-8842)
  const claimRes = await fetch('http://localhost:5000/api/items/REC-8842/claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${julian.token}`
    },
    body: JSON.stringify({
      answers: ["Evan's Pods 2024", 'M.C.'],
      serial_provided: 'H9CGV42K01',
      proof_notes: 'Engraved with M.C. on reverse hinge. Bluetooth paired device name confirmed.'
    })
  });
  assert.strictEqual(claimRes.status, 200);
  const claimData = await claimRes.json();
  console.log('2. Claim Submitted:', claimData);
  assert.strictEqual(claimData.success, true);
  assert(claimData.matchScore >= 90, 'Match score should be high confidence');
  assert.strictEqual(claimData.status, 'admin_review');

  // 3. Officer Marcus (Admin) Logs In
  const adminLoginRes = await fetch('http://localhost:5000/api/auth/login-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId: 'user-admin' })
  });
  const admin = await adminLoginRes.json();
  console.log('\n3. Authenticated Campus Police Admin:', admin.user.name);

  // 4. Admin Checks Pending Claims Queue
  const claimsQueueRes = await fetch('http://localhost:5000/api/admin/claims', {
    headers: { Authorization: `Bearer ${admin.token}` }
  });
  const queueData = await claimsQueueRes.json();
  const targetClaim = queueData.claims.find(c => c.id === claimData.claimId);
  assert(targetClaim, 'Submitted claim must exist in admin queue');
  console.log('4. Admin Reviews Claim:', {
    claimId: targetClaim.id,
    claimant: targetClaim.claimant_name,
    matchScore: `${targetClaim.match_score}%`,
    submittedAnswers: targetClaim.submitted_answers,
    expectedAnswers: targetClaim.expected_answers
  });

  // 5. Admin Approves Claim & Schedules Safe Desk Handover
  const approveRes = await fetch(`http://localhost:5000/api/admin/claims/${targetClaim.id}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`
    },
    body: JSON.stringify({
      action: 'approve',
      handover_location: 'Cabot Science Library Circulation Desk',
      handover_time: 'Today until 11:00 PM (Staff ID #L-89)',
      notes: '100% serial and Bluetooth challenge match confirmed by desk officer.'
    })
  });
  assert.strictEqual(approveRes.status, 200);
  const approveData = await approveRes.json();
  console.log('5. Admin Decision:', approveData.message);

  // 6. Check Handover Record
  const handoverRes = await fetch('http://localhost:5000/api/handovers/REC-8842', {
    headers: { Authorization: `Bearer ${julian.token}` }
  });
  const handoverSession = await handoverRes.json();
  assert.strictEqual(handoverSession.handover.status, 'scheduled');
  console.log('6. Safe Handover Active:', {
    location: handoverSession.handover.location_name,
    qrToken: handoverSession.handover.qr_code_token
  });

  // 7. Dual Confirmation: Admin / Desk Officer Confirms Handover
  const confirmRes = await fetch('http://localhost:5000/api/handovers/REC-8842/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`
    }
  });
  const confirmData = await confirmRes.json();
  console.log('7. Dual Confirmation Sign-Off:', confirmData);
  assert.strictEqual(confirmData.isFullyCompleted, true);

  // 8. Verify Immutable Audit Chain
  const chainRes = await fetch('http://localhost:5000/api/items/REC-8842/custody-chain');
  const chainData = await chainRes.json();
  assert.strictEqual(chainData.isChainValid, true);
  console.log('\n8. Cryptographic Chain-of-Custody Integrity:', {
    isChainValid: chainData.isChainValid,
    totalEvents: chainData.totalEvents,
    latestEvent: chainData.logs[chainData.logs.length - 1].action,
    latestHash: chainData.logs[chainData.logs.length - 1].hash
  });

  console.log('\n✓ END-TO-END VERIFICATION FLOW SUCCEEDED 100%!');
}

runE2ETest().catch(err => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});

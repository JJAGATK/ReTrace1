const assert = require('assert');

async function runE2ETest() {
  console.log('=== Running ReTrace Comprehensive End-to-End Test ===\n');

  // 1. Julian Logs In
  const loginRes = await fetch('http://localhost:5000/api/auth/login-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId: 'user-julian' })
  });
  assert.strictEqual(loginRes.status, 200);
  const julian = await loginRes.json();
  console.log('1. Authenticated Claimant:', julian.user.name, `(${julian.user.email})`);

  // 2. Julian Toggles Bookmark on AirPods (REC-8842)
  const bookmarkRes = await fetch('http://localhost:5000/api/bookmarks/REC-8842/toggle', {
    method: 'POST',
    headers: { Authorization: `Bearer ${julian.token}` }
  });
  assert.strictEqual(bookmarkRes.status, 200);
  const bookmarkData = await bookmarkRes.json();
  console.log('2. Bookmark toggled:', bookmarkData);
  assert.strictEqual(bookmarkData.bookmarked, true);

  // 3. Julian Reports Sighting for MacBook (REC-8843)
  const sightingRes = await fetch('http://localhost:5000/api/items/REC-8843/sightings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${julian.token}`
    },
    body: JSON.stringify({
      location_clue: 'Science Center 2nd Floor Study Lounge',
      notes: 'Saw a student studying with a black MacBook around 1:45 PM.'
    })
  });
  assert.strictEqual(sightingRes.status, 201);
  const sightingData = await sightingRes.json();
  console.log('3. Sighting reported:', sightingData.message);

  // 4. Julian Submits Verification Claim on AirPods (REC-8842)
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
  console.log('4. Claim Submitted:', claimData);
  assert.strictEqual(claimData.success, true);
  assert(claimData.matchScore >= 90, 'Match score should be high confidence');
  assert.strictEqual(claimData.status, 'admin_review');

  // 5. Julian Reports Suspicious Listing Flag
  const flagRes = await fetch('http://localhost:5000/api/flags', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${julian.token}`
    },
    body: JSON.stringify({
      target_type: 'item',
      target_id: 'REC-8842',
      reason: 'spam'
    })
  });
  assert.strictEqual(flagRes.status, 201);
  const flagData = await flagRes.json();
  console.log('5. Moderation Flag Submitted:', flagData.message);

  // 6. Officer Marcus (Admin) Logs In
  const adminLoginRes = await fetch('http://localhost:5000/api/auth/login-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId: 'user-admin' })
  });
  const admin = await adminLoginRes.json();
  console.log('\n6. Authenticated Campus Police Admin:', admin.user.name);

  // 7. Admin Checks Pending Claims Queue
  const claimsQueueRes = await fetch('http://localhost:5000/api/admin/claims', {
    headers: { Authorization: `Bearer ${admin.token}` }
  });
  const queueData = await claimsQueueRes.json();
  const targetClaim = queueData.claims.find(c => c.id === claimData.claimId);
  assert(targetClaim, 'Submitted claim must exist in admin queue');
  console.log('7. Admin Reviews Claim:', {
    claimId: targetClaim.id,
    claimant: targetClaim.claimant_name,
    matchScore: `${targetClaim.match_score}%`,
    submittedAnswers: targetClaim.submitted_answers,
    expectedAnswers: targetClaim.expected_answers
  });

  // 8. Admin Approves Claim & Schedules Safe Desk Handover
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
  console.log('8. Admin Decision:', approveData.message);

  // 9. Admin Sends Chat Message in Handover Chamber
  const chatRes = await fetch('http://localhost:5000/api/handovers/REC-8842/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`
    },
    body: JSON.stringify({
      text: 'AirPods verified and locked in Cabinet B-7. Ready for claimant.'
    })
  });
  assert.strictEqual(chatRes.status, 201);
  const chatData = await chatRes.json();
  console.log('9. Handover Chat Dispatched:', chatData.message.text);

  // 10. Check Handover Record
  const handoverRes = await fetch('http://localhost:5000/api/handovers/REC-8842', {
    headers: { Authorization: `Bearer ${julian.token}` }
  });
  const handoverSession = await handoverRes.json();
  assert.strictEqual(handoverSession.handover.status, 'scheduled');
  console.log('10. Safe Handover Active:', {
    location: handoverSession.handover.location_name,
    qrToken: handoverSession.handover.qr_code_token
  });

  // 11. Dual Confirmation: Admin / Desk Officer Confirms Handover
  const confirmRes = await fetch('http://localhost:5000/api/handovers/REC-8842/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`
    }
  });
  const confirmData = await confirmRes.json();
  console.log('11. Dual Confirmation Sign-Off:', confirmData);
  assert.strictEqual(confirmData.isFullyCompleted, true);

  // 12. Verify Immutable Audit Chain
  const chainRes = await fetch('http://localhost:5000/api/items/REC-8842/custody-chain');
  const chainData = await chainRes.json();
  assert.strictEqual(chainData.isChainValid, true);
  console.log('\n12. Cryptographic Chain-of-Custody Integrity:', {
    isChainValid: chainData.isChainValid,
    totalEvents: chainData.totalEvents,
    latestEvent: chainData.logs[chainData.logs.length - 1].action,
    latestHash: chainData.logs[chainData.logs.length - 1].hash
  });

  // 13. Verify Global Category Stats
  const statsRes = await fetch('http://localhost:5000/api/stats');
  assert.strictEqual(statsRes.status, 200);
  const statsData = await statsRes.json();
  console.log('13. Live Dynamic Platform Stats:', statsData);

  console.log('\n✓ ALL RETRACE END-TO-END VERIFICATION FLOWS SUCCEEDED 100%!');
}

runE2ETest().catch(err => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});


const db = require('./db');
const { encryptPII, createLogHash, hashSecret } = require('./crypto');

function seedDatabase() {
  console.log('Seeding Back2You database with campus data...');

  // 1. Seed Users
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, role, trust_score, returns_count, campus_affiliation, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'user-maya',
    'Maya Lin',
    'maya.lin@harvard.edu',
    'student',
    100,
    14,
    'Harvard College Undergrad \'25',
    'https://lh3.googleusercontent.com/aida/AEtjO1VKdmUxVG-N5A5XZLSCGGS6rtwjUGLfaVH3Dp0s6J0SaP324w1jGNJ0D2s8k6BIldEAtdKQdNSIEwtW7-xZAXZhyLIpW2kjsdNTzscC5WRFrvvmYNILvyIwyaaNHG2Y6RBXECtF1wbgoy9N4Uhwf7RhsHJPYtE0z2DZ_0fI5XouhJcRzEUf011ylXziLJHY9Xs2KI_ttBi07vd51-KNZzTBuFs2Rl9CUzH4xXAg4aCSStxwHZ3hvRXVSzo'
  );

  insertUser.run(
    'user-julian',
    'Julian Vance',
    'julian.vance@harvard.edu',
    'student',
    98,
    4,
    'Harvard SEAS Computer Science \'26',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
  );

  insertUser.run(
    'user-admin',
    'Officer Marcus Vance',
    'm.vance@campus.harvard.edu',
    'admin',
    100,
    98,
    'Campus Police & Cabot Security Desk',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80'
  );

  // 2. Clear & Seed Items
  db.prepare('DELETE FROM custody_logs').run();
  db.prepare('DELETE FROM handovers').run();
  db.prepare('DELETE FROM claims').run();
  db.prepare('DELETE FROM challenges').run();
  db.prepare('DELETE FROM items').run();

  const insertItem = db.prepare(`
    INSERT INTO items (
      id, type, title, category, description, coarse_location, floor_room,
      latitude, longitude, exact_location_encrypted, custody_type, custody_desk_name,
      custody_status, photos_json, status, reward_offered, user_id, reporter_name,
      reporter_avatar, is_urgent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertChallenge = db.prepare(`
    INSERT INTO challenges (item_id, questions_json, secret_answers_json, intake_serial_encrypted, intake_serial_hash)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO custody_logs (item_id, actor_id, actor_name, action, notes, previous_hash, hash, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Helper to log with hash chain
  function logCustodyEvent(itemId, actorId, actorName, action, notes, timestamp = new Date().toISOString()) {
    const lastRow = db.prepare('SELECT hash FROM custody_logs WHERE item_id = ? ORDER BY id DESC LIMIT 1').get(itemId);
    const prevHash = lastRow ? lastRow.hash : 'GENESIS_HASH_000000000000000000000000000000000000000000000000000000000000';
    const hash = createLogHash({
      previousHash: prevHash,
      itemId,
      action,
      actorId,
      timestamp,
      notes
    });
    insertLog.run(itemId, actorId, actorName, action, notes, prevHash, hash, timestamp);
  }

  // ITEM 1: AirPods Pro (Found by Maya at Cabot Library)
  const item1Photos = [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAcYCa4DURCtB06gVvwtPVsYi2eLaeQH6lXND3dpajC4vi3vlgOHonBSi1B_lzWF3tQoU5bIfaf8OyHRsRjSFm-ogUAoKhr-MMRDUim8wITRtilwcH6l0-mlWXLPow4TvdpW8tJ02T43qBOA7Gmu1rjjmiDv9OVzPtjPAo3WbvcQPyCuqpRlefbtyUtUtMIeT5P5X2OHygB5eCDHmptk15WKkNEQllzo4Bd-8Mtgh05OHpRy5Ywb8nzmQ',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBuTCuoaHFpw8JiYHKU6KLekQ7_vC9eroz8AFo6pzH9-qndvtdXk3q_Bnt9iA4ZngzGMqgw_DZv9C3eOgiwUYmpz7pDSna6i2EbUBtXbJ_AYMan-j7BK7QLV1EN2RhXx7eY0ft4VoNED7u6PCgq1Z0BraaHKPtQPNOt6Tsbd19djVBzj53py7-YPhgMkG7UfoKlWqYI1FnjyxgZRj52rV_oCo0d1ap6JBOkfsyiAlZq821faSCtdiJSCA',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB0uQHcljQ3z3anExmYV-ElTXo2ihsxumnJyZ5msFncmQW09P2R3ROU_TvVcUVIaZIZzcVFQ9hxrFoOPlcvQpLWYEfg5aCNeM6D8PMtqQMbGoCJDsrG0q4nhZ6ZKXs9eS7B0jzD0YZ_uVJH207Wq_jfHKOQYHfbSjQ13ztKfWnInE9pklo752PtHzaPuaBVk66WubSidlUmNtJUeQmni7WYdtJR6Qf8CczBRmWuvv80FNYgcWhL-669UQ'
  ];

  insertItem.run(
    'REC-8842',
    'found',
    'Apple AirPods Pro (2nd Gen) in Blue Rugged Case',
    'Tech & Audio',
    'Left on Desk #34 near east window carrels. Engraved \'M.C.\' inside lid. Safe with Front Desk staff until pairing confirmation is shown.',
    'Cabot Science Library',
    '3rd Floor Carrel #42',
    42.3785,
    -71.1167,
    encryptPII('Cabot Science Library, 3rd Floor, West Carrel 42, Locker Box B-7'),
    'official_desk',
    'Cabot Circulation Desk (Staff ID: #L-89)',
    'at_desk',
    JSON.stringify(item1Photos),
    'open',
    null,
    'user-maya',
    'Maya Lin',
    'https://lh3.googleusercontent.com/aida/AEtjO1VKdmUxVG-N5A5XZLSCGGS6rtwjUGLfaVH3Dp0s6J0SaP324w1jGNJ0D2s8k6BIldEAtdKQdNSIEwtW7-xZAXZhyLIpW2kjsdNTzscC5WRFrvvmYNILvyIwyaaNHG2Y6RBXECtF1wbgoy9N4Uhwf7RhsHJPYtE0z2DZ_0fI5XouhJcRzEUf011ylXziLJHY9Xs2KI_ttBi07vd51-KNZzTBuFs2Rl9CUzH4xXAg4aCSStxwHZ3hvRXVSzo',
    0,
    new Date(Date.now() - 24 * 60 * 1000).toISOString()
  );

  insertChallenge.run(
    'REC-8842',
    JSON.stringify([
      'What specific custom Bluetooth name broadcasts when opening the lid?',
      'What color or initials are on the silicone lanyard string or case hinge?'
    ]),
    JSON.stringify([
      "Evan's Pods 2024",
      'M.C.'
    ]),
    encryptPII('H9CGV42K01'),
    hashSecret('H9CGV42K01')
  );

  logCustodyEvent('REC-8842', 'user-maya', 'Maya Lin', 'POSTED', 'Item found at 3rd Floor Carrel #42 and registered to Back2You.');
  logCustodyEvent('REC-8842', 'user-admin', 'Officer Marcus Vance', 'PHYSICAL_DEPOSIT_CONFIRMED', 'Item handed in at Cabot Circulation Desk. Sealed in Lockbox B-7.');

  // ITEM 2: MacBook Air (Lost by Julian Vance)
  const item2Photos = [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAcKjWV8IgWcnxeSw1FrdcRC0RiT3TpaV9Act-KvsIAWtVzPUBUfWLX9pi9mKYpEOWBR3VsGPrl1pLncvusIsLO2LT8r7hu0mGJnvAm7-QvBcwpGcqo5mzBOMEWlY9E-3r97qfV1XqQraG3wF3UO2mpieOnA9dtOsjgcCYLhiFW9TkffNPEjLDrogMmJ2URHWOqgWE2_cpwE_LjoknCBfdLmtSFgEbjMZuii4rcVqW-CsePe_pPrP6BPw'
  ];

  insertItem.run(
    'REC-8843',
    'lost',
    'Matte Black MacBook Air M2 (Stickers: GitHub, Figma)',
    'Tech & Audio',
    'Misplaced around 1:15 PM while getting a refill at the Union Cafe counter. Has a tiny scratch on MagSafe port edge. Desperately need this back for graduation submission!',
    'Student Union Hub',
    'Cafe Booth #4',
    42.3736,
    -71.1189,
    encryptPII('Student Union Cafe, Table 4 next to espresso station'),
    'self_custody',
    null,
    'with_finder',
    JSON.stringify(item2Photos),
    'open',
    '$50 Reward Offered',
    'user-julian',
    'Julian Vance',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    1,
    new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  );

  logCustodyEvent('REC-8843', 'user-julian', 'Julian Vance', 'POSTED', 'Lost item report broadcasted with urgent priority flag and $50 student bounty.');

  // ITEM 3: Leather Toyota Key Fob (Found)
  const item3Photos = [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDr3NRCz2v1n-WoA84ROmVfsxxeoGew2p8GM63GVNt4_-WaGcpMCzD2EKebWsiYpkSTZPM0jlc6KssIwqPHfZuIhskjATtEDCfNMxq9k2lczlCvZyUma9F384vbgo535bfUJzzZEgXkhc_YID2hwxD8YWyLCdL2jC3ZfYyOBPpKVWv9KKdDz4T6XrZknjmm5W54s3xTiULAOhXBk1wTnjXjQWZxlnFGIL3QZoh6m8y7O7Sn1VrGo6asLQ'
  ];

  insertItem.run(
    'REC-8844',
    'found',
    'Leather Toyota Key Fob & Gym Token',
    'Keys & Dorm',
    'Locker Room 102 bench. Handed directly to the gym equipment manager at Malkin Rec Center.',
    'Malkin Athletic Center',
    'Locker Room 102',
    42.3705,
    -71.1202,
    encryptPII('Malkin Athletic Center Desk 2, Bin 4'),
    'official_desk',
    'Malkin Rec Center Front Desk',
    'at_desk',
    JSON.stringify(item3Photos),
    'open',
    null,
    'user-maya',
    'Derek T.',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    0,
    new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  );

  insertChallenge.run(
    'REC-8844',
    JSON.stringify([
      'What number or color is on the plastic membership tag attached to this key ring?'
    ]),
    JSON.stringify([
      'Crimson Gym #4419'
    ]),
    encryptPII('TY-8841-K'),
    hashSecret('TY-8841-K')
  );

  logCustodyEvent('REC-8844', 'user-maya', 'Derek T.', 'POSTED', 'Found keys safely turned into Malkin Desk 2.');

  // ITEM 4: Navy Patagonia Backpack (Lost)
  const item4Photos = [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAB3Zk7D7UHkLyjyHeYK2KNW3-lYISPvG-FYJeDx_oBUmF1jtr7p2RctR6AVFBtlwHFHLfSnXOGrXl1NxkLmBuD8_3M6G6F-ok3f2uU2p6X488RKdHwh8kYHD-9WeNte6sjlUKVvt8rVikKNrVEYorXIW5Xl7ppArsokTI5m1USRsBzvFnV2suKkALAS0LRrSO5Rm31yrZcH8kOkpHJBiX4jQ6GEA6NkGwPUmb0N2XK86dTL3-08iVXlw'
  ];

  insertItem.run(
    'REC-8845',
    'lost',
    'Navy Patagonia Backpack + Steel Bottle',
    'Bags & Wallets',
    'Left under row F seats during Robotics lecture. Contains TI-84 calculator and differential equations notebook.',
    'Pierce Engineering Hall',
    'Room 210, Row F',
    42.3789,
    -71.1158,
    encryptPII('Pierce Hall 210 Under seat F12'),
    'self_custody',
    null,
    'with_finder',
    JSON.stringify(item4Photos),
    'open',
    null,
    'user-julian',
    'Sophia K.',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    1,
    new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  );

  logCustodyEvent('REC-8845', 'user-julian', 'Sophia K.', 'POSTED', 'Urgent lost backpack report logged with course roster alert.');

  // ITEM 5: Sony WH-1000XM5 Headphones (Returned - showcase)
  const item5Photos = [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB8Wswf5Q5_OaleRZkuD_pIfe3AoMlXtOICoGZ4io8GRDJ3J8af98eLn6Cfq0fm1kbg0Tg2THj2KrTrd7tQpEY7yw8cn9kOpaiG4FAdukk83RztCIG8hV9M_inVAoKSdOcFQNNB-FXJ5kt3HvbuONs4E842g3d8CibCj0nPx4QPD_88lfAhpACtmq0KE5qLmHGyLRk38YAO9o2nnCBq8gIINRn-Fr9G2G2iyfnSwmkk4SIb-CqbjTzZNQ'
  ];

  insertItem.run(
    'REC-8846',
    'found',
    'Sony WH-1000XM5 Noise Canceling Headphones',
    'Tech & Audio',
    'Matched via Bluetooth MAC address and safely returned to Elena R. at Cabot Desk.',
    'Widener Library',
    'Rotunda Lounge',
    42.3738,
    -71.1165,
    encryptPII('Widener Security Dispatch Locker 14'),
    'official_desk',
    'Widener Circulation Desk',
    'with_claimant',
    JSON.stringify(item5Photos),
    'returned',
    null,
    'user-maya',
    'Jordan K.',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    0,
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  );

  logCustodyEvent('REC-8846', 'user-maya', 'Jordan K.', 'POSTED', 'Found item entered into registry.');
  logCustodyEvent('REC-8846', 'user-admin', 'Officer Marcus Vance', 'ADMIN_APPROVED', 'Claim verified via serial match.');
  logCustodyEvent('REC-8846', 'user-admin', 'Officer Marcus Vance', 'HANDOVER_CONFIRMED', 'Dual signature and student ID confirmation completed. Item safely returned.');

  console.log('Seed completed successfully!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;

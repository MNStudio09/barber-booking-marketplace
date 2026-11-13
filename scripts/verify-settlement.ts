// Settlement verification — run with: npm run verify:settlement
// Checks the agreed money rules against the pure functions in
// lib/settlement.ts. Exits non-zero on any failure.

import {
  generateOtp,
  settleCompleted,
  settleDisputedNoShowForCustomer,
  settleNoShow,
  splitAddsUp,
} from '../lib/settlement';

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`);
  }
}

console.log('Settlement rules — verification');
console.log('─────────────────────────────────');

console.log('Completed booking (90% barber / 10% platform):');
check('Rs 1,000 completed', settleCompleted(1000), { barber: 900, platform: 100 });
check('Rs 500 completed', settleCompleted(500), { barber: 450, platform: 50 });
check('Rs 1,500 completed', settleCompleted(1500), { barber: 1350, platform: 150 });
check('Rs 2,500 completed', settleCompleted(2500), { barber: 2250, platform: 250 });

console.log('No-show (10% barber waiting / 10% platform / 80% refund):');
check('Rs 1,000 no-show', settleNoShow(1000), { barberWaiting: 100, platform: 100, customerRefund: 800 });
check('Rs 500 no-show', settleNoShow(500), { barberWaiting: 50, platform: 50, customerRefund: 400 });
check('Rs 1,500 no-show', settleNoShow(1500), { barberWaiting: 150, platform: 150, customerRefund: 1200 });

console.log('Disputed no-show resolved FOR the customer (full refund):');
check('Rs 1,000 disputed', settleDisputedNoShowForCustomer(1000), {
  customerRefund: 1000,
  barberWaiting: 0,
  platform: 0,
});

console.log('Splits always add back up to the original amount:');
for (const amount of [333, 999, 1000, 1750, 5000]) {
  const c = settleCompleted(amount);
  check(`completed Rs ${amount} adds up`, splitAddsUp([c.barber, c.platform], amount), true);
  const n = settleNoShow(amount);
  check(`no-show Rs ${amount} adds up`, splitAddsUp([n.barberWaiting, n.platform, n.customerRefund], amount), true);
}

console.log('Check-in OTP:');
const otp = generateOtp();
check('OTP is 4 digits', /^\d{4}$/.test(otp), true);

console.log('─────────────────────────────────');
if (failures > 0) {
  console.log(`${failures} check(s) FAILED.`);
  process.exit(1);
}
console.log('All settlement checks passed.');

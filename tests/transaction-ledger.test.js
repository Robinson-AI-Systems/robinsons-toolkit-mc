/**
 * Smoke Tests for Transaction Ledger — Phase 3
 * Run with: node tests/transaction-ledger.test.js
 */

import TransactionLedger from '../transaction-ledger.js';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ ${message}`);
    failCount++;
  }
}

function assertThrows(fn, expectedMessage, testName) {
  try {
    fn();
    console.error(`  ❌ ${testName} — Expected error but none thrown`);
    failCount++;
  } catch (error) {
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      console.error(`  ❌ ${testName} — Wrong error: ${error.message}`);
      failCount++;
    } else {
      console.log(`  ✅ ${testName}`);
      passCount++;
    }
  }
}

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  Transaction Ledger — Smoke Tests                          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test 1: Instantiation
console.log('Test 1: Instantiation');
const ledger = new TransactionLedger();
assert(ledger.transactions.length === 0, 'Ledger starts empty');
assert(ledger.transactionId === 0, 'Transaction ID counter starts at 0');
assert(ledger.maxTransactions === 1000, 'Default max transactions is 1000');

// Test 2: Log transaction
console.log('\nTest 2: Log transaction');
const txnId = ledger.logTransaction(
  'github_create_branch',
  { owner: 'test', repo: 'test-repo', branch: 'feature/foo' },
  'github_delete_branch',
  { owner: 'test', repo: 'test-repo', branch: 'feature/foo' }
);
assert(typeof txnId === 'string' && txnId.startsWith('txn_'), 'Transaction ID is valid');
assert(ledger.transactions.length === 1, 'Ledger has 1 transaction');
assert(ledger.transactions[0].status === 'pending', 'Initial status is pending');

// Test 3: Args deep copy isolation
console.log('\nTest 3: Args deep copy isolation');
const originalArgs = { owner: 'test', repo: 'test-repo' };
const txnId2 = ledger.logTransaction('neon_create_branch', originalArgs, 'neon_delete_branch', {});
originalArgs.owner = 'modified';
const txn = ledger.getTransaction(txnId2);
assert(txn.forward.args.owner === 'test', 'Transaction args are isolated from mutations');

// Test 4: Commit transaction
console.log('\nTest 4: Commit transaction');
const commitResult = { branchId: 'br_123', createdAt: '2026-05-19' };
ledger.commitTransaction(txnId, commitResult);
const committedTxn = ledger.getTransaction(txnId);
assert(committedTxn.status === 'committed', 'Transaction marked as committed');
assert(committedTxn.result === commitResult, 'Result stored correctly');

// Test 5: Fail transaction
console.log('\nTest 5: Fail transaction');
const txnId3 = ledger.logTransaction('vercel_deploy', {}, 'vercel_rollback', {});
const error = new Error('API rate limit exceeded');
ledger.failTransaction(txnId3, error);
const failedTxn = ledger.getTransaction(txnId3);
assert(failedTxn.status === 'failed', 'Transaction marked as failed');
assert(failedTxn.error === 'API rate limit exceeded', 'Error message stored');

// Test 6: Get committed transactions
console.log('\nTest 6: Get committed transactions');
const committed = ledger.getCommittedTransactions();
assert(committed.length === 1, 'Only 1 committed transaction exists');
assert(committed[0].id === txnId, 'Correct committed transaction returned');

// Test 7: Rollback sequence ordering (LIFO)
console.log('\nTest 7: Rollback sequence ordering (LIFO)');
const txnId4 = ledger.logTransaction('stripe_create_customer', {}, 'stripe_delete_customer', {});
ledger.commitTransaction(txnId4, {});
const txnId5 = ledger.logTransaction('clerk_create_org', {}, 'clerk_delete_org', {});
ledger.commitTransaction(txnId5, {});
const rollbackSeq = ledger.getRollbackSequence();
assert(rollbackSeq.length === 3, 'Rollback sequence has 3 committed transactions');
assert(rollbackSeq[0].id === txnId5, 'First in rollback is most recent (LIFO)');
assert(rollbackSeq[2].id === txnId, 'Last in rollback is oldest');

// Test 8: Mark rollback
console.log('\nTest 8: Mark rollback');
ledger.markRollback(txnId, { deletedAt: '2026-05-19' });
const rolledBackTxn = ledger.getTransaction(txnId);
assert(rolledBackTxn.status === 'rolled_back', 'Transaction marked as rolled_back');
assert(rolledBackTxn.rollbackAttempted === true, 'Rollback attempt tracked');

// Test 9: Error handling - invalid transaction ID
console.log('\nTest 9: Error handling');
assertThrows(
  () => ledger.commitTransaction('invalid_id', {}),
  'not found',
  'Commit invalid transaction throws error'
);
assertThrows(
  () => ledger.markRollback('invalid_id', {}),
  'not found',
  'Rollback invalid transaction throws error'
);

// Test 10: Error handling - rollback non-committed
console.log('\nTest 10: Rollback state validation');
assertThrows(
  () => ledger.markRollback(txnId3, {}),
  'Cannot rollback',
  'Cannot rollback failed transaction'
);

// Test 11: Get summary
console.log('\nTest 11: Get summary');
const summary = ledger.getSummary();
assert(summary.totalTransactions === 5, 'Summary shows correct total');
assert(summary.statusBreakdown.committed === 2, 'Summary shows 2 committed');
assert(summary.statusBreakdown.failed === 1, 'Summary shows 1 failed');
assert(summary.statusBreakdown.rolled_back === 1, 'Summary shows 1 rolled_back');
assert(summary.statusBreakdown.pending === 1, 'Summary shows 1 pending');

// Test 12: Clear ledger
console.log('\nTest 12: Clear ledger');
const clearResult = ledger.clear();
assert(clearResult.cleared === 5, 'Clear returns count of cleared transactions');
assert(ledger.transactions.length === 0, 'Ledger is empty after clear');

// Test 13: Export audit trail
console.log('\nTest 13: Export audit trail');
const ledger2 = new TransactionLedger();
ledger2.logTransaction('github_create_branch', { branch: 'test' }, 'github_delete_branch', {});
ledger2.commitTransaction(ledger2.transactions[0].id, { result: 'success' });
const audit = ledger2.exportAuditTrail();
assert(audit.exportTime !== null, 'Audit trail has export timestamp');
assert(audit.summary !== null, 'Audit trail has summary');
assert(audit.transactions.length === 1, 'Audit trail has transaction entry');
assert(audit.transactions[0].hasResult === true, 'Audit entry shows result exists');

// Test 14: Custom options
console.log('\nTest 14: Custom options');
const customLedger = new TransactionLedger({
  maxTransactions: 100,
  persistPath: '/tmp/custom-ledger.json',
});
assert(customLedger.maxTransactions === 100, 'Custom max transactions honored');
assert(customLedger.persistPath === '/tmp/custom-ledger.json', 'Custom persist path honored');

// Summary
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log(`║  Results: ${passCount} passed, ${failCount} failed                          ║`);
console.log('╚════════════════════════════════════════════════════════════╝\n');

process.exit(failCount > 0 ? 1 : 0);

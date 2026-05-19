/**
 * Transaction Ledger System — Phase 3
 * 
 * Provides deterministic transaction logging and rollback capability
 * for all state-mutating tools in Robinson's Toolkit.
 * 
 * Key features:
 * - Atomic transaction wrapping (forward + inverse operations)
 * - Transaction state tracking (pending, committed, failed, rolled_back)
 * - Ledger snapshots for crash recovery
 * - Automatic inverse operation discovery
 * - Optional persistence to disk
 */

import { promises as fs } from 'fs';
import { join } from 'path';

class TransactionLedger {
  constructor(options = {}) {
    this.transactions = [];
    this.transactionId = 0;
    this.persistPath = options.persistPath || './ledger-backup.json';
    this.enablePersistence = options.enablePersistence ?? false;
    this.maxTransactions = options.maxTransactions || 1000;
  }

  /**
   * Generate a unique transaction ID
   */
  _nextTransactionId() {
    return `txn_${Date.now()}_${++this.transactionId}`;
  }

  /**
   * Create a new transaction entry
   */
  _createTransaction(toolName, args, inverseToolName, inverseArgs) {
    return {
      id: this._nextTransactionId(),
      timestamp: new Date().toISOString(),
      forward: {
        tool: toolName,
        args: JSON.parse(JSON.stringify(args)), // Deep copy
      },
      inverse: {
        tool: inverseToolName,
        args: JSON.parse(JSON.stringify(inverseArgs)),
      },
      status: 'pending', // pending, committed, failed, rolled_back
      result: null,
      error: null,
      rollbackAttempted: false,
      rollbackResult: null,
    };
  }

  /**
   * Log a transaction that will be executed
   * Returns transaction ID for reference
   */
  logTransaction(toolName, args, inverseToolName, inverseArgs) {
    const txn = this._createTransaction(toolName, args, inverseToolName, inverseArgs);
    this.transactions.push(txn);
    
    // Trim if exceeds max
    if (this.transactions.length > this.maxTransactions) {
      this.transactions = this.transactions.slice(-this.maxTransactions);
    }

    return txn.id;
  }

  /**
   * Mark a transaction as committed (forward operation succeeded)
   */
  commitTransaction(transactionId, result) {
    const txn = this.transactions.find(t => t.id === transactionId);
    if (!txn) {
      throw new Error(`Transaction ${transactionId} not found in ledger`);
    }
    txn.status = 'committed';
    txn.result = result;
    return txn;
  }

  /**
   * Mark a transaction as failed
   */
  failTransaction(transactionId, error) {
    const txn = this.transactions.find(t => t.id === transactionId);
    if (!txn) {
      throw new Error(`Transaction ${transactionId} not found in ledger`);
    }
    txn.status = 'failed';
    txn.error = error instanceof Error ? error.message : String(error);
    return txn;
  }

  /**
   * Get all committed transactions (candidates for rollback)
   */
  getCommittedTransactions() {
    return this.transactions.filter(t => t.status === 'committed');
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId) {
    return this.transactions.find(t => t.id === transactionId);
  }

  /**
   * Get all transactions (for audit/inspection)
   */
  getAllTransactions() {
    return [...this.transactions];
  }

  /**
   * Rollback a specific transaction by ID
   * Returns rollback operation details
   */
  markRollback(transactionId, rollbackResult) {
    const txn = this.transactions.find(t => t.id === transactionId);
    if (!txn) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    if (txn.status !== 'committed') {
      throw new Error(`Cannot rollback transaction in state: ${txn.status}`);
    }
    txn.status = 'rolled_back';
    txn.rollbackAttempted = true;
    txn.rollbackResult = rollbackResult;
    return txn;
  }

  /**
   * Get the order of transactions to rollback (reverse chronological)
   * This ensures LIFO (Last In, First Out) rollback order
   */
  getRollbackSequence(fromIndex = null) {
    const committed = this.getCommittedTransactions();
    if (fromIndex !== null) {
      return committed.slice(fromIndex).reverse();
    }
    return committed.reverse();
  }

  /**
   * Clear all transactions
   * WARNING: This is destructive. Use with caution.
   */
  clear() {
    const count = this.transactions.length;
    this.transactions = [];
    return { cleared: count };
  }

  /**
   * Generate a ledger summary for debugging
   */
  getSummary() {
    const statuses = {};
    for (const txn of this.transactions) {
      statuses[txn.status] = (statuses[txn.status] || 0) + 1;
    }
    return {
      totalTransactions: this.transactions.length,
      statusBreakdown: statuses,
      committed: this.getCommittedTransactions().length,
      failed: this.transactions.filter(t => t.status === 'failed').length,
      rolledBack: this.transactions.filter(t => t.status === 'rolled_back').length,
      pendingTransactions: this.transactions.filter(t => t.status === 'pending'),
    };
  }

  /**
   * Save ledger to disk for crash recovery
   */
  async persist() {
    if (!this.enablePersistence) return;
    try {
      await fs.writeFile(
        this.persistPath,
        JSON.stringify({
          transactions: this.transactions,
          timestamp: new Date().toISOString(),
        }, null, 2)
      );
    } catch (error) {
      console.error(`Failed to persist ledger: ${error.message}`);
    }
  }

  /**
   * Load ledger from disk after crash
   */
  async restore() {
    if (!this.enablePersistence) return;
    try {
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.transactions = parsed.transactions || [];
      return { restored: this.transactions.length };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Failed to restore ledger: ${error.message}`);
      }
      return { restored: 0 };
    }
  }

  /**
   * Export ledger as audit trail
   */
  exportAuditTrail() {
    return {
      exportTime: new Date().toISOString(),
      summary: this.getSummary(),
      transactions: this.transactions.map(txn => ({
        id: txn.id,
        timestamp: txn.timestamp,
        forward: txn.forward.tool,
        inverse: txn.inverse.tool,
        status: txn.status,
        hasResult: !!txn.result,
        hasError: !!txn.error,
        rolledBack: txn.rollbackAttempted,
      })),
    };
  }
}

export default TransactionLedger;

/**
 * Inverse Operations Map — Phase 3
 * 
 * Defines the reverse operation for each state-mutating tool.
 * Used by the transaction ledger to ensure rollback capability.
 * 
 * Format: forward_tool → { inverse_tool, argMapping }
 * argMapping: function that transforms forward args to inverse args
 */

export const INVERSE_OPERATIONS = {
  // GitHub Operations
  github_create_branch: {
    inverse: 'github_delete_branch',
    argMapping: (args) => ({
      owner: args.owner,
      repo: args.repo,
      branch: args.branch,
    }),
  },
  github_delete_branch: {
    inverse: 'github_create_branch',
    argMapping: (args) => ({
      owner: args.owner,
      repo: args.repo,
      branch: args.branch,
      from_branch: 'main', // Default recovery point
    }),
  },
  github_create_pull_request: {
    inverse: 'github_close_pull_request',
    argMapping: (args) => ({
      owner: args.owner,
      repo: args.repo,
      pull_number: args.pull_number || 'TBD', // Will be filled from result
    }),
  },
  github_merge_pull_request: {
    inverse: 'github_revert_commit', // Revert the merge commit
    argMapping: (args) => ({
      owner: args.owner,
      repo: args.repo,
      sha: 'TBD', // Will be filled from result (merge commit SHA)
    }),
  },

  // Neon Database Operations
  neon_create_branch: {
    inverse: 'neon_delete_branch',
    argMapping: (args) => ({
      project_id: args.project_id,
      branch_id: args.branch_id || 'TBD', // Will be filled from result
    }),
  },
  neon_delete_branch: {
    inverse: 'neon_create_branch', // Cannot truly restore, but documents intent
    argMapping: (args) => ({
      project_id: args.project_id,
      branch_name: `restored_${args.branch_id}`,
      parent_id: 'main', // Restore from main
    }),
  },
  neon_run_sql: {
    inverse: null, // SQL operations are not easily reversible without transaction context
    argMapping: null,
  },

  // Vercel Deployments
  vercel_create_deployment: {
    inverse: 'vercel_rollback_deployment',
    argMapping: (args) => ({
      projectId: args.projectId,
      deploymentId: 'TBD', // Will be filled from result
    }),
  },
  vercel_promote_deployment: {
    inverse: 'vercel_promote_deployment', // Promote previous production
    argMapping: (args) => ({
      projectId: args.projectId,
      deploymentId: 'TBD', // Will be filled from previous prod deployment
    }),
  },

  // Stripe Operations
  stripe_create_customer: {
    inverse: 'stripe_delete_customer',
    argMapping: (args) => ({
      customer_id: args.customer_id || 'TBD', // Will be filled from result
    }),
  },
  stripe_create_subscription: {
    inverse: 'stripe_cancel_subscription',
    argMapping: (args) => ({
      subscription_id: args.subscription_id || 'TBD', // Will be filled from result
    }),
  },
  stripe_cancel_subscription: {
    inverse: 'stripe_create_subscription', // Cannot truly restore, documents intent
    argMapping: (args) => ({
      customer_id: args.customer_id,
      price_id: 'TBD', // Will need to be recovered from previous state
    }),
  },
  stripe_charge_customer: {
    inverse: 'stripe_refund_charge',
    argMapping: (args) => ({
      charge_id: 'TBD', // Will be filled from result
      amount: args.amount,
      reason: 'requested_by_customer',
    }),
  },

  // Twilio Operations
  twilio_send_sms: {
    inverse: null, // SMS cannot be "unsent" but could log for audit
    argMapping: null,
  },
  twilio_make_call: {
    inverse: 'twilio_cancel_call',
    argMapping: (args) => ({
      call_sid: 'TBD', // Will be filled from result
    }),
  },

  // Clerk Operations
  clerk_create_user: {
    inverse: 'clerk_delete_user',
    argMapping: (args) => ({
      user_id: args.user_id || 'TBD', // Will be filled from result
    }),
  },
  clerk_create_organization: {
    inverse: 'clerk_delete_organization',
    argMapping: (args) => ({
      organization_id: args.organization_id || 'TBD', // Will be filled from result
    }),
  },

  // Local File Operations
  local_write_file: {
    inverse: 'local_delete_file',
    argMapping: (args) => ({
      path: args.path,
    }),
  },
  local_delete_file: {
    inverse: null, // Cannot restore deleted files without backup
    argMapping: null,
  },

  // Supabase Operations
  supabase_create_user: {
    inverse: 'supabase_delete_user',
    argMapping: (args) => ({
      user_id: args.user_id || 'TBD',
    }),
  },

  // Compound Super Tools
  compound_scaffold_feature: {
    inverse: 'compound_teardown_feature',
    argMapping: (args) => ({
      github_owner: args.github_owner,
      github_repo: args.github_repo,
      feature_name: args.feature_name,
      neon_project_id: args.neon_project_id,
    }),
  },
  compound_provision_tenant: {
    inverse: 'compound_offboard_tenant',
    argMapping: (args) => ({
      tenant_id: args.tenant_id || 'TBD',
      stripe_customer_id: 'TBD',
      clerk_org_id: 'TBD',
    }),
  },
};

/**
 * Utility function to get inverse operation for a tool
 */
export function getInverseOperation(toolName) {
  const mapping = INVERSE_OPERATIONS[toolName];
  if (!mapping) {
    return null;
  }
  return {
    tool: mapping.inverse,
    mapArgs: mapping.argMapping,
    isReversible: mapping.inverse !== null && mapping.argMapping !== null,
  };
}

/**
 * Utility function to map arguments from forward to inverse
 */
export function mapArgsToInverse(toolName, forwardArgs, executionResult = null) {
  const mapping = INVERSE_OPERATIONS[toolName];
  if (!mapping || !mapping.argMapping) {
    return null;
  }

  const inverseArgs = mapping.argMapping(forwardArgs);

  // Fill in TBD placeholders from execution result if available
  if (executionResult) {
    for (const [key, value] of Object.entries(inverseArgs)) {
      if (value === 'TBD' && executionResult[key]) {
        inverseArgs[key] = executionResult[key];
      }
    }
  }

  return inverseArgs;
}

/**
 * Check if a tool is safely reversible
 */
export function isReversible(toolName) {
  const op = getInverseOperation(toolName);
  return op && op.isReversible;
}

export default {
  INVERSE_OPERATIONS,
  getInverseOperation,
  mapArgsToInverse,
  isReversible,
};

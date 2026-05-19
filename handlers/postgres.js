/**
 * Postgres Handler — 12 tools
 * Direct SQL execution against any PostgreSQL database.
 * Uses the DATABASE_URL / POSTGRES_CONNECTION_STRING env var.
 * Falls back to Neon's HTTP SQL API if a neon.tech host is detected.
 */

import { execSync } from 'child_process';

function getConnectionString(override) {
  const conn = override || process.env.POSTGRES_CONNECTION_STRING || process.env.DATABASE_URL;
  if (!conn) throw new Error('POSTGRES_CONNECTION_STRING or DATABASE_URL not set in .env');
  return conn;
}

function isNeonHost(connStr) {
  return connStr.includes('.neon.tech');
}

async function runViaNeonHttp(sql, connStr) {
  // Extract host from connection string
  const match = connStr.match(/@([^\/]+)\//);
  if (!match) throw new Error('Could not parse host from connection string');
  const host = match[1];
  const res = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connStr },
    body: JSON.stringify({ query: sql })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`SQL error: ${data.message || JSON.stringify(data)}`);
  return data;
}

function runViaPsql(sql, connStr) {
  try {
    const result = execSync(`psql "${connStr}" -c "${sql.replace(/"/g, '\\"')}" --csv --tuples-only 2>&1`, { timeout: 30000, encoding: 'utf8' });
    return { output: result, note: 'Executed via psql CLI' };
  } catch (e) {
    throw new Error(`psql execution failed: ${e.message}. Install psql or use a Neon/Supabase database with HTTP SQL support.`);
  }
}

async function runSQL(sql, connStr) {
  if (isNeonHost(connStr)) return await runViaNeonHttp(sql, connStr);
  return runViaPsql(sql, connStr);
}

async function execute(tool, args) {
  const conn = getConnectionString(args.connection_string);

  // ── QUERY EXECUTION ───────────────────────────────────────────────────────
  if (tool === 'postgres_run_sql') {
    const { sql } = args;
    if (!sql) throw new Error('sql is required');
    return await runSQL(sql, conn);
  }
  if (tool === 'postgres_run_transaction') {
    const { statements } = args;
    if (!statements || !Array.isArray(statements)) throw new Error('statements array is required');
    return await runSQL(`BEGIN;\n${statements.join(';\n')};\nCOMMIT;`, conn);
  }

  // ── SCHEMA INSPECTION ─────────────────────────────────────────────────────
  if (tool === 'postgres_list_tables') {
    return await runSQL(`SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;`, conn);
  }
  if (tool === 'postgres_describe_table') {
    const { table_name, schema = 'public' } = args;
    return await runSQL(`SELECT column_name, data_type, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_name='${table_name}' AND table_schema='${schema}' ORDER BY ordinal_position;`, conn);
  }
  if (tool === 'postgres_list_indexes') {
    return await runSQL(`SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname='${args.schema || 'public'}' ORDER BY tablename, indexname;`, conn);
  }
  if (tool === 'postgres_list_functions') {
    return await runSQL(`SELECT routine_name, routine_type, data_type FROM information_schema.routines WHERE routine_schema='${args.schema || 'public'}' ORDER BY routine_name;`, conn);
  }
  if (tool === 'postgres_get_table_row_count') {
    return await runSQL(`SELECT relname as table, n_live_tup as approx_rows FROM pg_stat_user_tables WHERE schemaname='${args.schema || 'public'}' ORDER BY n_live_tup DESC;`, conn);
  }

  // ── PERFORMANCE ───────────────────────────────────────────────────────────
  if (tool === 'postgres_list_slow_queries') {
    return await runSQL(`SELECT query, calls, mean_exec_time::int as avg_ms, total_exec_time::int as total_ms, rows FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT ${args.limit || 20};`, conn);
  }
  if (tool === 'postgres_explain_query') {
    return await runSQL(`EXPLAIN ANALYZE ${args.sql}`, conn);
  }
  if (tool === 'postgres_get_active_connections') {
    return await runSQL(`SELECT pid, usename, application_name, state, LEFT(query,200) as query FROM pg_stat_activity WHERE state != 'idle' ORDER BY state;`, conn);
  }
  if (tool === 'postgres_kill_query') {
    return await runSQL(`SELECT pg_terminate_backend(${args.pid});`, conn);
  }

  // ── DATABASE INFO ─────────────────────────────────────────────────────────
  if (tool === 'postgres_get_database_size') {
    return await runSQL(`SELECT current_database() as database, pg_size_pretty(pg_database_size(current_database())) as size, version();`, conn);
  }

  throw new Error(`Unknown postgres tool: ${tool}`);
}

export default { execute };

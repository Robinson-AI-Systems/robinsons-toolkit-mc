/**
 * Upstash Handler — 157 tools
 * Full Upstash Redis REST API: all Redis commands plus database management.
 * Uses Upstash REST API — no Redis client needed, works over HTTPS.
 */

function getRestCreds() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in .env');
  return { url, token };
}

function getMgmtCreds() {
  const key = process.env.UPSTASH_API_KEY;
  const email = process.env.UPSTASH_EMAIL;
  if (!key || !email) throw new Error('UPSTASH_API_KEY and UPSTASH_EMAIL must be set in .env for management tools');
  return { key, email };
}

// Execute a Redis command via Upstash REST API
async function redis(command, args = [], overrideUrl, overrideToken) {
  const { url, token } = overrideUrl ? { url: overrideUrl, token: overrideToken } : getRestCreds();
  const res = await fetch(`${url}/${[command, ...args].map(a => encodeURIComponent(String(a))).join('/')}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.error) throw new Error(`Redis error: ${data.error}`);
  return data.result;
}

// Management API (for database-level operations)
async function mgmt(method, path, body) {
  const { key, email } = getMgmtCreds();
  const res = await fetch(`https://api.upstash.com${path}`, {
    method,
    headers: { Authorization: `Basic ${Buffer.from(`${email}:${key}`).toString('base64')}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`Upstash API ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function qstashToken() {
  const t = process.env.UPSTASH_QSTASH_TOKEN;
  if (!t) throw new Error("UPSTASH_QSTASH_TOKEN not set in .env");
  return t;
}

async function qstash(method, path, body) {
  const res = await fetch(`https://qstash.upstash.io${path}`, {
    method,
    headers: { Authorization: `Bearer ${qstashToken()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return { success: true };
  const data = await res.json();
  if (!res.ok) throw new Error(`QStash ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function execute(tool, args) {
  const { key, keys, value, ttl, pattern, field, member, score, database_id } = args;

  // ── DATABASE MANAGEMENT ───────────────────────────────────────────────────
  if (tool === 'upstash_list_redis_databases') { return await mgmt('GET', '/v2/redis/databases'); }
  if (tool === 'upstash_get_redis_database') { return await mgmt('GET', `/v2/redis/database/${database_id}`); }
  if (tool === 'upstash_create_redis_database') {
    return await mgmt('POST', '/v2/redis/database', { name:args.name, region:args.region||'us-east-1', tls:args.tls!==false });
  }
  if (tool === 'upstash_delete_redis_database') { return await mgmt('DELETE', `/v2/redis/database/${database_id}`); }
  if (tool === 'upstash_rename_redis_database') { return await mgmt('POST', `/v2/redis/database/${database_id}/rename`, { name:args.name }); }
  if (tool === 'upstash_reset_redis_password') { return await mgmt('POST', `/v2/redis/database/${database_id}/reset-password`); }
  if (tool === 'upstash_enable_redis_eviction') { return await mgmt('POST', `/v2/redis/database/${database_id}/enable-eviction`); }
  if (tool === 'upstash_disable_redis_eviction') { return await mgmt('POST', `/v2/redis/database/${database_id}/disable-eviction`); }
  if (tool === 'upstash_enable_redis_tls') { return await mgmt('POST', `/v2/redis/database/${database_id}/enable-tls`); }
  if (tool === 'upstash_disable_redis_tls') { return await mgmt('POST', `/v2/redis/database/${database_id}/disable-tls`); }
  if (tool === 'upstash_get_redis_stats') { return await mgmt('GET', `/v2/redis/database/${database_id}/stats`); }
  if (tool === 'upstash_get_redis_usage') { return await mgmt('GET', `/v2/redis/database/${database_id}/usage`); }
  if (tool === 'upstash_backup_redis_database') { return await mgmt('POST', `/v2/redis/database/${database_id}/backup`); }
  if (tool === 'upstash_restore_redis_database') { return await mgmt('POST', `/v2/redis/database/${database_id}/restore`, { backup_id: args.backup_id }); }
  if (tool === 'upstash_update_redis_database') { return await mgmt('POST', `/v2/redis/database/${database_id}/update`, { name:args.name }); }
  if (tool === 'upstash_list_teams') { return await mgmt('GET', '/v2/teams'); }
  if (tool === 'upstash_get_team') { return await mgmt('GET', `/v2/teams/${args.team_id}`); }
  if (tool === 'upstash_create_team') { return await mgmt('POST', '/v2/teams', { name:args.name, copy_cc:args.copy_cc||false }); }
  if (tool === 'upstash_delete_team') { return await mgmt('DELETE', `/v2/teams/${args.team_id}`); }
  if (tool === 'upstash_add_team_member') { return await mgmt('POST', `/v2/teams/${args.team_id}/member`, { member_email:args.email, member_role:args.role||'member' }); }
  if (tool === 'upstash_remove_team_member') { return await mgmt('DELETE', `/v2/teams/${args.team_id}/member/${args.member_email}`); }

  // From here: all Redis data commands
  const url = args.rest_url;
  const token = args.rest_token;

  // ── STRING COMMANDS ────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_get') { return await redis('GET', [key], url, token); }
  if (tool === 'upstash_redis_set') {
    const cmd = ['SET', key, value];
    if (ttl) { cmd.push('EX'); cmd.push(ttl); }
    if (args.nx) cmd.push('NX');
    if (args.xx) cmd.push('XX');
    return await redis(cmd[0], cmd.slice(1), url, token);
  }
  if (tool === 'upstash_redis_mget') { return await redis('MGET', keys, url, token); }
  if (tool === 'upstash_redis_mset') {
    const pairs = [];
    for (const [k, v] of Object.entries(args.pairs||{})) { pairs.push(k, v); }
    return await redis('MSET', pairs, url, token);
  }
  if (tool === 'upstash_redis_del') { return await redis('DEL', Array.isArray(key) ? key : [key], url, token); }
  if (tool === 'upstash_redis_exists') { return await redis('EXISTS', Array.isArray(key) ? key : [key], url, token); }
  if (tool === 'upstash_redis_incr') { return await redis('INCR', [key], url, token); }
  if (tool === 'upstash_redis_decr') { return await redis('DECR', [key], url, token); }
  if (tool === 'upstash_redis_incrby') { return await redis('INCRBY', [key, args.amount], url, token); }
  if (tool === 'upstash_redis_decrby') { return await redis('DECRBY', [key, args.amount], url, token); }
  if (tool === 'upstash_redis_incrbyfloat') { return await redis('INCRBYFLOAT', [key, args.amount], url, token); }
  if (tool === 'upstash_redis_append') { return await redis('APPEND', [key, value], url, token); }
  if (tool === 'upstash_redis_getrange') { return await redis('GETRANGE', [key, args.start, args.end], url, token); }
  if (tool === 'upstash_redis_setrange') { return await redis('SETRANGE', [key, args.offset, value], url, token); }
  if (tool === 'upstash_redis_strlen') { return await redis('STRLEN', [key], url, token); }
  if (tool === 'upstash_redis_getset') { return await redis('GETSET', [key, value], url, token); }
  if (tool === 'upstash_redis_setnx') { return await redis('SETNX', [key, value], url, token); }
  if (tool === 'upstash_redis_setex') { return await redis('SETEX', [key, args.seconds, value], url, token); }
  if (tool === 'upstash_redis_psetex') { return await redis('PSETEX', [key, args.milliseconds, value], url, token); }

  // ── EXPIRY ─────────────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_expire') { return await redis('EXPIRE', [key, args.seconds], url, token); }
  if (tool === 'upstash_redis_expireat') { return await redis('EXPIREAT', [key, args.timestamp], url, token); }
  if (tool === 'upstash_redis_ttl') { return await redis('TTL', [key], url, token); }
  if (tool === 'upstash_redis_pttl') { return await redis('PTTL', [key], url, token); }
  if (tool === 'upstash_redis_persist') { return await redis('PERSIST', [key], url, token); }

  // ── KEY OPERATIONS ─────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_keys') { return await redis('KEYS', [pattern||'*'], url, token); }
  if (tool === 'upstash_redis_scan') { return await redis('SCAN', [args.cursor||0, 'MATCH', pattern||'*', 'COUNT', args.count||10], url, token); }
  if (tool === 'upstash_redis_type') { return await redis('TYPE', [key], url, token); }
  if (tool === 'upstash_redis_rename') { return await redis('RENAME', [key, args.new_key], url, token); }
  if (tool === 'upstash_redis_dbsize') { return await redis('DBSIZE', [], url, token); }
  if (tool === 'upstash_redis_flushdb') { return await redis('FLUSHDB', [], url, token); }
  if (tool === 'upstash_redis_flushall') { return await redis('FLUSHALL', [], url, token); }
  if (tool === 'upstash_redis_ping') { return await redis('PING', [], url, token); }
  if (tool === 'upstash_redis_echo') { return await redis('ECHO', [args.message], url, token); }
  if (tool === 'upstash_redis_info') { return await redis('INFO', args.section ? [args.section] : [], url, token); }
  if (tool === 'upstash_redis_time') { return await redis('TIME', [], url, token); }
  if (tool === 'upstash_redis_save') { return await redis('BGSAVE', [], url, token); }
  if (tool === 'upstash_redis_bgsave') { return await redis('BGSAVE', [], url, token); }

  // ── HASH COMMANDS ──────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_hset') { return await redis('HSET', [key, field, value], url, token); }
  if (tool === 'upstash_redis_hget') { return await redis('HGET', [key, field], url, token); }
  if (tool === 'upstash_redis_hgetall') { return await redis('HGETALL', [key], url, token); }
  if (tool === 'upstash_redis_hdel') { return await redis('HDEL', [key, ...(Array.isArray(field)?field:[field])], url, token); }
  if (tool === 'upstash_redis_hexists') { return await redis('HEXISTS', [key, field], url, token); }
  if (tool === 'upstash_redis_hkeys') { return await redis('HKEYS', [key], url, token); }
  if (tool === 'upstash_redis_hvals') { return await redis('HVALS', [key], url, token); }
  if (tool === 'upstash_redis_hlen') { return await redis('HLEN', [key], url, token); }
  if (tool === 'upstash_redis_hincrby') { return await redis('HINCRBY', [key, field, args.amount], url, token); }
  if (tool === 'upstash_redis_hincrbyfloat') { return await redis('HINCRBYFLOAT', [key, field, args.amount], url, token); }
  if (tool === 'upstash_redis_hmget') { return await redis('HMGET', [key, ...args.fields], url, token); }
  if (tool === 'upstash_redis_hmset') {
    const pairs = [];
    for (const [f, v] of Object.entries(args.fields_values||{})) { pairs.push(f, v); }
    return await redis('HMSET', [key, ...pairs], url, token);
  }
  if (tool === 'upstash_redis_hsetnx') { return await redis('HSETNX', [key, field, value], url, token); }
  if (tool === 'upstash_redis_hstrlen') { return await redis('HSTRLEN', [key, field], url, token); }
  if (tool === 'upstash_redis_hscan') { return await redis('HSCAN', [key, args.cursor||0, 'MATCH', pattern||'*', 'COUNT', args.count||10], url, token); }

  // ── LIST COMMANDS ──────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_lpush') { return await redis('LPUSH', [key, ...(Array.isArray(value)?value:[value])], url, token); }
  if (tool === 'upstash_redis_rpush') { return await redis('RPUSH', [key, ...(Array.isArray(value)?value:[value])], url, token); }
  if (tool === 'upstash_redis_lpop') { return await redis('LPOP', [key], url, token); }
  if (tool === 'upstash_redis_rpop') { return await redis('RPOP', [key], url, token); }
  if (tool === 'upstash_redis_lrange') { return await redis('LRANGE', [key, args.start||0, args.stop||-1], url, token); }
  if (tool === 'upstash_redis_llen') { return await redis('LLEN', [key], url, token); }
  if (tool === 'upstash_redis_lindex') { return await redis('LINDEX', [key, args.index], url, token); }
  if (tool === 'upstash_redis_lset') { return await redis('LSET', [key, args.index, value], url, token); }
  if (tool === 'upstash_redis_lrem') { return await redis('LREM', [key, args.count||0, value], url, token); }
  if (tool === 'upstash_redis_ltrim') { return await redis('LTRIM', [key, args.start, args.stop], url, token); }
  if (tool === 'upstash_redis_linsert') { return await redis('LINSERT', [key, args.position||'BEFORE', args.pivot, value], url, token); }
  if (tool === 'upstash_redis_rpoplpush') { return await redis('RPOPLPUSH', [key, args.destination], url, token); }
  if (tool === 'upstash_redis_lpos') { return await redis('LPOS', [key, value], url, token); }
  if (tool === 'upstash_redis_lmove') { return await redis('LMOVE', [key, args.destination, args.wherefrom||'LEFT', args.whereto||'RIGHT'], url, token); }

  // ── SET COMMANDS ───────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_sadd') { return await redis('SADD', [key, ...(Array.isArray(member)?member:[member])], url, token); }
  if (tool === 'upstash_redis_smembers') { return await redis('SMEMBERS', [key], url, token); }
  if (tool === 'upstash_redis_srem') { return await redis('SREM', [key, ...(Array.isArray(member)?member:[member])], url, token); }
  if (tool === 'upstash_redis_sismember') { return await redis('SISMEMBER', [key, member], url, token); }
  if (tool === 'upstash_redis_scard') { return await redis('SCARD', [key], url, token); }
  if (tool === 'upstash_redis_spop') { return await redis('SPOP', [key], url, token); }
  if (tool === 'upstash_redis_srandmember') { return await redis('SRANDMEMBER', [key, args.count||1], url, token); }
  if (tool === 'upstash_redis_smove') { return await redis('SMOVE', [key, args.destination, member], url, token); }
  if (tool === 'upstash_redis_sunion') { return await redis('SUNION', Array.isArray(args.keys)?args.keys:[key], url, token); }
  if (tool === 'upstash_redis_sinter') { return await redis('SINTER', Array.isArray(args.keys)?args.keys:[key], url, token); }
  if (tool === 'upstash_redis_sdiff') { return await redis('SDIFF', Array.isArray(args.keys)?args.keys:[key], url, token); }
  if (tool === 'upstash_redis_sunionstore') { return await redis('SUNIONSTORE', [args.destination, ...(Array.isArray(args.keys)?args.keys:[key])], url, token); }
  if (tool === 'upstash_redis_sinterstore') { return await redis('SINTERSTORE', [args.destination, ...(Array.isArray(args.keys)?args.keys:[key])], url, token); }
  if (tool === 'upstash_redis_sdiffstore') { return await redis('SDIFFSTORE', [args.destination, ...(Array.isArray(args.keys)?args.keys:[key])], url, token); }
  if (tool === 'upstash_redis_sscan') { return await redis('SSCAN', [key, args.cursor||0, 'MATCH', pattern||'*', 'COUNT', args.count||10], url, token); }

  // ── SORTED SET COMMANDS ────────────────────────────────────────────────────
  if (tool === 'upstash_redis_zadd') { return await redis('ZADD', [key, score, member], url, token); }
  if (tool === 'upstash_redis_zrange') { return await redis('ZRANGE', [key, args.start||0, args.stop||-1, ...(args.withscores ? ['WITHSCORES'] : [])], url, token); }
  if (tool === 'upstash_redis_zrem') { return await redis('ZREM', [key, ...(Array.isArray(member)?member:[member])], url, token); }
  if (tool === 'upstash_redis_zscore') { return await redis('ZSCORE', [key, member], url, token); }
  if (tool === 'upstash_redis_zcard') { return await redis('ZCARD', [key], url, token); }
  if (tool === 'upstash_redis_zrank') { return await redis('ZRANK', [key, member], url, token); }
  if (tool === 'upstash_redis_zrevrank') { return await redis('ZREVRANK', [key, member], url, token); }
  if (tool === 'upstash_redis_zrangebyscore') { return await redis('ZRANGEBYSCORE', [key, args.min||'-inf', args.max||'+inf', 'LIMIT', args.offset||0, args.count||10], url, token); }
  if (tool === 'upstash_redis_zrevrangebyscore') { return await redis('ZREVRANGEBYSCORE', [key, args.max||'+inf', args.min||'-inf', 'LIMIT', args.offset||0, args.count||10], url, token); }
  if (tool === 'upstash_redis_zremrangebyrank') { return await redis('ZREMRANGEBYRANK', [key, args.start, args.stop], url, token); }
  if (tool === 'upstash_redis_zremrangebyscore') { return await redis('ZREMRANGEBYSCORE', [key, args.min, args.max], url, token); }
  if (tool === 'upstash_redis_zpopmin') { return await redis('ZPOPMIN', [key, args.count||1], url, token); }
  if (tool === 'upstash_redis_zpopmax') { return await redis('ZPOPMAX', [key, args.count||1], url, token); }
  if (tool === 'upstash_redis_zincrby') { return await redis('ZINCRBY', [key, args.increment, member], url, token); }
  if (tool === 'upstash_redis_zcount') { return await redis('ZCOUNT', [key, args.min||'-inf', args.max||'+inf'], url, token); }
  if (tool === 'upstash_redis_zunionstore') { return await redis('ZUNIONSTORE', [args.destination, args.keys?.length||1, ...(Array.isArray(args.keys)?args.keys:[key])], url, token); }
  if (tool === 'upstash_redis_zinterstore') { return await redis('ZINTERSTORE', [args.destination, args.keys?.length||1, ...(Array.isArray(args.keys)?args.keys:[key])], url, token); }
  if (tool === 'upstash_redis_zscan') { return await redis('ZSCAN', [key, args.cursor||0, 'MATCH', pattern||'*', 'COUNT', args.count||10], url, token); }
  if (tool === 'upstash_redis_zrangebylex') { return await redis('ZRANGEBYLEX', [key, args.min||'-', args.max||'+'], url, token); }
  if (tool === 'upstash_redis_zrevrangebylex') { return await redis('ZREVRANGEBYLEX', [key, args.max||'+', args.min||'-'], url, token); }
  if (tool === 'upstash_redis_zremrangebylex') { return await redis('ZREMRANGEBYLEX', [key, args.min, args.max], url, token); }
  if (tool === 'upstash_redis_zlexcount') { return await redis('ZLEXCOUNT', [key, args.min||'-', args.max||'+'], url, token); }
  if (tool === 'upstash_redis_zmscore') { return await redis('ZMSCORE', [key, ...(Array.isArray(member)?member:[member])], url, token); }

  // ── GEO COMMANDS ───────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_geoadd') { return await redis('GEOADD', [key, args.longitude, args.latitude, member], url, token); }
  if (tool === 'upstash_redis_geodist') { return await redis('GEODIST', [key, args.member1, args.member2, args.unit||'km'], url, token); }
  if (tool === 'upstash_redis_geopos') { return await redis('GEOPOS', [key, ...(Array.isArray(member)?member:[member])], url, token); }
  if (tool === 'upstash_redis_geohash') { return await redis('GEOHASH', [key, ...(Array.isArray(member)?member:[member])], url, token); }
  if (tool === 'upstash_redis_geosearch') { return await redis('GEOSEARCH', [key, 'FROMLONLAT', args.longitude, args.latitude, 'BYRADIUS', args.radius, args.unit||'km', args.sort||'ASC', 'COUNT', args.count||10], url, token); }

  // ── HYPERLOGLOG ────────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_pfadd') { return await redis('PFADD', [key, ...(Array.isArray(value)?value:[value])], url, token); }
  if (tool === 'upstash_redis_pfcount') { return await redis('PFCOUNT', Array.isArray(args.keys)?args.keys:[key], url, token); }
  if (tool === 'upstash_redis_pfmerge') { return await redis('PFMERGE', [args.destination, ...(Array.isArray(args.keys)?args.keys:[key])], url, token); }

  // ── BITFIELD ───────────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_setbit') { return await redis('SETBIT', [key, args.offset, args.bit_value], url, token); }
  if (tool === 'upstash_redis_getbit') { return await redis('GETBIT', [key, args.offset], url, token); }
  if (tool === 'upstash_redis_bitcount') { return await redis('BITCOUNT', [key, ...(args.start!==undefined?[args.start,args.end]:[])], url, token); }
  if (tool === 'upstash_redis_bitpos') { return await redis('BITPOS', [key, args.bit, ...(args.start!==undefined?[args.start]:[])], url, token); }
  if (tool === 'upstash_redis_bitop') { return await redis('BITOP', [args.operation||'AND', args.destination, ...(Array.isArray(args.keys)?args.keys:[key])], url, token); }

  // ── PUB/SUB ────────────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_publish') { return await redis('PUBLISH', [args.channel, args.message], url, token); }
  if (tool === 'upstash_redis_pubsub_channels') { return await redis('PUBSUB', ['CHANNELS', pattern||'*'], url, token); }

  // ── STREAMS ────────────────────────────────────────────────────────────────
  if (tool === 'upstash_redis_xadd') {
    const fields = [];
    for (const [f, v] of Object.entries(args.fields||{})) { fields.push(f, v); }
    return await redis('XADD', [key, args.id||'*', ...fields], url, token);
  }
  if (tool === 'upstash_redis_xread') { return await redis('XREAD', ['COUNT', args.count||10, 'STREAMS', ...(Array.isArray(args.keys)?args.keys:[key]), ...(Array.isArray(args.ids)?args.ids:['0'])], url, token); }
  if (tool === 'upstash_redis_xrange') { return await redis('XRANGE', [key, args.start||'-', args.end||'+', 'COUNT', args.count||10], url, token); }
  if (tool === 'upstash_redis_xrevrange') { return await redis('XREVRANGE', [key, args.end||'+', args.start||'-', 'COUNT', args.count||10], url, token); }
  if (tool === 'upstash_redis_xlen') { return await redis('XLEN', [key], url, token); }
  if (tool === 'upstash_redis_xdel') { return await redis('XDEL', [key, ...(Array.isArray(args.ids)?args.ids:[args.id])], url, token); }
  if (tool === 'upstash_redis_xtrim') { return await redis('XTRIM', [key], 'MAXLEN', args.max_len, url, token); }
  if (tool === 'upstash_redis_xinfo') { return await redis('XINFO', ['STREAM', key], url, token); }

  // ── PIPELINE (batch multiple commands) ────────────────────────────────────
  if (tool === 'upstash_redis_pipeline') {
    const { rest_url: ru, rest_token: rt } = args;
    const u = ru || getRestCreds().url;
    const t = rt || getRestCreds().token;
    const res = await fetch(`${u}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args.commands.map(cmd => Array.isArray(cmd) ? cmd : [cmd]))
    });
    return await res.json();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  UPSTASH VECTOR — vector search and semantic indexing
  // ══════════════════════════════════════════════════════════════════════════

  function getVectorCreds() {
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
    if (!url || !token) throw new Error('UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN not set in .env');
    return { url: url.replace(/\/$/, ''), token };
  }

  async function vec(method, path, body) {
    const { url, token } = getVectorCreds();
    const res = await fetch(`${url}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Upstash Vector ${res.status}: ${data.error || JSON.stringify(data)}`);
    return data.result !== undefined ? data.result : data;
  }

  if (tool === 'upstash_vector_info') { return await vec('GET', '/info'); }
  if (tool === 'upstash_vector_upsert') {
    const { vectors } = args;
    if (!vectors?.length) throw new Error('vectors array is required: [{id, vector, metadata}]');
    return await vec('POST', '/upsert', vectors);
  }
  if (tool === 'upstash_vector_upsert_data') {
    // Upsert text data — Upstash embeds it automatically using the index embedding model
    const { data: items } = args;
    if (!items?.length) throw new Error('data array is required: [{id, data, metadata}]');
    return await vec('POST', '/upsert-data', items);
  }
  if (tool === 'upstash_vector_query') {
    const { vector, top_k = 5, include_vectors = false, include_metadata = true, filter, namespace } = args;
    if (!vector) throw new Error('vector (embedding array) is required');
    const body = { vector, topK: top_k, includeVectors: include_vectors, includeMetadata: include_metadata };
    if (filter) body.filter = filter;
    const path = namespace ? `/query?ns=${encodeURIComponent(namespace)}` : '/query';
    return await vec('POST', path, body);
  }
  if (tool === 'upstash_vector_query_data') {
    // Query with text — Upstash embeds the query automatically
    const { data: queryText, top_k = 5, include_metadata = true, filter, namespace } = args;
    if (!queryText) throw new Error('data (query text) is required');
    const body = { data: queryText, topK: top_k, includeMetadata: include_metadata };
    if (filter) body.filter = filter;
    const path = namespace ? `/query-data?ns=${encodeURIComponent(namespace)}` : '/query-data';
    return await vec('POST', path, body);
  }
  if (tool === 'upstash_vector_fetch') {
    const { ids, include_vectors = false, include_metadata = true, namespace } = args;
    if (!ids?.length) throw new Error('ids array is required');
    const body = { ids, includeVectors: include_vectors, includeMetadata: include_metadata };
    const path = namespace ? `/fetch?ns=${encodeURIComponent(namespace)}` : '/fetch';
    return await vec('POST', path, body);
  }
  if (tool === 'upstash_vector_delete') {
    const { ids, namespace } = args;
    if (!ids?.length) throw new Error('ids array is required');
    const path = namespace ? `/delete?ns=${encodeURIComponent(namespace)}` : '/delete';
    return await vec('DELETE', path, { ids });
  }
  if (tool === 'upstash_vector_range') {
    const { cursor = '', limit = 100, include_vectors = false, include_metadata = true, namespace, prefix } = args;
    const body = { cursor, limit, includeVectors: include_vectors, includeMetadata: include_metadata };
    if (prefix) body.prefix = prefix;
    const path = namespace ? `/range?ns=${encodeURIComponent(namespace)}` : '/range';
    return await vec('GET', path, body);
  }
  if (tool === 'upstash_vector_reset') {
    const { namespace } = args;
    const path = namespace ? `/reset?ns=${encodeURIComponent(namespace)}` : '/reset';
    return await vec('DELETE', path);
  }
  if (tool === 'upstash_vector_list_namespaces') { return await vec('GET', '/namespaces'); }
  if (tool === 'upstash_vector_delete_namespace') {
    if (!args.namespace) throw new Error('namespace is required');
    return await vec('DELETE', `/namespace/${encodeURIComponent(args.namespace)}`);
  }
  if (tool === 'upstash_vector_namespace_info') {
    if (!args.namespace) throw new Error('namespace is required');
    return await vec('GET', `/namespace/${encodeURIComponent(args.namespace)}/info`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  UPSTASH KAFKA — managed Kafka cluster operations
  // ══════════════════════════════════════════════════════════════════════════

  function getKafkaCreds() {
    const url = process.env.UPSTASH_KAFKA_REST_URL;
    const token = process.env.UPSTASH_KAFKA_REST_TOKEN;
    if (!url || !token) throw new Error('UPSTASH_KAFKA_REST_URL and UPSTASH_KAFKA_REST_TOKEN not set in .env');
    return { url: url.replace(/\/$/, ''), token };
  }

  async function kafka(method, path, body) {
    const { url, token } = getKafkaCreds();
    const res = await fetch(`${url}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Upstash Kafka ${res.status}: ${data.message || JSON.stringify(data)}`);
    return data;
  }

  if (tool === 'upstash_kafka_produce') {
    const { topic, value, key: msgKey, partition, headers } = args;
    if (!topic || value === undefined) throw new Error('topic and value are required');
    const messages = [{ topic, value: typeof value === 'object' ? JSON.stringify(value) : String(value) }];
    if (msgKey) messages[0].key = msgKey;
    if (partition !== undefined) messages[0].partition = partition;
    if (headers) messages[0].headers = headers;
    return await kafka('POST', '/produce', messages);
  }
  if (tool === 'upstash_kafka_produce_batch') {
    const { messages } = args;
    if (!messages?.length) throw new Error('messages array is required: [{topic, value, key?, partition?}]');
    const normalized = messages.map(m => ({ ...m, value: typeof m.value === 'object' ? JSON.stringify(m.value) : String(m.value) }));
    return await kafka('POST', '/produce', normalized);
  }
  if (tool === 'upstash_kafka_consume') {
    const { topic, consumer_group, instance_id, timeout_ms = 3000, max_bytes = 1048576 } = args;
    if (!topic || !consumer_group || !instance_id) throw new Error('topic, consumer_group, and instance_id are required');
    return await kafka('GET', `/consume/${encodeURIComponent(consumer_group)}/${encodeURIComponent(instance_id)}/${encodeURIComponent(topic)}?timeout=${timeout_ms}&maxBytes=${max_bytes}`);
  }
  if (tool === 'upstash_kafka_commit_offsets') {
    const { consumer_group, instance_id, offsets } = args;
    if (!consumer_group || !instance_id || !offsets) throw new Error('consumer_group, instance_id, and offsets are required');
    return await kafka('POST', `/commit/${encodeURIComponent(consumer_group)}/${encodeURIComponent(instance_id)}`, offsets);
  }
  if (tool === 'upstash_kafka_fetch_offsets') {
    const { consumer_group, topic } = args;
    if (!consumer_group) throw new Error('consumer_group is required');
    let path = `/offsets/${encodeURIComponent(consumer_group)}`;
    if (topic) path += `?topic=${encodeURIComponent(topic)}`;
    return await kafka('GET', path);
  }

  throw new Error(`Unknown Upstash tool: ${tool}`);

  // ── QSTASH (Serverless Message Queue) ─────────────────────────────────────
  if (tool === 'upstash_qstash_publish') {
    const { url, body, headers: msgHeaders, delay, not_before, retries, callback, failure_callback } = args;
    if (!url) throw new Error('url (destination) is required');
    const qHeaders = { 'Authorization': `Bearer ${qstashToken()}`, 'Content-Type': 'application/json' };
    if (delay) qHeaders['Upstash-Delay'] = String(delay);
    if (not_before) qHeaders['Upstash-Not-Before'] = String(not_before);
    if (retries !== undefined) qHeaders['Upstash-Retries'] = String(retries);
    if (callback) qHeaders['Upstash-Callback'] = callback;
    if (failure_callback) qHeaders['Upstash-Failure-Callback'] = failure_callback;
    if (msgHeaders) Object.entries(msgHeaders).forEach(([k, v]) => qHeaders[`Upstash-Forward-${k}`] = v);
    const res = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(url)}`, {
      method: 'POST', headers: qHeaders,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`QStash ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }
  if (tool === 'upstash_qstash_publish_to_topic') {
    const { topic_name, body, delay, retries } = args;
    if (!topic_name) throw new Error('topic_name is required');
    const qHeaders = { 'Authorization': `Bearer ${qstashToken()}`, 'Content-Type': 'application/json' };
    if (delay) qHeaders['Upstash-Delay'] = String(delay);
    if (retries !== undefined) qHeaders['Upstash-Retries'] = String(retries);
    const res = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(`upstash-qstash-topic:${topic_name}`)}`, {
      method: 'POST', headers: qHeaders,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`QStash topic ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }
  if (tool === 'upstash_qstash_list_messages') {
    return await qstash('GET', '/v2/messages');
  }
  if (tool === 'upstash_qstash_get_message') {
    return await qstash('GET', `/v2/messages/${args.message_id}`);
  }
  if (tool === 'upstash_qstash_cancel_message') {
    return await qstash('DELETE', `/v2/messages/${args.message_id}`);
  }
  if (tool === 'upstash_qstash_list_schedules') {
    return await qstash('GET', '/v2/schedules');
  }
  if (tool === 'upstash_qstash_get_schedule') {
    return await qstash('GET', `/v2/schedules/${args.schedule_id}`);
  }
  if (tool === 'upstash_qstash_create_schedule') {
    const { destination, cron, body, retries } = args;
    if (!destination || !cron) throw new Error('destination and cron are required');
    const qHeaders = { 'Authorization': `Bearer ${qstashToken()}`, 'Content-Type': 'application/json', 'Upstash-Cron': cron };
    if (retries !== undefined) qHeaders['Upstash-Retries'] = String(retries);
    const res = await fetch(`https://qstash.upstash.io/v2/schedules/${encodeURIComponent(destination)}`, {
      method: 'POST', headers: qHeaders,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`QStash schedule ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }
  if (tool === 'upstash_qstash_delete_schedule') {
    return await qstash('DELETE', `/v2/schedules/${args.schedule_id}`);
  }
  if (tool === 'upstash_qstash_list_dlq') {
    return await qstash('GET', '/v2/dlq');
  }
  if (tool === 'upstash_qstash_delete_dlq_message') {
    return await qstash('DELETE', `/v2/dlq/${args.dlq_message_id}`);
  }
  if (tool === 'upstash_qstash_list_topics') {
    return await qstash('GET', '/v2/topics');
  }
  if (tool === 'upstash_qstash_create_topic') {
    const { topic_name, endpoints } = args;
    if (!topic_name || !endpoints?.length) throw new Error('topic_name and endpoints array are required');
    return await qstash('POST', `/v2/topics/${topic_name}/endpoints`, { endpoints });
  }
  if (tool === 'upstash_qstash_delete_topic') {
    return await qstash('DELETE', `/v2/topics/${args.topic_name}`);
  }
  if (tool === 'upstash_qstash_add_endpoint') {
    const { topic_name, url } = args;
    if (!topic_name || !url) throw new Error('topic_name and url are required');
    return await qstash('POST', `/v2/topics/${topic_name}/endpoints`, { endpoints: [{ url }] });
  }
  if (tool === 'upstash_qstash_remove_endpoint') {
    const { topic_name, url } = args;
    if (!topic_name || !url) throw new Error('topic_name and url are required');
    return await qstash('DELETE', `/v2/topics/${topic_name}/endpoints`, { endpoints: [{ url }] });
  }
  if (tool === 'upstash_qstash_get_api_keys') {
    return await qstash('GET', '/v2/keys');
  }

  // ── KAFKA TOPIC MANAGEMENT ────────────────────────────────────────────────
  if (tool === 'upstash_kafka_list_topics') {
    const { cluster_id } = args;
    if (!cluster_id) throw new Error('cluster_id is required');
    return await mgmt('GET', `/kafka/clusters/${cluster_id}/topics`);
  }
  if (tool === 'upstash_kafka_create_topic') {
    const { cluster_id, name, partitions = 1, retention_size = -1, retention_time = 604800000, cleanup_policy = 'delete' } = args;
    if (!cluster_id || !name) throw new Error('cluster_id and name are required');
    return await mgmt('POST', `/kafka/clusters/${cluster_id}/topic`, { name, partitions, retention_size, retention_time, cleanup_policy });
  }
  if (tool === 'upstash_kafka_delete_topic') {
    const { cluster_id, topic_name } = args;
    if (!cluster_id || !topic_name) throw new Error('cluster_id and topic_name are required');
    return await mgmt('DELETE', `/kafka/clusters/${cluster_id}/topic/${topic_name}`);
  }
  if (tool === 'upstash_kafka_get_topic') {
    const { cluster_id, topic_name } = args;
    if (!cluster_id || !topic_name) throw new Error('cluster_id and topic_name are required');
    return await mgmt('GET', `/kafka/clusters/${cluster_id}/topic/${topic_name}`);
  }
  if (tool === 'upstash_kafka_list_consumer_groups') {
    const { cluster_id } = args;
    if (!cluster_id) throw new Error('cluster_id is required');
    return await mgmt('GET', `/kafka/clusters/${cluster_id}/consumer-groups`);
  }
  if (tool === 'upstash_kafka_list_credentials') {
    const { cluster_id } = args;
    if (!cluster_id) throw new Error('cluster_id is required');
    return await mgmt('GET', `/kafka/clusters/${cluster_id}/credentials`);
  }
  if (tool === 'upstash_kafka_create_credentials') {
    const { cluster_id, credential_name, topic_name, permissions } = args;
    if (!cluster_id || !credential_name) throw new Error('cluster_id and credential_name are required');
    const body = { credential_name };
    if (topic_name) body.topic = topic_name;
    if (permissions) body.permissions = permissions;
    return await mgmt('POST', `/kafka/clusters/${cluster_id}/credentials`, body);
  }
  if (tool === 'upstash_kafka_list_clusters') {
    return await mgmt('GET', '/kafka/clusters');
  }
  if (tool === 'upstash_kafka_get_cluster') {
    return await mgmt('GET', `/kafka/clusters/${args.cluster_id}`);
  }
  if (tool === 'upstash_kafka_create_cluster') {
    const { name, region, multizone = false } = args;
    if (!name || !region) throw new Error('name and region are required');
    return await mgmt('POST', '/kafka/clusters', { name, region, multizone });
  }
  if (tool === 'upstash_kafka_delete_cluster') {
    return await mgmt('DELETE', `/kafka/clusters/${args.cluster_id}`);
  }

  // ── REDIS API KEYS ────────────────────────────────────────────────────────
  if (tool === 'upstash_list_api_keys') {
    return await mgmt('GET', '/apikeys');
  }
  if (tool === 'upstash_create_api_key') {
    const { name } = args;
    if (!name) throw new Error('name is required');
    return await mgmt('POST', '/apikeys', { name });
  }
  if (tool === 'upstash_delete_api_key') {
    return await mgmt('DELETE', `/apikeys/${args.api_key_id}`);
  }

  throw new Error(`Unknown Upstash tool: ${tool}`);
}

export default { execute };

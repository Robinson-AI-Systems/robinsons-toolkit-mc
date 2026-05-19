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

  throw new Error(`Unknown Upstash tool: ${tool}`);
}

export default { execute };
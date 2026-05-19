/**
 * Local Machine Handler
 * Gives the coding agent direct access to your Windows PC:
 * filesystem read/write, terminal commands, environment management.
 */

import { execSync, exec } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, unlinkSync, copyFileSync } from 'fs';
import { join, resolve, dirname, basename, extname } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

function resolvePath(p) {
  if (!p) return WORKSPACE_ROOT;
  if (p.match(/^[A-Za-z]:\\/)) return p; // Absolute Windows path
  if (p.startsWith('/')) return p;        // Absolute Unix path
  return join(WORKSPACE_ROOT, p);         // Relative to workspace
}

function checkWriteAllowed(p) {
  const allowed = process.env.ALLOWED_WRITE_PATHS;
  if (!allowed) {
    // Default: only allow writes under WORKSPACE_ROOT
    const resolved = resolve(p);
    const root = resolve(WORKSPACE_ROOT);
    if (!resolved.startsWith(root)) {
      throw new Error(`Write blocked: path "${p}" is outside WORKSPACE_ROOT "${WORKSPACE_ROOT}". Set ALLOWED_WRITE_PATHS in .env to allow other locations.`);
    }
    return;
  }
  const allowedPaths = allowed.split(',').map(s => resolve(s.trim()));
  const resolved = resolve(p);
  if (!allowedPaths.some(ap => resolved.startsWith(ap))) {
    throw new Error(`Write blocked: "${p}" is not in ALLOWED_WRITE_PATHS.`);
  }
}

async function execute(tool, args) {

  // ── TERMINAL / COMMANDS ────────────────────────────────────────────────────
  if (tool === 'local_run_command') {
    const { command, cwd, timeout_ms = 30000 } = args;
    const workdir = cwd ? resolvePath(cwd) : WORKSPACE_ROOT;
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workdir,
        timeout: timeout_ms,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        shell: true,
        windowsHide: true
      });
      return {
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        command,
        cwd: workdir
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        exitCode: err.code,
        command,
        cwd: workdir
      };
    }
  }

  // ── FILE SYSTEM: READ ──────────────────────────────────────────────────────
  if (tool === 'local_read_file') {
    const { path: p, encoding = 'utf-8' } = args;
    const fullPath = resolvePath(p);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    const stat = statSync(fullPath);
    if (stat.isDirectory()) throw new Error(`Path is a directory, not a file: ${fullPath}`);
    const content = readFileSync(fullPath, encoding);
    return {
      path: fullPath,
      content,
      size_bytes: stat.size,
      modified: stat.mtime.toISOString()
    };
  }

  if (tool === 'local_read_multiple_files') {
    const { paths } = args;
    const results = {};
    for (const p of paths) {
      try {
        const fullPath = resolvePath(p);
        results[p] = readFileSync(fullPath, 'utf-8');
      } catch (e) {
        results[p] = `ERROR: ${e.message}`;
      }
    }
    return results;
  }

  // ── FILE SYSTEM: WRITE ─────────────────────────────────────────────────────
  if (tool === 'local_write_file') {
    const { path: p, content, create_dirs = true } = args;
    const fullPath = resolvePath(p);
    checkWriteAllowed(fullPath);
    if (create_dirs) {
      mkdirSync(dirname(fullPath), { recursive: true });
    }
    writeFileSync(fullPath, content, 'utf-8');
    return {
      success: true,
      path: fullPath,
      bytes_written: Buffer.byteLength(content, 'utf-8')
    };
  }

  if (tool === 'local_append_file') {
    const { path: p, content } = args;
    const fullPath = resolvePath(p);
    checkWriteAllowed(fullPath);
    const existing = existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
    writeFileSync(fullPath, existing + content, 'utf-8');
    return { success: true, path: fullPath };
  }

  if (tool === 'local_delete_file') {
    const { path: p } = args;
    const fullPath = resolvePath(p);
    checkWriteAllowed(fullPath);
    if (!existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);
    unlinkSync(fullPath);
    return { success: true, deleted: fullPath };
  }

  if (tool === 'local_copy_file') {
    const { source, destination, overwrite = false } = args;
    const src = resolvePath(source);
    const dst = resolvePath(destination);
    checkWriteAllowed(dst);
    if (!existsSync(src)) throw new Error(`Source not found: ${src}`);
    if (existsSync(dst) && !overwrite) throw new Error(`Destination exists: ${dst}. Set overwrite: true to replace.`);
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    return { success: true, source: src, destination: dst };
  }

  // ── DIRECTORY OPERATIONS ───────────────────────────────────────────────────
  if (tool === 'local_list_directory') {
    const { path: p, recursive = false, include_hidden = false, filter_ext } = args;
    const fullPath = resolvePath(p);
    if (!existsSync(fullPath)) throw new Error(`Directory not found: ${fullPath}`);

    function listDir(dir, depth = 0) {
      const items = [];
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (!include_hidden && entry.startsWith('.')) continue;
        const entryPath = join(dir, entry);
        const stat = statSync(entryPath);
        const rel = entryPath.replace(fullPath, '').replace(/^[/\\]/, '');
        if (filter_ext && stat.isFile()) {
          if (!entry.endsWith(filter_ext)) continue;
        }
        items.push({
          name: entry,
          path: rel,
          type: stat.isDirectory() ? 'directory' : 'file',
          size_bytes: stat.isFile() ? stat.size : undefined,
          modified: stat.mtime.toISOString()
        });
        if (recursive && stat.isDirectory() && depth < 5) {
          items.push(...listDir(entryPath, depth + 1));
        }
      }
      return items;
    }

    const items = listDir(fullPath);
    return {
      path: fullPath,
      items,
      total: items.length,
      files: items.filter(i => i.type === 'file').length,
      directories: items.filter(i => i.type === 'directory').length
    };
  }

  if (tool === 'local_make_directory') {
    const { path: p } = args;
    const fullPath = resolvePath(p);
    checkWriteAllowed(fullPath);
    mkdirSync(fullPath, { recursive: true });
    return { success: true, path: fullPath };
  }

  // ── ENVIRONMENT / CONFIG ───────────────────────────────────────────────────
  if (tool === 'local_read_env_file') {
    const { path: p } = args;
    const fullPath = resolvePath(p || '.env');
    if (!existsSync(fullPath)) throw new Error(`Env file not found: ${fullPath}`);
    const content = readFileSync(fullPath, 'utf-8');
    // Parse env file but mask values for security
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const vars = {};
    for (const line of lines) {
      const [key, ...rest] = line.split('=');
      const value = rest.join('=');
      vars[key.trim()] = value.trim() ? '***' : '(empty)';
    }
    return {
      path: fullPath,
      variables: vars,
      variable_count: Object.keys(vars).length,
      note: 'Values are masked for security. Use local_update_env_var to modify specific values.'
    };
  }

  if (tool === 'local_update_env_var') {
    const { path: p, key, value } = args;
    const fullPath = resolvePath(p || '.env');
    checkWriteAllowed(fullPath);
    let content = existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '';
    const lines = content.split('\n');
    const keyPattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`, 'm');
    const newLine = `${key}=${value}`;
    if (keyPattern.test(content)) {
      content = content.replace(keyPattern, newLine);
    } else {
      content = content.trimEnd() + '\n' + newLine + '\n';
    }
    writeFileSync(fullPath, content, 'utf-8');
    return { success: true, key, path: fullPath, action: keyPattern.test(readFileSync(fullPath,'utf-8')) ? 'updated' : 'created' };
  }

  if (tool === 'local_get_system_info') {
    const { stdout: nodeVer } = await execAsync('node --version').catch(() => ({ stdout: 'unknown' }));
    const { stdout: npmVer } = await execAsync('npm --version').catch(() => ({ stdout: 'unknown' }));
    const { stdout: gitVer } = await execAsync('git --version').catch(() => ({ stdout: 'unknown' }));
    return {
      workspace_root: WORKSPACE_ROOT,
      platform: process.platform,
      arch: process.arch,
      node_version: nodeVer.trim(),
      npm_version: npmVer.trim(),
      git_version: gitVer.trim(),
      env_vars_set: Object.keys(process.env).length,
      cwd: process.cwd()
    };
  }

  if (tool === 'local_find_files') {
    const { directory, pattern, content_search } = args;
    const dir = resolvePath(directory || '');

    function findFiles(d, depth = 0) {
      if (depth > 6) return [];
      const results = [];
      try {
        for (const entry of readdirSync(d)) {
          if (entry.startsWith('.') || entry === 'node_modules') continue;
          const full = join(d, entry);
          const stat = statSync(full);
          if (stat.isDirectory()) {
            results.push(...findFiles(full, depth + 1));
          } else {
            if (pattern && !entry.includes(pattern) && !full.includes(pattern)) continue;
            if (content_search) {
              try {
                const text = readFileSync(full, 'utf-8');
                if (!text.includes(content_search)) continue;
                const lines = text.split('\n');
                const matchLines = lines
                  .map((l, i) => ({ line: i + 1, text: l }))
                  .filter(l => l.text.includes(content_search));
                results.push({ path: full.replace(dir, '').replace(/^[/\\]/, ''), matches: matchLines.slice(0, 5) });
              } catch { continue; }
            } else {
              results.push({ path: full.replace(dir, '').replace(/^[/\\]/, ''), size: stat.size });
            }
          }
        }
      } catch { }
      return results;
    }

    const found = findFiles(dir);
    return { directory: dir, results: found, total: found.length };
  }

  if (tool === 'local_git_status') {
    const { directory } = args;
    const cwd = resolvePath(directory || '');
    try {
      const { stdout: status } = await execAsync('git status --porcelain', { cwd });
      const { stdout: branch } = await execAsync('git branch --show-current', { cwd });
      const { stdout: log } = await execAsync('git log --oneline -5', { cwd });
      return {
        branch: branch.trim(),
        status: status.trim(),
        recent_commits: log.trim(),
        has_changes: status.trim().length > 0
      };
    } catch (e) {
      throw new Error(`Git error: ${e.message}. Is this directory a git repo?`);
    }
  }

  throw new Error(`Unknown local tool: ${tool}`);
}

export default { execute };

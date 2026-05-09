const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const escape = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const blockedDirs = [
  '.local',
  '.git',
  '.cache',
  '.upm',
  '.config',
  'attached_assets',
  path.join('supabase', '.branches'),
  path.join('supabase', '.temp'),
  path.join('node_modules', '.cache'),
  // Exclude pnpm's content-addressable store from Metro's file map.
  // Top-level node_modules/<pkg> symlinks are still visible; Metro
  // follows them via unstable_enableSymlinks (direct fs reads), so
  // module resolution is unaffected. Excluding this prevents Watchman
  // from inotify-watching the 941-package .pnpm tree and hitting the
  // container's watch-fd limit (ENOSPC).
  path.join('node_modules', '.pnpm'),
];

const blockListPatterns = [
  ...blockedDirs.map(
    (dir) =>
      new RegExp(`^${escape(path.join(projectRoot, dir))}(?:[\\/].*)?$`),
  ),
  new RegExp(`^${escape(projectRoot)}[\\/].*[\\/]\\.old-[^\\/]+(?:[\\/].*)?$`),
];

// watchFolders: explicitly list every source root so Watchman's active
// subscription covers only real source trees.  node_modules itself is
// still reachable for resolution via nodeModulesPaths below.
config.watchFolders = [
  projectRoot,
  path.join(projectRoot, 'src'),
  path.join(projectRoot, 'supabase', 'functions'),
];

config.resolver = config.resolver || {};
config.resolver.blockList = blockListPatterns;

// Follow pnpm symlinks (node_modules/<pkg> → .pnpm/…) via direct fs
// reads rather than requiring Watchman to have crawled the target.
config.resolver.unstable_enableSymlinks = true;

// Explicit module roots so the resolver never needs to walk upward
// through directories that Watchman hasn't indexed.
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];

config.watcher = config.watcher || {};
config.watcher.healthCheck = {
  ...(config.watcher.healthCheck || {}),
  enabled: false,
};

module.exports = config;

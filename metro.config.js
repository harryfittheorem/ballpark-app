const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const escape = require('escape-string-regexp');

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
];

const blockListPatterns = [
  ...blockedDirs.map(
    (dir) =>
      new RegExp(`^${escape(path.join(projectRoot, dir))}(?:[\\\\/].*)?$`),
  ),
  new RegExp(`^${escape(projectRoot)}[\\\\/].*[\\\\/]\\.old-[^\\\\/]+(?:[\\\\/].*)?$`),
];

config.resolver = config.resolver || {};
config.resolver.blockList = blockListPatterns;

config.watcher = config.watcher || {};
config.watcher.additionalExts = config.watcher.additionalExts || [];
config.watcher.healthCheck = {
  ...(config.watcher.healthCheck || {}),
  enabled: false,
};
config.watcher.watchman = {
  ...(config.watcher.watchman || {}),
  deferStates: ['hg.update'],
};
config.watcher.unstable_autoSaveCache = {
  ...(config.watcher.unstable_autoSaveCache || {}),
  enabled: false,
};

config.resolver.unstable_enablePackageExports = config.resolver.unstable_enablePackageExports ?? true;

module.exports = config;

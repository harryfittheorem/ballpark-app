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
];

const blockListPatterns = [
  ...blockedDirs.map(
    (dir) =>
      new RegExp(`^${escape(path.join(projectRoot, dir))}(?:[\\\\/].*)?$`),
  ),
  new RegExp(`^${escape(projectRoot)}[\\\\/].*[\\\\/]\\.old-[^\\\\/]+(?:[\\\\/].*)?$`),
];

config.watchFolders = [projectRoot];
config.resolver = config.resolver || {};
config.resolver.blockList = blockListPatterns;
config.watcher = config.watcher || {};
config.watcher.healthCheck = {
  ...(config.watcher.healthCheck || {}),
  enabled: false,
};

module.exports = config;

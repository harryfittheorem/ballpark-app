// Local-only checks: no native builds, network requests, or provider changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const { getConfig } = require('@expo/config');
const { IOSConfig, AndroidConfig } = require('@expo/config-plugins');
const { getStateFromPath } = require('@react-navigation/core');

process.chdir(path.join(__dirname, '..'));
const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const plain = (value) => JSON.parse(JSON.stringify(value));
const projectId = '4ce07796-bc3a-4c22-b3a1-502a1d5d6dfc';
const fullName = 'Clubhouse by Infinite Hitting';
assert.equal(fullName.length, 29);

function checkIdentity(config) {
  assert.equal(config.name, 'Clubhouse');
  assert.equal(config.ios.bundleIdentifier, 'com.fittheorem.ballpark');
  assert.equal(config.android.package, 'com.fittheorem.ballpark');
  assert.equal(config.slug, 'ballpark-app');
  assert.equal(config.scheme, 'ballpark');
  assert.equal(config.owner, 'harjinderharry');
  assert.equal(config.extra.eas.projectId, projectId);
  assert.equal(config.updates.url, `https://u.expo.dev/${projectId}`);
  assert.equal(IOSConfig.Name.setDisplayName(config, {}).CFBundleDisplayName, 'Clubhouse');
  assert.equal(AndroidConfig.Name.getName(config), 'Clubhouse');
  assert.deepEqual(plain(config.splash), {
    image: './assets/splash-icon.png', resizeMode: 'contain', backgroundColor: '#0F0E0E',
  });
  const permissions = Object.entries(config.ios.infoPlist)
    .filter(([key]) => key.endsWith('UsageDescription'));
  assert.equal(permissions.length, 4);
  permissions.forEach(([, value]) => assert.match(value, /^Clubhouse needs /));
  const picker = config.plugins.find((plugin) => plugin[0] === 'expo-image-picker')[1];
  Object.values(picker).forEach((value) => assert.match(value, /^Clubhouse needs /));
}

checkIdentity(getConfig(process.cwd()).exp);
for (const host of [undefined, 'links.example.test']) {
  const context = {
    module: { exports: {} },
    require: (file) => { assert.equal(file, './app.json'); return json('app.json'); },
    process: { env: { EXPO_PUBLIC_AUTH_REDIRECT_HOST: host } },
  };
  vm.runInNewContext(read('app.config.js'), context);
  const config = context.module.exports().expo;
  checkIdentity(config);
  assert.deepEqual(plain(config.android.intentFilters[0].data), [
    { scheme: 'ballpark', host: 'auth', pathPrefix: '/callback' },
  ]);
  assert.deepEqual(plain(config.ios.associatedDomains ?? []), host ? [`applinks:${host}`] : []);
  assert.equal(config.android.intentFilters.length, host ? 2 : 1);
  if (host) {
    assert.equal(config.android.intentFilters[1].autoVerify, true);
    assert.deepEqual(plain(config.android.intentFilters[1].data), [
      { scheme: 'https', host, pathPrefix: '/auth/callback' },
    ]);
  }
}
const eas = json('eas.json');
assert.deepEqual(eas.build, {
  development: { developmentClient: true, distribution: 'internal' },
  preview: { distribution: 'internal', channel: 'preview' },
  production: { autoIncrement: true },
  'production-infinitehitting': {
    autoIncrement: true, env: { EXPO_PUBLIC_TENANT_SLUG: 'infinitehitting' },
  },
});
assert.equal(eas.submit.production.ios.ascAppId, '6773873454');

assert.equal(hash('assets/icon.png'), '1cc1a194ba4e320ee98bb29c0619ede6afccff0c2e0e7d39a2b3a6c9279ed3e5');
assert.equal(hash('assets/adaptive-icon.png'), '1bec02742c6f4bbde2acd9403c3884b61b1e00a590195db9c7692e25324fa67f');
// The reviewed artwork includes both lines of the new wordmark.
assert.equal(hash('assets/splash-icon.png'), 'bd2bc835c7c0f79c236d75a51ffafab8dd46188924d2aa4de8b770291381018d');
const png = fs.readFileSync('assets/splash-icon.png');
assert.equal(png.readUInt32BE(16), 1024);
assert.equal(png.readUInt32BE(20), 1024);

function compile(source, requireModule) {
  const context = { exports: {}, require: requireModule, URL, URLSearchParams };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}

// Exercise the production navigation map, not a copied set of route definitions.
const navigator = read('src/navigation/RootNavigator.tsx');
const linkingSource = navigator.slice(navigator.indexOf('const linking:'), navigator.indexOf('function Splash'));
for (const host of [undefined, 'links.example.test']) {
  const source = linkingSource.replace(/process\.env\.EXPO_PUBLIC_AUTH_REDIRECT_HOST/g, JSON.stringify(host) ?? 'undefined');
  const { linking } = compile(`${source}\nexport { linking };`, () => { throw Error('Unexpected import'); });
  assert.deepEqual(plain(linking.prefixes), host ? ['ballpark://', `https://${host}/`] : ['ballpark://']);
  const cases = [
    ['me/payment-method', 'PaymentMethod', {}],
    ['me/waitlist-claim/claim-123', 'WaitlistClaim', { waitlistId: 'claim-123' }],
    ['work/thread/kid-123/coach-456', 'MessageThread', { kidId: 'kid-123', coachUserId: 'coach-456' }],
    ['work/assignment/drill-123', 'AssignmentDetail', { assignmentId: 'drill-123' }],
    ['work/?initialSubTab=messages', 'WorkHome', { initialSubTab: 'messages' }],
  ];
  for (const prefix of linking.prefixes) {
    for (const [routePath, screen, params] of cases) {
      const url = `${prefix}${routePath}`;
      const state = getStateFromPath(url.slice(prefix.length), plain(linking.config));
      const leaf = state.routes[0].state.routes.at(-1);
      assert.equal(leaf.name, screen, url);
      assert.deepEqual(leaf.params ?? {}, params, url);
    }
  }
}

// Load Expo's real URL parser with native constants stubbed for a standalone app.
const expoLinks = compile(read('node_modules/expo-linking/build/createURL.js'), (name) => {
  if (name === 'expo-constants') return { default: { expoConfig: { scheme: 'ballpark' } } };
  if (name === './Schemes') return { hasCustomScheme: () => true, resolveScheme: () => 'ballpark' };
  if (name === './validateURL') return { validateURL: (url) => assert.equal(typeof url, 'string') };
  throw Error(`Unexpected import: ${name}`);
});
const loadAuth = (host) => compile(
  read('src/utils/authRedirect.ts').replace(
    /process\.env\.EXPO_PUBLIC_AUTH_REDIRECT_HOST/g, JSON.stringify(host) ?? 'undefined',
  ),
  (name) => { assert.equal(name, 'expo-linking'); return expoLinks; },
);
const auth = loadAuth();
assert.equal(auth.getEmailRedirectUrl(), 'ballpark:///auth/callback');
assert.equal(loadAuth('links.example.test').getEmailRedirectUrl(), 'https://links.example.test/auth/callback');
for (const prefix of ['ballpark:///', 'https://links.example.test/']) {
  assert.equal(auth.parseAuthCallbackCode(`${prefix}auth/callback?code=test-code`), 'test-code');
  assert.equal(auth.parseAuthCallbackCode(`${prefix}auth/callback?error=denied`), null);
  assert.equal(auth.parseAuthCallbackCode(`${prefix}me/payment-method?code=unrelated`), null);
}

for (const file of ['src/screens/Me/PaymentMethodScreen.tsx', 'src/screens/Earn/StoreCheckoutScreen.tsx']) {
  assert.ok(read(file).includes(`merchantDisplayName: '${fullName}'`), file);
}
for (const file of fs.readdirSync('src/screens', { recursive: true })) {
  if (!file.endsWith('.tsx')) continue;
  const source = read(path.join('src/screens', file));
  // URLs and technical comments intentionally retain the existing identity.
  const copy = source.split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n').replace(/https:\/\/ballpark-app\.replit\.app/g, '');
  assert.doesNotMatch(copy, /ballpark/i, file);
}
console.log('PASS: Clubhouse names, native labels, permissions, artwork, icon integrity, Expo/EAS identity, HTTPS registration, auth callbacks, and in-app routes.');

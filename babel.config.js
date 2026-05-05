module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@/components': './src/components',
            '@/screens': './src/screens',
            '@/api': './src/api',
            '@/theme': './src/theme',
            '@/hooks': './src/hooks',
            '@/lib': './src/lib',
            '@/store': './src/store',
            '@/utils': './src/utils',
            '@/types': './src/types',
            '@/navigation': './src/navigation',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};

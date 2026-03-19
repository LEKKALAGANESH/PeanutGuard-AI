import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Use webpack instead of Turbopack (needed for ONNX + PWA plugins)
  bundlePagesRouterDependencies: true,

  // Headers for SharedArrayBuffer (needed for ONNX WASM multi-threading)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },

  // Empty turbopack config to satisfy Next.js 16 when webpack config exists
  turbopack: {},

  // Webpack config for ONNX Runtime Web compatibility
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    config.module.rules.push({
      test: /\.onnx$/,
      type: 'asset/resource',
    });
    return config;
  },
};

export default nextConfig;

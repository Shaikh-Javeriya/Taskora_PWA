/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable PWA features
  experimental: {
    webpackBuildWorker: true,
  },
<<<<<<< HEAD

=======
  
>>>>>>> 43939491bb4894e979e930ba600189444352528f
  // Configure headers for PWA
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
<<<<<<< HEAD

=======
  
>>>>>>> 43939491bb4894e979e930ba600189444352528f
  // Webpack configuration for PWA
  webpack: (config, { dev, isServer }) => {
    // Don't run service worker in development
    if (!dev && !isServer) {
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await originalEntry();
<<<<<<< HEAD

=======
        
>>>>>>> 43939491bb4894e979e930ba600189444352528f
        // Add service worker entry
        if (entries['main.js'] && !entries['main.js'].includes('./lib/sw.js')) {
          entries['sw'] = './lib/sw.js';
        }
<<<<<<< HEAD

        return entries;
      };
    }

    return config;
  },

  // Output configuration
  output: 'standalone',
  reactStrictMode: true,
  distDir: ".next",
=======
        
        return entries;
      };
    }
    
    return config;
  },
  
  // Output configuration
  output: 'standalone',
  
  // Image optimization
>>>>>>> 43939491bb4894e979e930ba600189444352528f
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

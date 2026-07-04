import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fuel — Nutrition & Physique Coach',
    short_name: 'Fuel',
    description: 'Aesthetic physique tracking with AI coaching — food log, body fat, measurements, training targets.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['health', 'fitness', 'food'],
    shortcuts: [
      {
        name: 'Log Food',
        url: '/food',
        description: 'Log what you ate',
      },
      {
        name: 'Log Weight',
        url: '/weight',
        description: 'Log today\'s weigh-in',
      },
      {
        name: 'Coach',
        url: '/coach',
        description: 'Chat with your AI coach',
      },
    ],
  };
}

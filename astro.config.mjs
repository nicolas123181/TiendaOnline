// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
// En Astro 5, usamos 'hybrid': páginas estáticas son SSG por defecto, las dinámicas llevan prerender = false
export default defineConfig({
    site:'https://nicovantage.victoriafp.online',
    output: 'hybrid',
    security: {
        checkOrigin: false
    },
    adapter: node({
        mode: 'standalone',
    }),
    integrations: [
        react()
    ],
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            exclude: ['@nanostores/react']
        }
    }
});

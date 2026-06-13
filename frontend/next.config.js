/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Service worker, manifest and icons are served statically from /public.
  // No PWA plugin is used; sw.js is hand-written and registered in layout.tsx.
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  experimental: {
    // Next 14: keep Playwright + serverless Chromium out of the webpack graph for App Router server code
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  },
}

module.exports = nextConfig
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Leaflet ships CSS + images that must be served as-is.
  transpilePackages: ['react-leaflet', 'leaflet'],
};

export default nextConfig;

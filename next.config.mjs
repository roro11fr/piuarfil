/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/", destination: "/site.html" },
      { source: "/receptie", destination: "/receptie.html" },
      { source: "/p/:token", destination: "/p.html" },
    ];
  },
  async headers() {
    const sec = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ];
    return [
      { source: "/:path*", headers: sec },
      { source: "/p/:token", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/receptie", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

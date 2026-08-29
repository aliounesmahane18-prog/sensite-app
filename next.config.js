/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Projet Supabase de production, nommé explicitement pour que la
      // configuration reste lisible et vérifiable d'un coup d'œil.
      {
        protocol: "https",
        hostname: "kpymjqehhtdlwdmefecs.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      // Tout autre projet Supabase (préproduction, tests locaux).
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;

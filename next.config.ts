import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    // Fotos oficiais vêm direto dos servidores da Câmara e do Senado
    remotePatterns: [
      { protocol: "https", hostname: "www.camara.leg.br" },
      { protocol: "http", hostname: "www.senado.leg.br" },
      { protocol: "https", hostname: "www.senado.leg.br" },
    ],
  },
};
export default config;

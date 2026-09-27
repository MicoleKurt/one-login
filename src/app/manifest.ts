import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "One Login",
    short_name: "One Login",
    description: "This month: money in, money out, profit.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050706",
    theme_color: "#050706",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tableland Starter",
  description: "A Tableland + Next.js + wagmi + RainbowKit starter template",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

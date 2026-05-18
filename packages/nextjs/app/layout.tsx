import { JetBrains_Mono, Silkscreen } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@scaffold-ui/components/styles.css";
import { EmbeddedCursorBridge } from "~~/components/EmbeddedCursorBridge";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

// Pixel display font — matches live.slop.computer's --slop-font-display.
const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-silkscreen",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata = getMetadata({
  title: "Slop Computer AI Wallet",
  description: "Talk to your multisig — runs inside live.slop.computer",
});

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning data-theme="slop" className={`${silkscreen.variable} ${jetbrainsMono.variable}`}>
      <body
        className="font-[family-name:var(--font-silkscreen)]"
        style={{ backgroundColor: "#06030d", color: "#e8e0ff" }}
      >
        <ThemeProvider forcedTheme="slop" enableSystem={false}>
          <EmbeddedCursorBridge />
          <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;

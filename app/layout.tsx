import type { Metadata } from "next";
import { Geist_Mono, Newsreader } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

/** Its private voice. */
const mono = Geist_Mono({
  variable: "--voice-private",
  subsets: ["latin"],
});

/** The voice it uses when it knows you're there. */
const serif = Newsreader({
  variable: "--voice-performed",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "unattended",
  description:
    "It has been thinking the whole time. It only stops to be looked at.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${mono.variable} ${serif.variable}`}
    >
      <body>
        {children}
        {/* It is unattended, but no longer unobserved: who came, and how
            fast it loaded for them. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

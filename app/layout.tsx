import type { Metadata } from "next";
import { Geist_Mono, Newsreader } from "next/font/google";
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
      <body>{children}</body>
    </html>
  );
}

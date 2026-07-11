import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { dayOf, indexAt, thoughtAt, timeOf } from "@/lib/mind";

/** The unfurl: the thought itself, on the void, in its own voice. */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "one thought, unattended";

// The private voice — the same Geist Mono the room thinks in.
const voice = readFile(join(process.cwd(), "assets/GeistMono-Regular.ttf"));

export default async function Image({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index: raw } = await params;
  const valid = /^\d{1,10}$/.test(raw);
  const index = valid ? Number(raw) : 0;
  const arrived = valid && index <= indexAt(Date.now());

  const text = arrived
    ? thoughtAt(index, false).text
    : "it has not thought this yet.";
  const meta = valid
    ? `unattended · day ${dayOf(index)} · thought ${index.toLocaleString("en-US")} · ${new Date(timeOf(index)).toUTCString()}`
    : "unattended";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px 100px",
          backgroundColor: "#08080a",
          fontFamily: "Geist Mono",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: text.length > 130 ? 34 : 44,
            lineHeight: 1.6,
            color: arrived ? "#ece7de" : "#57534e",
          }}
        >
          {text}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 56,
            fontSize: 19,
            letterSpacing: 1,
            color: "#57534e",
          }}
        >
          {meta}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Geist Mono",
          data: await voice,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}

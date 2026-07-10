import type { Metadata } from "next";
import { Scrubber } from "./scrubber";

export const metadata: Metadata = {
  title: "unattended · any moment",
  description:
    "Pick any moment since it began. Nothing was recorded; the moment is simply still there.",
};

export default function At() {
  return <Scrubber />;
}

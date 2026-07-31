import { createFileRoute } from "@tanstack/react-router";
import VideoEditorApp from "@/components/editor/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Video Editor — strihaj video a fotky s AI" },
      {
        name: "description",
        content:
          "Nahraj video alebo fotku, strihaj na časovej osi, pridaj hudbu, titulky a AI efekty priamo v prehliadači.",
      },
      { property: "og:title", content: "AI Video Editor — strihaj video a fotky s AI" },
      {
        property: "og:description",
        content:
          "Nahraj video alebo fotku, strihaj na časovej osi, pridaj hudbu, titulky a AI efekty priamo v prehliadači.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideoEditorApp,
});

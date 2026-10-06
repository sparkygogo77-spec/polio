"use client";
/**
 * The Contents plate's picture: drop one (a file, a link, or a picture
 * dragged off the Render panel) and it becomes what the part should LOOK
 * like, for the code to apply under the same hook (`partPicture.ts`). The
 * part itself is untouched on the board; the picture rides with "Send the
 * design back".
 */
import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Input } from "@/core/ui/input";
import { hasPicture, pictureFrom, readDrop, type Dropped } from "./pictureDrop";
import { put as putPicture, usePicture } from "./pictures";
import { hookOf, trimBox, type Box } from "./partPicture";
import { SCREEN } from "./RingConsole";
import { useStudio, type StudioNode } from "./store";

/** Where the picture's real edges are, read in this browser. Null when it cannot be read; the code then uses the whole picture. */
async function edgesOf(blob: Blob): Promise<Box | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(bmp, 0, 0);
    return trimBox(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
  } catch {
    return null;
  }
}

export function PartPictureField({ node, field }: { node: StudioNode; field: string }) {
  const look = node.lookPicture ?? null;
  const { src } = usePicture(look?.picture as never);
  const [said, setSaid] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const update = (patch: Partial<StudioNode>) => useStudio.getState().updateNode(node.id, patch);
  const hook = hookOf(node as never);

  const take = async (d: Dropped) => {
    const got = await pictureFrom(d);
    if (!got) return;
    if (!got.ok) { play("deny"); setSaid(got.says); return; }
    setSaid("Reading its edges…");
    const [made, crop] = await Promise.all([putPicture(got.blob, { alt: got.name === "Picture" ? "" : got.name, from: "upload" }), edgesOf(got.blob)]);
    update({ lookPicture: { picture: made, crop, note: look?.note ?? "" } });
    play("confirm");
    setSaid(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    const d = readDrop(e.dataTransfer);
    if (hasPicture(d)) void take(d);
  };

  if (!hook) {
    return <p className="text-fine" data-part-picture="no-hook" style={{ color: SCREEN.dim }}>A picture look needs a part that came from the site's code (it has a data-hook).</p>;
  }

  return (
    <div
      data-part-picture={look ? "set" : "empty"}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className="flex flex-col gap-1 rounded-[4px] p-1"
      style={{ outline: `1px dashed ${over ? SCREEN.ink : SCREEN.dim}` }}
    >
      <div className="flex items-center gap-1.5">
        {src ? <img src={src} alt={look?.picture.alt ?? ""} className="size-8 shrink-0 rounded-[3px] object-contain" /> : <ImagePlus className="size-4 shrink-0" style={{ color: SCREEN.dim }} />}
        <button type="button" className="text-fine flex-1 text-left underline-offset-2 hover:underline" style={{ color: SCREEN.ink }} onClick={() => fileRef.current?.click()}>
          {look ? "Picture look set; drop or pick another" : "Drop a picture for its look, or pick one"}
        </button>
        {look ? (
          <button type="button" aria-label="Remove the picture look" title="Remove the picture look" onClick={() => { play("tap"); update({ lookPicture: null }); }}>
            <X className="size-3.5" style={{ color: SCREEN.dim }} />
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          aria-label="Picture for this part's look"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void take({ studio: null, files: [f], urls: [] } as Dropped);
          }}
        />
      </div>
      {look ? (
        <Input value={look.note ?? ""} aria-label="Note for the code" inputSize="sm" className={field} placeholder="Note for the code (optional)" onChange={(e) => update({ lookPicture: { ...look, note: e.target.value } })} />
      ) : null}
      <p className="text-fine" style={{ color: SCREEN.dim }}>{said ?? (look ? `Goes with "Send the design back" for ${hook}; the code makes it this part's look and keeps what it does.` : "Loosely cropped is fine: the edges are found for you.")}</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { ImageRequirement } from "@/lib/opportunities";
import { canResize, outputFormats, resizeImage, type SafeImageType } from "@/lib/image-tools";
import { isSafeHttpUrl } from "@/lib/safe-url";

type Props = { requirements: ImageRequirement[] };

const extension: Record<SafeImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export default function ImageResizer({ requirements }: Props) {
  const usable = requirements.filter(canResize);
  const [selected, setSelected] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<SafeImageType>(usable[0] ? outputFormats(usable[0])[0] ?? "image/jpeg" : "image/jpeg");
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState("");
  const requirement = usable[selected];

  useEffect(() => () => { if (outputUrl) URL.revokeObjectURL(outputUrl); }, [outputUrl]);
  if (!usable.length) return <p className="fine-print">No reviewed image dimensions and format available for this notice.</p>;

  async function process() {
    if (!file || !requirement) return;
    setBusy(true);
    setMessage("");
    if (outputUrl) setOutputUrl(null);
    try {
      const output = await resizeImage(file, requirement, { x: x / 100, y: y / 100 }, format);
      setOutputUrl(URL.createObjectURL(output));
      setOutputName(`${requirement.kind}-${requirement.width}x${requirement.height}.${extension[format]}`);
      setMessage(`Ready: ${requirement.width} × ${requirement.height} px, ${Math.round(output.size / 1024)} KiB. Check preview and official notice before using.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image could not be resized.");
    } finally { setBusy(false); }
  }

  return (
    <div className="applicant-tool" style={{ display: "grid", gap: 12, justifyItems: "start", marginBlock: 12 }}>
      <label className="select-field">Document
        <select value={selected} onChange={(event) => { const next = Number(event.target.value); setSelected(next); setFormat(outputFormats(usable[next])[0]); setOutputUrl(null); }}>
          {usable.map((entry, index) => <option value={index} key={`${entry.kind}-${index}`}>{entry.kind} · {entry.width} × {entry.height} px</option>)}
        </select>
      </label>
      <p className="fine-print">Official requirement: {requirement.width} × {requirement.height} px{requirement.maxBytes ? ` · up to ${Math.round(requirement.maxBytes / 1024)} KiB` : ""}. Cropping keeps original proportions.</p>
      {isSafeHttpUrl(requirement.sourceUrl) && <a href={requirement.sourceUrl} target="_blank" rel="noopener noreferrer">Check official image rules ↗</a>}
      <label className="select-field">Select image
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setOutputUrl(null); setMessage(""); }} />
      </label>
      <label className="select-field">Output format
        <select value={format} onChange={(event) => { setFormat(event.target.value as SafeImageType); setOutputUrl(null); }}>
          {outputFormats(requirement).map((type) => <option key={type} value={type}>{extension[type].toUpperCase()}</option>)}
        </select>
      </label>
      <label className="select-field">Crop horizontal: {x}%
        <input type="range" min="0" max="100" value={x} onChange={(event) => setX(Number(event.target.value))} />
      </label>
      <label className="select-field">Crop vertical: {y}%
        <input type="range" min="0" max="100" value={y} onChange={(event) => setY(Number(event.target.value))} />
      </label>
      <button type="button" className="button-quiet" disabled={!file || busy} onClick={process}>{busy ? "Processing…" : "Resize in this browser"}</button>
      {message && <p role="status" className="fine-print">{message}</p>}
      {outputUrl && <div><img src={outputUrl} alt="Resized image preview" style={{ maxWidth: 240, maxHeight: 240, display: "block", marginBlock: 12 }} /><a className="button-quiet" href={outputUrl} download={outputName}>Download image</a></div>}
      <p className="fine-print">Image stays in this browser. Dimensions and file size can be checked here; authority acceptance cannot be guaranteed.</p>
    </div>
  );
}

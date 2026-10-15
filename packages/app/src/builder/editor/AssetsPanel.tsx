import { type AssetInfo, assetUrl, toAssetName } from "@interactive-displays/core";
import { useRef, useState } from "react";
import { api } from "../../tools/api.ts";
import { ConfirmDialog } from "../../tools/Dialog.tsx";
import { newWidget } from "./editing.ts";
import { useEditor } from "./EditorContext.ts";
import { useInsert } from "./useInsert.ts";

const size = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// The show's pictures and videos: upload, add to the screen, delete.
export const AssetsPanel = () => {
  const { assets, refreshAssets, notify } = useEditor();
  const insert = useInsert();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<AssetInfo | undefined>(undefined);

  const upload = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    for (const file of files) {
      const name = toAssetName(file.name);
      if (!name) {
        notify(`${file.name}: only PNG, JPEG, WebP, GIF, SVG, MP4 and WebM files can be uploaded`, "danger");
        continue;
      }
      const result = await api("PUT", `/api/assets/${name}`, undefined, { type: file.type || "application/octet-stream", data: file });
      notify(result.ok ? `Uploaded ${name}` : `${file.name}: ${result.error}`, result.ok ? "info" : "danger");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    refreshAssets();
  };

  const remove = async (asset: AssetInfo) => {
    const result = await api("DELETE", `/api/assets/${asset.name}`);
    if (!result.ok) notify(result.error, "danger");
    refreshAssets();
  };

  return (
    <section className="palette-group assets">
      <label className="tool-button tool-button--small assets__upload" data-busy={busy}>
        {busy ? "Uploading…" : "Upload files"}
        <input
          ref={input}
          type="file"
          accept="image/*,video/mp4,video/webm"
          multiple
          className="visually-hidden"
          onChange={(event) => void upload(event.target.files)}
        />
      </label>
      {assets.length === 0 ? <p className="panel-empty">No files yet. Upload pictures, schematics or video.</p> : null}
      <ul className="assets__list">
        {assets.map((asset) => (
          <li key={asset.name} className="asset">
            <div className="asset__preview">
              {asset.kind === "image" ? <img src={assetUrl(asset.name)} alt="" loading="lazy" /> : <span>▶</span>}
            </div>
            <div className="asset__info">
              <span className="asset__name">{asset.name}</span>
              <span className="asset__size">{size(asset.size)}</span>
            </div>
            {asset.kind === "image" ? (
              <button
                type="button"
                className="tool-button tool-button--small"
                aria-label={`Add ${asset.name}`}
                onClick={() => insert((taken) => newWidget("image", taken, { asset: asset.name, fit: "contain" }))}
              >
                Add
              </button>
            ) : null}
            <button
              type="button"
              className="tool-button tool-button--small tool-button--quiet"
              aria-label={`Delete ${asset.name}`}
              onClick={() => setDeleting(asset)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirm="Delete"
          danger
          onConfirm={() => void remove(deleting)}
          onClose={() => setDeleting(undefined)}
        >
          <p>Screens that use it show an empty space until it is uploaded again.</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
};

// On disk, images live beside the project. In memory/export they remain portable data URLs.
export async function transformAssets(
  value: unknown,
  transform: (value: string) => Promise<string>,
): Promise<unknown> {
  if (typeof value === "string") return transform(value);
  if (Array.isArray(value))
    return Promise.all(value.map((v) => transformAssets(v, transform)));
  if (value && typeof value === "object") {
    const pairs = await Promise.all(
      Object.entries(value).map(async ([k, v]) => [
        k,
        await transformAssets(v, transform),
      ]),
    );
    return Object.fromEntries(pairs);
  }
  return value;
}
export async function externalizeAssets(
  directory: FileSystemDirectoryHandle,
  project: unknown,
) {
  const pending = new Map<string, Promise<string>>();
  return transformAssets(project, (value) => {
    if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(value))
      return Promise.resolve(value);
    if (!pending.has(value))
      pending.set(
        value,
        (async () => {
          const blob = await (await fetch(value)).blob();
          const bytes = await blob.arrayBuffer();
          const hash = [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          ]
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
          const extension =
            blob.type === "image/jpeg" ? "jpg" : blob.type.split("/")[1];
          const filename = `wd_${hash}.${extension}`;
          const assets = await directory.getDirectoryHandle("assets", {
            create: true,
          });
          try {
            await assets.getFileHandle(filename);
          } catch (e) {
            if (!(e instanceof DOMException) || e.name !== "NotFoundError")
              throw e;
            const file = await assets.getFileHandle(filename, { create: true });
            const writer = await file.createWritable();
            await writer.write(blob);
            await writer.close();
          }
          return `assets/${filename}`;
        })(),
      );
    return pending.get(value)!;
  });
}
export async function hydrateAssets(
  directory: FileSystemDirectoryHandle,
  project: unknown,
  onMissing?: (asset: string) => void,
) {
  const pending = new Map<string, Promise<string>>();
  return transformAssets(project, (value) => {
    if (!value.startsWith("assets/wd_")) return Promise.resolve(value);
    if (!/^assets\/wd_[a-zA-Z0-9_-]+\.(png|jpg|webp|gif)$/.test(value))
      return Promise.reject(new Error("Unsafe asset reference"));
    if (!pending.has(value))
      pending.set(
        value,
        (async () => {
          let file: File;
          try {
            const assets = await directory.getDirectoryHandle("assets");
            const handle = await assets.getFileHandle(value.slice(7));
            file = await handle.getFile();
          } catch (error) {
            if (error instanceof DOMException && error.name === "NotFoundError") {
              onMissing?.(value);
              return value;
            }
            throw error;
          }
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })(),
      );
    return pending.get(value)!;
  });
}

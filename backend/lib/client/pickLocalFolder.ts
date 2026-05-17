export type LocalFolderPick = {
  /** Текст за полето (име на папка или относителен път). */
  displayPath: string;
  directoryHandle?: FileSystemDirectoryHandle;
};

function rootFromWebkitRelativePath(relativePath: string): string {
  const norm = relativePath.replace(/\\/g, "/");
  const slash = norm.indexOf("/");
  return slash >= 0 ? norm.slice(0, slash) : norm;
}

/** Отваря системен диалог за избор на папка (Chrome/Edge) или fallback. */
export async function pickLocalFolder(): Promise<LocalFolderPick | null> {
  if (typeof window === "undefined") return null;

  if ("showDirectoryPicker" in window) {
    try {
      const handle = await (
        window as Window & { showDirectoryPicker: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker({ mode: "readwrite" });
      return { displayPath: handle.name, directoryHandle: handle };
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return null;
      throw e;
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.multiple = true;
    input.style.cssText = "position:fixed;left:-9999px;opacity:0";
    input.onchange = () => {
      const files = input.files;
      input.remove();
      if (!files?.length) {
        resolve(null);
        return;
      }
      const rel = files[0].webkitRelativePath || files[0].name;
      resolve({ displayPath: rootFromWebkitRelativePath(rel) });
    };
    document.body.appendChild(input);
    input.click();
  });
}

export async function writeBlobToDirectory(
  handle: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob,
): Promise<void> {
  const requestPermission = (
    handle as FileSystemDirectoryHandle & {
      requestPermission?: (opts: { mode: "readwrite" | "read" }) => Promise<PermissionState>;
    }
  ).requestPermission;
  if (requestPermission) {
    const perm = await requestPermission.call(handle, { mode: "readwrite" });
    if (perm !== "granted") {
      throw new Error("Няма разрешение за запис в избраната папка.");
    }
  }
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export function isLocalFolderPickerSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "showDirectoryPicker" in window;
}

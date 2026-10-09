import { useCallback, useEffect, useState } from "react";

const DB_NAME = "mars-trade-journal";
const STORE_NAME = "trade-screenshots";
const DB_VERSION = 1;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export type LocalScreenshot = {
  id: string;
  tradeId: number;
  name: string;
  type: string;
  blob: Blob;
  createdAt: string;
};

export type LocalScreenshotPreview = LocalScreenshot & {
  previewUrl: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
      store.createIndex("tradeId", "tradeId", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local screenshot storage."));
  });
}

export async function getScreenshots(tradeId?: number): Promise<LocalScreenshot[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = tradeId === undefined ? store.getAll() : store.index("tradeId").getAll(tradeId);
    request.onsuccess = () => {
      database.close();
      resolve((request.result as LocalScreenshot[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error("Could not read local screenshots."));
    };
  });
}

async function putScreenshot(screenshot: LocalScreenshot): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(screenshot);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save local screenshot."));
    };
  });
}

async function deleteScreenshot(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not remove local screenshot."));
    };
  });
}

export async function clearScreenshotsForTrade(tradeId: number): Promise<void> {
  const screenshots = await getScreenshots(tradeId);
  await Promise.all(screenshots.map((screenshot) => deleteScreenshot(screenshot.id)));
}

function toPreview(screenshot: LocalScreenshot): LocalScreenshotPreview {
  return { ...screenshot, previewUrl: URL.createObjectURL(screenshot.blob) };
}

export function useLocalScreenshots(tradeId: number | null) {
  const [screenshots, setScreenshots] = useState<LocalScreenshotPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (tradeId === null) {
      setScreenshots([]);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const records = await getScreenshots(tradeId);
      setScreenshots((current) => {
        current.forEach((screenshot) => URL.revokeObjectURL(screenshot.previewUrl));
        return records.map(toPreview);
      });
    } catch {
      setError("Screenshots could not be loaded from this browser.");
    } finally {
      setIsLoading(false);
    }
  }, [tradeId]);

  useEffect(() => {
    void refresh();
    return () => {
      setScreenshots((current) => {
        current.forEach((screenshot) => URL.revokeObjectURL(screenshot.previewUrl));
        return [];
      });
    };
  }, [refresh]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    if (tradeId === null) return false;
    const selectedFiles = Array.from(files);
    if (!selectedFiles.length) return false;

    setIsUploading(true);
    setError("");
    try {
      for (const file of selectedFiles) {
        if (!file.type.startsWith("image/")) {
          throw new Error("Only image files can be attached.");
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error("Each screenshot must be 10 MB or smaller.");
        }
        await putScreenshot({
          id: crypto.randomUUID(),
          tradeId,
          name: file.name,
          type: file.type,
          blob: file,
          createdAt: new Date().toISOString(),
        });
      }
      await refresh();
      return true;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Screenshot upload failed.");
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [refresh, tradeId]);

  const remove = useCallback(async (id: string) => {
    setError("");
    try {
      await deleteScreenshot(id);
      await refresh();
    } catch {
      setError("Screenshot could not be removed.");
    }
  }, [refresh]);

  return { screenshots, isLoading, isUploading, error, addFiles, remove };
}
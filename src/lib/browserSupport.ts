/**
 * True when the File System Access API's directory picker is available
 * (Chrome/Edge/Opera) and no manual fallback override is set for testing.
 */
export function isFileSystemAccessSupported(): boolean {
  if ((window as unknown as Record<string, unknown>).__FORCE_FALLBACK__) {
    return false
  }
  return typeof window.showDirectoryPicker === 'function'
}

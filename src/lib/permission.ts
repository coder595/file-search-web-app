export type PermissionResult = 'granted' | 'prompt' | 'denied'

/** Silent check — safe to call on page load, never prompts the user. */
export function checkPermission(handle: FileSystemDirectoryHandle): Promise<PermissionResult> {
  return handle.queryPermission({ mode: 'read' }) as Promise<PermissionResult>
}

/**
 * Requests permission. Per the File System Access API spec this requires
 * transient user activation — only call this from a click handler (e.g. the
 * "Resume access" button), never automatically on page load.
 */
export function requestPermission(handle: FileSystemDirectoryHandle): Promise<PermissionResult> {
  return handle.requestPermission({ mode: 'read' }) as Promise<PermissionResult>
}

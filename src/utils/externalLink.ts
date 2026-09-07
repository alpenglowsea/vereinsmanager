/**
 * Robust helper to open external URLs from within Tauri desktop apps,
 * Electron wrappers, web browsers, or sandboxed iframes.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;

  // 1. Check Tauri v2 Opener Plugin
  try {
    const tauri = (window as any).__TAURI__;
    if (tauri?.opener?.openUrl) {
      await tauri.opener.openUrl(url);
      return true;
    }
  } catch (err) {
    console.warn('Tauri opener.openUrl failed, trying fallback:', err);
  }

  // 2. Check Tauri v1/v2 Shell Plugin
  try {
    const tauri = (window as any).__TAURI__;
    if (tauri?.shell?.open) {
      await tauri.shell.open(url);
      return true;
    }
  } catch (err) {
    console.warn('Tauri shell.open failed, trying fallback:', err);
  }

  // 3. Check Tauri core invoke directly
  try {
    const tauri = (window as any).__TAURI__;
    if (tauri?.core?.invoke) {
      await tauri.core.invoke('plugin:opener|open_url', { url });
      return true;
    }
  } catch (err) {
    console.warn('Tauri invoke opener failed, trying fallback:', err);
  }

  // 4. Check Electron environment
  try {
    const electron = (window as any).electron;
    if (electron?.shell?.openExternal) {
      await electron.shell.openExternal(url);
      return true;
    }
  } catch (err) {
    console.warn('Electron openExternal failed:', err);
  }

  // 5. Web / Browser standard window.open
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win && !win.closed) {
      return true;
    }
  } catch (err) {
    console.warn('window.open failed, trying anchor fallback:', err);
  }

  // 6. Anchor fallback
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
    return true;
  } catch (err) {
    console.error('All methods to open external URL failed:', err);
    return false;
  }
}

import CONFIG from '../config';

const BASE_URL = CONFIG.API_URL.replace('/api', '');

/**
 * Normalize avatar path to a full URL pointing to the actual server.
 * Avatar field in DB can be:
 *   - null / undefined
 *   - relative:  "uploads/avatars/foo.jpg"  or  "/uploads/avatars/foo.jpg"
 *   - full URL:  "http://localhost:9001/uploads/..."  (saved in dev)
 */
export default function avatarUrl(avatar) {
  if (!avatar) return null;

  // Already a full URL — strip any hostname and rebuild with current server
  if (avatar.startsWith('http')) {
    try {
      const url = new URL(avatar);
      // url.pathname = "/uploads/avatars/foo.jpg"
      const path = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
      return `${BASE_URL}/${path}`;
    } catch {
      return null;
    }
  }

  // Relative path — strip leading slash if present
  const path = avatar.startsWith('/') ? avatar.slice(1) : avatar;
  return `${BASE_URL}/${path}`;
}

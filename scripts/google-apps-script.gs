/**
 * Rander's Fashion Attire — Live Google Drive Catalog Feed (Google Apps Script)
 *
 * ONE-TIME SETUP (2 minutes, 100% free, no API keys or billing):
 * 1. Open https://script.google.com and click "New Project".
 * 2. Paste this entire file into Code.gs.
 * 3. Paste your Google Drive folder link into DRIVE_FOLDER_URL below.
 *    (Make sure the Drive folder is shared as "Anyone with the link -> Viewer"
 *    so customer browsers can load the photos directly from Google's CDN.)
 * 4. Click Deploy -> New deployment -> Type: Web app:
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. Copy the generated Web App URL (ends with /exec) and paste it into
 *    `config.js` under `appsScriptUrl`.
 *
 * Whenever you add, rename, or delete a photo or category folder in Google Drive,
 * your hosted catalog automatically polls and reflects the changes every 5 minutes!
 */

// Pre-configured with your Google Drive folder link ("rander fashion attire"):
const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1SFQXzCrRSn4I2ZS-bECrAMjcIIYjAzx6";

function extractFolderId(input) {
  if (!input) return "";
  const match = String(input).match(/[-\w]{25,}/);
  return match ? match[0] : String(input).trim();
}

function doGet(e) {
  try {
    const paramFolder = e && e.parameter && e.parameter.folder ? e.parameter.folder : DRIVE_FOLDER_URL;
    const folderId = extractFolderId(paramFolder);
    if (!folderId || folderId === "PASTE_YOUR_GOOGLE_DRIVE_FOLDER_LINK_HERE") {
      return jsonResponse({ error: "DRIVE_FOLDER_URL is not configured in Apps Script." });
    }

    const rootFolder = DriveApp.getFolderById(folderId);
    const subFoldersIter = rootFolder.getFolders();
    const categories = [];

    while (subFoldersIter.hasNext()) {
      const folder = subFoldersIter.next();
      if (folder.isTrashed()) continue;

      const folderName = folder.getName().trim();
      const filesIter = folder.getFiles();
      const photos = [];

      while (filesIter.hasNext()) {
        const file = filesIter.next();
        if (file.isTrashed()) continue;

        const mime = (file.getMimeType() || "").toLowerCase();
        const name = file.getName();
        const isImage =
          mime.indexOf("image/") === 0 ||
          /\.(png|jpe?g|webp|heic|heif|dng|gif)$/i.test(name);

        if (!isImage) continue;

        const fileId = file.getId();
        photos.push({
          fileId: fileId,
          name: name,
          updatedAt: file.getLastUpdated().toISOString(),
          // Google's server-side image CDN automatically converts PNG/JPG/HEIC/DNG to fast web images
          thumb: "https://lh3.googleusercontent.com/d/" + fileId + "=w720",
          full: "https://lh3.googleusercontent.com/d/" + fileId + "=w1600",
        });
      }

      if (photos.length > 0) {
        photos.sort(function (a, b) {
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        categories.push({
          folderId: folder.getId(),
          rawName: folderName,
          photos: photos,
        });
      }
    }

    categories.sort(function (a, b) {
      return a.rawName.toLowerCase().localeCompare(b.rawName.toLowerCase());
    });

    return jsonResponse({
      source: "google-drive-live",
      folderId: folderId,
      syncedAt: new Date().toISOString(),
      categories: categories,
    });
  } catch (err) {
    return jsonResponse({ error: String(err && err.message ? err.message : err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

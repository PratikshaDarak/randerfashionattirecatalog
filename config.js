/**
 * Neha Rander's Fashion Attire — Lookbook & Line Sheet Configuration
 */
window.RANDER_CATALOG_CONFIG = {
  brandTitle: "Neha Artistry Hub",
  editionLine: "2026 Studio Archive · Hand-Painted Wearable Art",
  leadStatement:
    "Each saree, co-ord set, blouse, and shirt is painted individually by hand—an intimate archive curated for discerning clients, stylists, and boutique buyers.",

  // Automatic IST (Asia/Kolkata) theme schedule:
  // Daylight Atelier (light): 06:00 – 18:29 IST
  // Evening Gallery (dark):   18:30 – 05:59 IST
  istSchedule: {
    dayStartHour: 6,
    dayStartMinute: 0,
    nightStartHour: 18,
    nightStartMinute: 30,
  },

  // Connected Google Drive root folder (subfolders = categories, photos inside = looks)
  driveFolderUrl: "https://drive.google.com/drive/folders/1SFQXzCrRSn4I2ZS-bECrAMjcIIYjAzx6",

  // Auto-refresh interval in milliseconds (5 minutes = 300,000 ms)
  // Polls live Google Apps Script feed (if set) or hosted catalog-data.json for Drive changes
  refreshIntervalMs: 5 * 60 * 1000,

  // Social Link (deep-links to installed Instagram app or Apple App Store / Google Play Store)
  social: {
    // Instagram handle without "@"
    instagramUsername: "neha_artistry_hub",
  },

  // Optional: Google Apps Script Web App URL for direct 5-min live refresh straight from Drive
  appsScriptUrl: "",
};

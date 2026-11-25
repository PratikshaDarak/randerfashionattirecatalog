#!/usr/bin/env python3
"""
Zero-Credential Public Google Drive -> Self-Contained Static HTML Catalog Mirror
for Rander's Fashion Attire.

- Reads a publicly shared Google Drive folder link ("Anyone with the link -> Viewer").
- Uses each subfolder's EXACT Drive folder name (trimmed) as the catalog category.
- Downloads any newly added photos (including HEIC/DNG via Google's converter),
  optimizes them into local same-origin WebP thumbnails (`<=720px`) and full-res
  images (`<=1440px`) keyed by Drive file ID, and DELETES any local photos or
  category folders removed from Google Drive.
- Regenerates `catalog/catalog-data.js` and `catalog/catalog-data.json`.

Usage:
    python3 scripts/sync-public-drive.py
    python3 scripts/sync-public-drive.py "https://drive.google.com/drive/folders/1SFQXzCrRSn4I2ZS-bECrAMjcIIYjAzx6"
"""

import base64
import concurrent.futures
import datetime
import io
import json
import os
import re
import shutil
import sys
import urllib.request
from pathlib import Path
from PIL import Image, ImageOps

REPO_ROOT = Path(__file__).resolve().parent.parent
CATALOG_DIR = REPO_ROOT
THUMBS_DIR = CATALOG_DIR / "images" / "thumbs"
FULL_DIR = CATALOG_DIR / "images" / "full"
DEFAULT_DRIVE_URL = "https://drive.google.com/drive/folders/1SFQXzCrRSn4I2ZS-bECrAMjcIIYjAzx6"

# Optional sizing/fabric/care hints matched by normalized folder name.
# Display names ALWAYS come directly from the Google Drive folder name itself.
CATEGORY_HINTS = {
    "saree": {
        "code": "SAR",
        "sizing": "saree",
        "tagline": "Hand-painted drapes in flowing silks, cottons & organza",
        "fabric": "Breathable handloom cotton, mulmul, or organza with hand-painted textile pigments.",
        "care": "Gentle dry clean recommended for first wash; soft cold hand wash separately thereafter. Iron on reverse.",
    },
    "cord sets": {
        "code": "CRD",
        "sizing": "apparel",
        "tagline": "Statement matching sets with bold artisanal brushwork",
        "fabric": "Soft premium cotton & linen-blend tailored two-piece sets painted by hand.",
        "care": "Mild cold hand wash inside out with gentle detergent. Shade dry; iron on reverse over painted artwork.",
    },
    "one peiece": {
        "code": "ONE",
        "sizing": "apparel",
        "tagline": "Effortless silhouettes elevated with original wearable art",
        "fabric": "Lightweight breathable cotton & rayon silhouettes finished with wash-fast fabric art.",
        "care": "Gentle cold wash separately, inside out. Do not wring or bleach; steam or iron on reverse.",
    },
    "shirts": {
        "code": "SHT",
        "sizing": "apparel",
        "tagline": "Contemporary button-downs & relaxed shirts with custom motifs",
        "fabric": "Crisp breathable cotton & cotton-linen shirting with hand-painted artistic detailing.",
        "care": "Cold gentle hand wash inside out. Avoid direct scrubbing on artwork; iron on reverse.",
    },
    "women's shirt": {
        "code": "WSH",
        "sizing": "apparel",
        "tagline": "Tailored women's shirts accented with bespoke hand-painted artwork",
        "fabric": "Soft breathable cotton & cotton-linen shirting with hand-painted detailing.",
        "care": "Cold gentle hand wash inside out. Dry in shade; iron on reverse.",
    },
    "women's t-shirt": {
        "code": "TSH",
        "sizing": "apparel",
        "tagline": "Everyday cotton tees transformed into one-of-a-kind canvases",
        "fabric": "100% soft combed cotton jersey painted with flexible, crack-resistant fabric colors.",
        "care": "Cold gentle wash inside out. Dry in shade; iron on reverse side only.",
    },
    "men's t-shirt": {
        "code": "MTS",
        "sizing": "apparel",
        "tagline": "Relaxed cotton tees featuring bold original studio brushwork",
        "fabric": "100% combed cotton jersey hand-painted with flexible wash-fast pigments.",
        "care": "Cold gentle wash inside out. Shade dry; iron on reverse.",
    },
    "short kurti for denims": {
        "code": "KRT",
        "sizing": "apparel",
        "tagline": "Indo-western tunics crafted to pair effortlessly with denim",
        "fabric": "Pure soft cotton & slub-cotton kurtis featuring hand-painted floral and folk artwork.",
        "care": "Gentle cold wash separately. Shade dry and press on reverse.",
    },
    "kurta-pant set": {
        "code": "KPS",
        "sizing": "apparel",
        "tagline": "Graceful matching kurta and trouser ensembles painted by hand",
        "fabric": "Breathable pure cotton & chanderi kurta sets finished with artisanal brushwork.",
        "care": "Gentle cold hand wash separately inside out or dry clean. Iron on reverse.",
    },
    "kaftan": {
        "code": "KFT",
        "sizing": "apparel",
        "tagline": "Breezy resort & festive kaftans adorned with fluid hand-painted motifs",
        "fabric": "Airy mulmul, cotton, or crepe kaftans painted individually by hand.",
        "care": "Gentle cold hand wash separately. Dry in shade; steam or iron on reverse.",
    },
    "lehenga": {
        "code": "LHG",
        "sizing": "apparel",
        "tagline": "Statement festive lehengas featuring heirloom-inspired hand painting",
        "fabric": "Fine silk blends, organza & handloom cotton tailored for celebratory occasions.",
        "care": "Dry clean only to preserve drape, structure, and intricate brushwork.",
    },
    "couple dresses": {
        "code": "CPL",
        "sizing": "couple",
        "tagline": "Coordinated hand-painted ensembles for celebrations & travel",
        "fabric": "Matching artisanal cotton & denim ensembles custom-painted as coordinated pairs.",
        "care": "Mild cold hand wash inside out or dry clean. Iron on reverse over painted regions.",
    },
    "blouses": {
        "code": "BLS",
        "sizing": "blouse",
        "tagline": "Bespoke saree blouses with intricate hand-painted backs & sleeves",
        "fabric": "Fine cotton silk, raw silk & handloom cotton tailored with bespoke painted motifs.",
        "care": "Dry clean recommended to preserve structure and vibrant brushwork.",
    },
    "dupatta": {
        "code": "DUP",
        "sizing": "dupatta",
        "tagline": "Graceful hand-painted drapes to elevate any festive or daily look",
        "fabric": "Airy cotton, chanderi, or organza dupattas adorned with original hand-painted motifs.",
        "care": "Dry clean or gentle cold hand wash separately. Dry flat in shade.",
    },
    "cotton fabric": {
        "code": "FAB",
        "sizing": "saree",
        "tagline": "Unstitched artisanal hand-painted yardage for custom tailoring",
        "fabric": "100% pure breathable handloom cotton painted by hand with wash-fast pigments.",
        "care": "Cold gentle wash separately before or after stitching. Iron on reverse.",
    },
}

IMAGE_EXT_RE = re.compile(r"\.(png|jpe?g|webp|heic|heif|dng|gif)$", re.IGNORECASE)
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"


def extract_folder_id(value: str) -> str:
    m = re.search(r"[-\w]{25,}", value or "")
    return m.group(0) if m else (value or "").strip()


def normalize_key(name: str) -> str:
    return name.strip().replace("\u2019", "'").replace("\u2018", "'").lower()


def slugify(name: str, fallback: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", normalize_key(name)).strip("-")
    return s or fallback


def build_category_meta(raw_name: str, idx: int) -> dict:
    # Always preserve the exact Google Drive folder name (trimmed of trailing spaces)
    exact_name = raw_name.strip()
    key = normalize_key(exact_name)
    hint = CATEGORY_HINTS.get(key, {})
    letters = "".join(c for c in exact_name.upper() if c.isalpha())
    return {
        "name": exact_name,
        "slug": slugify(exact_name, f"cat-{idx + 1}"),
        "code": hint.get("code") or letters[:3] or f"C{idx + 1:02d}",
        "sizing": hint.get("sizing", "apparel"),
        "tagline": hint.get("tagline", f"Hand-painted {exact_name} collection from Rander's Fashion Attire"),
        "fabric": hint.get("fabric", "Premium breathable fabric finished with hand-painted wash-fast textile art."),
        "care": hint.get("care", "Gentle cold hand wash inside out or dry clean. Dry in shade and iron on reverse."),
    }


def list_public_drive_folder(folder_id: str) -> list:
    url = f"https://drive.google.com/drive/folders/{folder_id}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    html = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")
    m = re.search(r"window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'", html)
    if not m:
        return []
    raw = m.group(1).replace("\\x", "\\u00")
    decoded = json.loads('"' + raw.replace('"', '\\"') + '"')
    data = json.loads(decoded)
    return data[0] if data and data[0] else []


def download_and_optimize_drive_image(file_id: str, thumb_path: Path, full_path: Path) -> tuple[int, int]:
    """Download image from Google Drive CDN (auto-converts HEIC/DNG) and write local WebP thumb & full."""
    if thumb_path.exists() and full_path.exists():
        with Image.open(full_path) as existing:
            return existing.size

    cdn_url = f"https://lh3.googleusercontent.com/d/{file_id}=w1600"
    req = urllib.request.Request(cdn_url, headers={"User-Agent": USER_AGENT})
    raw_bytes = urllib.request.urlopen(req, timeout=30).read()

    with Image.open(io.BytesIO(raw_bytes)) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", im.size, (250, 247, 242))
            rgba = im.convert("RGBA")
            bg.paste(rgba, mask=rgba.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")

        full_path.parent.mkdir(parents=True, exist_ok=True)
        thumb_path.parent.mkdir(parents=True, exist_ok=True)

        full_im = im.copy()
        full_im.thumbnail((1440, 1440), Image.Resampling.LANCZOS)
        full_im.save(full_path, format="WEBP", quality=85, method=4)
        fw, fh = full_im.size

        thumb_im = full_im.copy()
        thumb_im.thumbnail((720, 720), Image.Resampling.LANCZOS)
        thumb_im.save(thumb_path, format="WEBP", quality=81, method=4)

        return fw, fh


def sync_from_public_drive(folder_url: str):
    folder_id = extract_folder_id(folder_url)
    if not folder_id:
        raise ValueError("Invalid Google Drive folder URL or ID.")

    print(f"Mirroring public Google Drive folder -> local catalog assets: {folder_id}")
    root_entries = list_public_drive_folder(folder_id)
    subfolders = [
        entry
        for entry in root_entries
        if len(entry) >= 4 and entry[3] == "application/vnd.google-apps.folder"
    ]
    subfolders.sort(key=lambda e: str(e[2]).strip().lower())

    if not subfolders:
        raise RuntimeError(
            f"No public category subfolders found inside folder {folder_id}. "
            "Check that the folder is shared as 'Anyone with the link -> Viewer'."
        )

    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    FULL_DIR.mkdir(parents=True, exist_ok=True)

    active_slugs = set()
    category_work = []
    download_tasks = []

    for f_idx, entry in enumerate(subfolders):
        sub_id, raw_name = entry[0], str(entry[2])
        meta = build_category_meta(raw_name, f_idx)
        children = list_public_drive_folder(sub_id)
        images = [
            c
            for c in children
            if len(c) >= 4
            and (
                str(c[3]).lower().startswith("image/")
                or bool(IMAGE_EXT_RE.search(str(c[2])))
            )
        ]
        images.sort(key=lambda c: str(c[2]).lower())

        if not images:
            print(f"  [EMPTY] {meta['name']:24s} — 0 photos (hidden until photos are added)")
            continue

        slug = meta["slug"]
        active_slugs.add(slug)
        expected_files = set()
        items_meta = []

        for idx, img in enumerate(images, start=1):
            file_id = img[0]
            file_name = str(img[2])
            webp_name = f"{file_id}.webp"
            expected_files.add(webp_name)

            thumb_rel = f"images/thumbs/{slug}/{webp_name}"
            full_rel = f"images/full/{slug}/{webp_name}"
            thumb_abs = CATALOG_DIR / thumb_rel
            full_abs = CATALOG_DIR / full_rel

            download_tasks.append((file_id, thumb_abs, full_abs))
            items_meta.append((idx, file_id, file_name, thumb_rel, full_rel))

        # Delete local photos removed from this Drive folder
        for base_dir in (THUMBS_DIR / slug, FULL_DIR / slug):
            if base_dir.exists():
                for existing in base_dir.iterdir():
                    if existing.is_file() and existing.name not in expected_files:
                        existing.unlink()

        category_work.append((sub_id, meta, items_meta))

    # Delete local category directories removed or emptied in Drive
    for base_dir in (THUMBS_DIR, FULL_DIR):
        for existing_dir in base_dir.iterdir():
            if existing_dir.is_dir() and existing_dir.name not in active_slugs:
                shutil.rmtree(existing_dir)

    # Download & convert missing images concurrently
    dims_by_id = {}
    new_count = sum(1 for _, t, f in download_tasks if not (t.exists() and f.exists()))
    print(f"Processing {len(download_tasks)} Drive images ({new_count} new to download, {len(download_tasks) - new_count} cached)...")

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        future_map = {
            pool.submit(download_and_optimize_drive_image, fid, t_abs, f_abs): fid
            for fid, t_abs, f_abs in download_tasks
        }
        for fut in concurrent.futures.as_completed(future_map):
            fid = future_map[fut]
            try:
                dims_by_id[fid] = fut.result()
            except Exception as exc:
                print(f"  [WARN] Failed to fetch Drive file {fid}: {exc}")

    categories_list = []
    products_list = []

    for order_idx, (sub_id, meta, items_meta) in enumerate(category_work):
        cat_products = []
        for idx, file_id, file_name, thumb_rel, full_rel in items_meta:
            if file_id not in dims_by_id:
                continue
            fw, fh = dims_by_id[file_id]
            design_code = f"RFA-{meta['code']}-{idx:02d}"
            cat_products.append(
                {
                    "id": design_code,
                    "code": design_code,
                    "driveFileId": file_id,
                    "title": f"{meta['name']} — Design {idx:02d}",
                    "category": meta["name"],
                    "categorySlug": meta["slug"],
                    "sizing": meta["sizing"],
                    "thumb": thumb_rel,
                    "full": full_rel,
                    "width": fw,
                    "height": fh,
                    "fabric": meta["fabric"],
                    "care": meta["care"],
                    "sourceFile": file_name,
                }
            )

        if not cat_products:
            continue

        cover_item = next((p for p in cat_products if p["height"] >= p["width"]), cat_products[0])
        categories_list.append(
            {
                "name": meta["name"],
                "slug": meta["slug"],
                "code": meta["code"],
                "driveFolderId": sub_id,
                "order": order_idx + 1,
                "count": len(cat_products),
                "tagline": meta["tagline"],
                "sizing": meta["sizing"],
                "cover": cover_item["thumb"],
            }
        )
        products_list.extend(cat_products)
        print(f"  [OK]    {meta['name']:24s} ({len(cat_products):2d} photos)")

    # Round-robin interleave across categories for the default Curated Mix
    by_cat = {c["slug"]: [] for c in categories_list}
    for p in products_list:
        by_cat[p["categorySlug"]].append(p)

    curated = []
    max_len = max((len(v) for v in by_cat.values()), default=0)
    for i in range(max_len):
        for c in categories_list:
            bucket = by_cat[c["slug"]]
            if i < len(bucket):
                curated.append(bucket[i])

    for idx, p in enumerate(curated):
        p["curatedOrder"] = idx

    # Pick 3 portrait hero items (prefer Saree, cord sets, one peiece if present)
    hero_picks = []
    for preferred in ("saree", "cord-sets", "one-peiece"):
        bucket = by_cat.get(preferred, [])
        pick = next((p for p in bucket if p["height"] >= p["width"]), bucket[0] if bucket else None)
        if pick:
            hero_picks.append(pick["id"])
    for p in curated:
        if len(hero_picks) >= 3:
            break
        if p["id"] not in hero_picks and p["height"] >= p["width"]:
            hero_picks.append(p["id"])

    payload = {
        "source": "google-drive-mirror",
        "driveFolderId": folder_id,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "totalProducts": len(curated),
        "categories": categories_list,
        "heroProductIds": hero_picks,
        "products": curated,
    }

    data_js = (
        "// Auto-synced from Google Drive by scripts/sync-public-drive.py\n"
        f"// Source folder: https://drive.google.com/drive/folders/{folder_id}\n"
        "window.RANDER_CATALOG_DATA = "
        + json.dumps(payload, indent=2, ensure_ascii=False)
        + ";\n"
    )
    (CATALOG_DIR / "catalog-data.js").write_text(data_js, encoding="utf-8")
    (CATALOG_DIR / "catalog-data.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    # Also build compact embedded WebP data-URI fallback map so sandboxed previews
    # (which inline static <script> files but block dynamic /images/ requests) show every photo.
    embedded_thumbs = {}
    for p in curated:
        thumb_file = CATALOG_DIR / p["thumb"]
        if thumb_file.exists():
            with Image.open(thumb_file) as im:
                small = im.copy()
                small.thumbnail((420, 420), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                small.save(buf, format="WEBP", quality=72, method=4)
                b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                embedded_thumbs[p["id"]] = f"data:image/webp;base64,{b64}"

    thumbs_js = (
        "// Auto-generated embedded WebP fallback thumbnails for sandboxed previews\n"
        "window.RANDER_EMBEDDED_THUMBS = "
        + json.dumps(embedded_thumbs, separators=(",", ":"))
        + ";\n"
    )
    (CATALOG_DIR / "catalog-thumbs.js").write_text(thumbs_js, encoding="utf-8")

    print(
        f"\nSynced {len(curated)} designs across {len(categories_list)} active categories "
        f"(local WebP + embedded preview bundle ready)."
    )


if __name__ == "__main__":
    target_url = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.environ.get("GOOGLE_DRIVE_FOLDER_URL") or DEFAULT_DRIVE_URL
    )
    sync_from_public_drive(target_url)

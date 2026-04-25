#!/bin/bash
# Human OS - BodyParts3D download script
# Downloads the BodyParts3D archive from DBCLS Japan
# Run from project root: bash scripts/download-bodyparts3d.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="$PROJECT_ROOT/assets/bodyparts3d-source"
ARCHIVE_FILE="$ASSETS_DIR/isa_BP3D_4.0_obj_99.zip"

echo "==========================================="
echo "BodyParts3D Asset Download"
echo "==========================================="
echo ""

mkdir -p "$ASSETS_DIR"
cd "$ASSETS_DIR"

# Try the FTP source first, fall back to GitHub mirror if FTP fails
FTP_URL="ftp://ftp.biosciencedbc.jp/archive/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip"
GITHUB_MIRROR="https://github.com/Kevin-Mattheus-Moerman/BodyParts3D"

if [ -f "$ARCHIVE_FILE" ]; then
  echo "Archive already exists at $ARCHIVE_FILE"
  echo "Skip download. Delete the file to re-download."
else
  echo "Downloading BodyParts3D from DBCLS FTP..."
  echo "URL: $FTP_URL"
  echo "Size: approximately 130 MB"
  echo ""
  
  # Try curl first, then wget
  if command -v curl &> /dev/null; then
    if curl -L -o "$ARCHIVE_FILE" "$FTP_URL" 2>&1 | grep -q "error\|fail"; then
      echo ""
      echo "FTP download failed. Trying GitHub mirror as fallback..."
      echo "Note: GitHub mirror has STL files, not OBJ. Convert script handles both."
      
      if [ -d "$ASSETS_DIR/BodyParts3D-mirror" ]; then
        rm -rf "$ASSETS_DIR/BodyParts3D-mirror"
      fi
      
      git clone --depth 1 "$GITHUB_MIRROR" "$ASSETS_DIR/BodyParts3D-mirror"
      echo "Cloned GitHub mirror to: $ASSETS_DIR/BodyParts3D-mirror"
    fi
  elif command -v wget &> /dev/null; then
    wget -O "$ARCHIVE_FILE" "$FTP_URL" || {
      echo ""
      echo "FTP download failed. Trying GitHub mirror as fallback..."
      git clone --depth 1 "$GITHUB_MIRROR" "$ASSETS_DIR/BodyParts3D-mirror"
    }
  else
    echo "ERROR: Neither curl nor wget is installed."
    exit 1
  fi
fi

# Extract if we got the FTP archive
if [ -f "$ARCHIVE_FILE" ]; then
  echo ""
  echo "Extracting archive..."
  
  if [ -d "$ASSETS_DIR/extracted" ]; then
    echo "Already extracted. Skip."
  else
    mkdir -p "$ASSETS_DIR/extracted"
    cd "$ASSETS_DIR/extracted"
    unzip -q "$ARCHIVE_FILE"
    echo "Extracted to $ASSETS_DIR/extracted"
    
    # Show what we got
    echo ""
    echo "Contents:"
    ls -la "$ASSETS_DIR/extracted" | head -10
  fi
fi

echo ""
echo "==========================================="
echo "Download complete."
echo "==========================================="
echo ""
echo "Source files location: $ASSETS_DIR"
echo ""
echo "Required FMA IDs for Human OS:"
echo "  FMA7163  - Skin (body shell)"
echo "  FMA50801 - Brain"
echo "  FMA7088  - Heart"
echo "  FMA7197  - Liver"
echo "  FMA7198  - Pancreas"
echo "  FMA7204  - Right kidney"
echo "  FMA7203  - Left kidney"
echo "  FMA7493  - Skeleton"
echo ""
echo "Next step: python3 scripts/convert-meshes.py"
echo ""
echo "Attribution required when using these meshes:"
echo "  BodyParts3D, Copyright The Database Center for Life Science"
echo "  licensed by CC Attribution-Share Alike 2.1 Japan."
echo ""

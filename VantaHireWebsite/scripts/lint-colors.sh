#!/usr/bin/env bash
#
# Lint script to detect hardcoded colors in page files
# Run: npm run lint:colors
#
# This script counts usages of hardcoded Tailwind color classes
# that should be replaced with semantic tokens.
#
# Replacements:
#   text-white         -> text-foreground (in dark themes)
#   bg-white/*         -> bg-card / bg-background
#   text-slate-900     -> text-foreground
#   text-slate-500/600 -> text-muted-foreground
#   bg-slate-*         -> bg-muted / bg-card
#   border-slate-*     -> border-border
#   text-green-*       -> text-success-foreground
#   text-red-*         -> text-destructive
#   text-blue-*        -> text-info-foreground
#   text-yellow/amber-* -> text-warning-foreground
#   bg-[#xxx]          -> use semantic tokens
#

set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Count matches in pages using grep -E (extended regex)

# Gray palette (slate, gray, zinc, neutral)
GRAY_COUNT=$(grep -rEo '(text|bg|border)-(slate|gray|zinc|neutral)-[0-9]+' --include='*.tsx' client/src/pages 2>/dev/null | wc -l || echo 0)

# Status colors (red, green, blue, yellow, amber)
STATUS_COUNT=$(grep -rEo '(text|bg|border)-(red|green|blue|yellow|amber)-[0-9]+' --include='*.tsx' client/src/pages 2>/dev/null | wc -l || echo 0)

# White/black classes (with optional opacity modifiers)
WHITE_COUNT=$(grep -rEo '(text|bg|border)-white(/[0-9]+)?' --include='*.tsx' client/src/pages 2>/dev/null | wc -l || echo 0)
BLACK_COUNT=$(grep -rEo '(text|bg|border)-black(/[0-9]+)?' --include='*.tsx' client/src/pages 2>/dev/null | wc -l || echo 0)

# Inline hex in className (e.g., bg-[#1a1a2e])
INLINE_HEX_COUNT=$(grep -rEo '\[#[0-9A-Fa-f]{3,8}\]' --include='*.tsx' client/src/pages 2>/dev/null | wc -l || echo 0)

# Hex literals in style attributes or CSS
HEX_LITERAL_COUNT=$(grep -rEo '"#[0-9A-Fa-f]{3,8}"' --include='*.tsx' client/src/pages 2>/dev/null | wc -l || echo 0)

# Trim whitespace
GRAY_COUNT=$(echo "$GRAY_COUNT" | tr -d ' ')
STATUS_COUNT=$(echo "$STATUS_COUNT" | tr -d ' ')
WHITE_COUNT=$(echo "$WHITE_COUNT" | tr -d ' ')
BLACK_COUNT=$(echo "$BLACK_COUNT" | tr -d ' ')
INLINE_HEX_COUNT=$(echo "$INLINE_HEX_COUNT" | tr -d ' ')
HEX_LITERAL_COUNT=$(echo "$HEX_LITERAL_COUNT" | tr -d ' ')

COUNT=$((GRAY_COUNT + STATUS_COUNT + WHITE_COUNT + BLACK_COUNT + INLINE_HEX_COUNT + HEX_LITERAL_COUNT))

echo ""
echo "Hardcoded color analysis (pages):"
echo "  Gray palette (slate/gray):  $GRAY_COUNT"
echo "  Status colors (red/green):  $STATUS_COUNT"
echo "  White classes:              $WHITE_COUNT"
echo "  Black classes:              $BLACK_COUNT"
echo "  Inline hex [#...]:          $INLINE_HEX_COUNT"
echo "  Hex literals \"#...\":        $HEX_LITERAL_COUNT"
echo "  --------------------------------"
echo "  Total hardcoded colors:     $COUNT"
echo ""

# Threshold - lower this as you migrate
# Post-migration baseline: 239 (mainly brand-assets-page + dev-ui-gallery + intentional status colors)
THRESHOLD=300

if [ "$COUNT" -gt "$THRESHOLD" ]; then
  echo "⚠️  Warning: Hardcoded colors ($COUNT) exceed threshold ($THRESHOLD)"
  echo ""
  echo "Recommended replacements:"
  echo "  text-white        -> text-foreground (dark themes)"
  echo "  bg-white          -> bg-card / bg-background"
  echo "  bg-white/10       -> bg-muted/50 or bg-card/50"
  echo "  text-slate-900    -> text-foreground"
  echo "  text-slate-500    -> text-muted-foreground"
  echo "  bg-slate-100      -> bg-muted"
  echo "  border-slate-200  -> border-border"
  echo "  bg-[#hex]         -> use semantic token"
  echo ""
  exit 1
fi

echo "✓ Color lint passed (threshold: $THRESHOLD)"

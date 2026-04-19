#!/bin/bash
# Design System Setup Verification Script

echo "🔍 Verifying Design System Setup..."
echo ""

# Check if all theme files exist
echo "✓ Checking theme files..."
files=(
  "src/theme/palette.ts"
  "src/theme/typography.ts"
  "src/theme/theme.ts"
  "src/theme/utilities.ts"
  "src/theme/constants.ts"
  "src/theme/styled.ts"
  "src/theme/useTheme.ts"
  "src/theme/types.ts"
  "src/theme/global.css"
  "src/theme/index.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (MISSING)"
  fi
done

echo ""
echo "✓ Checking configuration files..."
configs=(
  "vite.config.ts"
  "tsconfig.app.json"
  "package.json"
  "src/main.tsx"
)

for config in "${configs[@]}"; do
  if [ -f "$config" ]; then
    echo "  ✅ $config"
  else
    echo "  ❌ $config (MISSING)"
  fi
done

echo ""
echo "✓ Checking documentation..."
docs=(
  "src/theme/DESIGN_SYSTEM.md"
  "src/theme/README.md"
  "SETUP_GUIDE.md"
  "READY_FOR_DEVELOPMENT.md"
  "DESIGN_SYSTEM_SETUP_COMPLETE.md"
  "DESIGN_REFERENCE_CARD.md"
)

for doc in "${docs[@]}"; do
  if [ -f "$doc" ]; then
    echo "  ✅ $doc"
  else
    echo "  ❌ $doc (MISSING)"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎨 Design System Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. npm install"
echo "2. npm run dev"
echo "3. Read src/theme/DESIGN_SYSTEM.md"
echo ""

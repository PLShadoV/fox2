Patch: components/StatTile.tsx

What it does
- Adds backward-compatible props so the component works whether you pass
  (title/subtitle) or (label/sub). This fixes the build error:
  "Property 'label' does not exist on type ..."

How to install
1) Unzip into your project root so that the file path becomes:
   <project-root>/components/StatTile.tsx
2) Overwrite the existing file.
3) Rebuild (vercel build) or run locally.

No other files need to change.

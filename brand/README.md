# Claude Continuity brand assets

The app icon is a Liquid Glass icon composed with [fresnel](https://github.com/kajisho5/fresnel) (`fresnel-icon` 0.2.2).

- `src/continuity.spec.json` + `src/track.svg`, `src/meter.svg`, `src/dot.svg`: the source. The C is the monthly credit meter (blue = used, beige = remaining) and the dot means "continued".
- `ClaudeContinuity.icon`: the Icon Composer bundle built from the spec.
- `appearances.png`: Default / Dark / Clear / Tinted preview sheet.

Regenerate:

```bash
cd brand/src
npx -y fresnel-icon@0.2.2 build continuity.spec.json -o ../ClaudeContinuity.icon
cd ..
npx -y fresnel-icon@0.2.2 render ClaudeContinuity.icon -s 1024 --mask squircle -o ../build/icon.png
npx -y fresnel-icon@0.2.2 render ClaudeContinuity.icon -s 256 --mask squircle -o ../src/assets/app-icon.png
npx -y fresnel-icon@0.2.2 render ClaudeContinuity.icon -s 64 --mask squircle -o ../public/favicon.png
npx -y fresnel-icon@0.2.2 render ClaudeContinuity.icon --sheet -o appearances.png
```

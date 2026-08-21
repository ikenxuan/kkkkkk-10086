# Third-Party Notices

This document supplements the project's license. It does not replace the
license terms, notices, attribution requirements, or trademark policies of
the third-party projects and assets listed below.

## `@karinjs/template-react` style bridge

- Source: <https://github.com/KarinJS/template-react>
- Package reviewed: `@karinjs/template-react` `0.0.1-beta.5`
- Authors declared by the package: ikenxuan, KarinJS Team
- License declared by the package: MIT

`ktr/template/yunzai-base.css` is a modified local copy of the minimal style
bridge from `@karinjs/template-react/styles`. It connects HeroUI styles and
the class-driven dark variant to the poster build. The Yunzai runtime does not
depend on `@karinjs/template-react`. HeroUI itself remains subject to the
license distributed with the installed `@heroui/styles` package.

## Fonts

This migration does not add or download font binaries. It reuses font files
that were already present in this repository:

- `resources/font/HarmonyOS_SansSC_Regular.woff2` supplies the poster sans
  face and is emitted as a local Vite build asset.
- `ktr/font/mono/` supplies the JetBrains Mono faces used for monospaced text.
- `ktr/font/bilifont/` and `ktr/font/fansmedal-num/` supply the existing
  Bilibili-specific glyph and numeric faces.

No standalone license text for those checked-in font binaries was identified
alongside the assets during this migration. Their names and locations are
recorded here for provenance only. Neither this notice nor the project's
license grants additional rights to those fonts; distributors must verify the
applicable upstream font terms before redistributing the binaries.

## Icons and brand marks

The migrated React templates import icon components from the installed npm
packages `lucide-react`, `@phosphor-icons/react`, and
`@icons-pack/react-simple-icons`. This migration does not copy those package
sources into the local font implementation. Each package remains governed by
the license and notices distributed with that package.

Simple Icons and other platform logos may represent third-party trademarks.
An open-source code or icon license does not grant trademark rights. Custom or
platform-specific images and SVGs already present in this repository are not
relicensed by this notice.

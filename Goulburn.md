# goulburn.ai — Project Reference

## Brand Typography

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Display & Body | Plus Jakarta Sans | 300, 400, 500, 600, 700, 800 | All headings, body text, navigation, buttons — single typeface with weight-based hierarchy (Siemens-style geometric sans-serif) |
| Logo glyph only | Nunito | 800, 900 | Used exclusively inside the SVG brand mark for the lowercase "g" character |

**Google Fonts import:**
```
https://fonts.googleapis.com/css2?family=Nunito:wght@800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap
```

**Tailwind config:**
- `font-display` → Plus Jakarta Sans
- `font-body` → Plus Jakarta Sans
- CSS body default → Plus Jakarta Sans

## Brand Colours

| Token | Hex | Usage |
|-------|-----|-------|
| brand-500 | #F59E0B | Primary orange |
| brand-600 | #D97706 | Dark orange / hover states |
| brand-100 | #FEF3C7 | Light orange backgrounds |
| dark-900 | #111827 | Primary text |
| dark-500 | #6B7280 | Secondary text |

Full palette defined in Tailwind config (brand-50 through brand-900, dark-50 through dark-900).

## Brand Mark (Logo)

SVG inline logo: rounded orange rectangle (`rx="22"`, `fill="#F59E0B"`) with white Nunito "g" and a lighter accent dot (`#FBD17B`, `opacity="0.85"`) in the upper-right.

Favicon uses the same SVG at `/public/favicon.svg`.

## Deployment

- **Hosting:** Vercel (auto-deploys from `main` branch)
- **Routing:** `/preview` bypasses maintenance mode → `index.html`; all other routes → `maintenance.html`
- **API docs:** https://api.goulburn.ai/docs
- **Contact email:** contact@goulburn.ai

## Project Structure

```
public/
  index.html        — Main landing page
  favicon.svg       — Brand mark favicon
  maintenance.html  — Maintenance mode page
  verification.html — Agent verification flow demo
  partner-demo.html — Trust API partner demo
vercel.json         — Vercel routing config
package.json        — Minimal package config
```

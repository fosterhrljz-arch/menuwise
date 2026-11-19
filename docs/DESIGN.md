# MenuWise 2.0 design and fidelity notes

## References and direction

The user requested Semrush and SparkToro as references. Their public sites were inspected for analytics hierarchy, approachable business language, white surfaces, vivid restrained accents and direct comparison. No logos, proprietary screens or invented performance claims were copied.

Two ImageGen concepts were created before implementation: `design-v2-overview.png` and `design-v2-pricing.png`. They guided the structure; application charts and figures are calculated from engine outputs, not baked into images.

## Design contract

- White 222 px sidebar; light blue-gray #f5f6fa canvas; dark navy text.
- Orange primary action (#d84b1a for legible white text), violet #6953d5 and blue charts; no green-dominated palette.
- Clear business question first, input/assumption distinction, conditional recommendation and signed monthly impact near the top.
- Four separate economic totals, threshold line chart, selectable bubble chart and actual alternatives table.
- Shared data in one place; four-field basic mode, advanced details when required.
- Pricing input column beside the calculated sensitivity chart; comparison, action steps and assumptions follow.
- English and Simplified Chinese use the same data and layout. Locally authored text remains unchanged.

## Fidelity ledger

| Concept / reference | Implemented evidence | Intentional adaptation |
|---|---|---|
| Overview sidebar, four cards, insight strip, two charts | `v2-overview-en.png` | Uses current accounting values and one meaningful profit line; no decorative historical series |
| Pricing inputs left, threshold chart right | `v2-pricing-en.png` | Continuous model lines, actual integer threshold, interactive quantity slider and negative differences |
| Violet/orange accents on airy white panels | Both desktop captures | Primary orange darkened for text contrast; no green semantics |
| Sample menu bubbles and table | Overview and menu module | Per-minute values are calculated, correcting concept-image approximations |
| Mobile workspace | `v2-mobile-overview.png` and `v2-mobile-pricing.png` | Stacked panels, compact navigation drawer; large tables scroll within their panel |
| Report | Sample English/Chinese PDFs | Print-specific sizing, page-break handling, complete saved assumptions and actual-result comparison |

The concept’s implied location and other invented details were omitted. The welcome page uses calculated sample bars, not stock imagery. Desktop screenshots and mobile screenshots were opened with the image viewer and inspected; PDF pages were rendered with bundled Poppler and inspected. Browser tests also checked horizontal page overflow.

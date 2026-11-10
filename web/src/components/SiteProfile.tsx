// A link's captured brand and site profile (docs/KNOWLEDGE.md §16): logo, colour swatches, fonts and what the site
// is, so the owner sees what the agents learnt. Everything shown is the site's own data: text only, colours only
// when they are plain #rrggbb, the logo only as a base64 data: image (an <img> runs no scripts).
import type { PaletteColor, SiteProfile } from "../lib/api.ts";

const HEX = /^#[0-9a-f]{6}$/i;
const LOGO = /^data:image\/(png|jpeg|webp|gif|svg\+xml|x-icon);base64,[A-Za-z0-9+/=]+$/;
const KIND_WORDS: Record<string, string> = {
  company: "Company",
  project: "Project",
  "research-paper": "Research paper",
  documentation: "Documentation",
  "e-commerce": "Online store",
  personal: "Personal site",
  news: "News",
  website: "Website",
};

/** The swatches to show: the profile's palette, else the colours read straight from the CSS. */
export function swatches(sp: SiteProfile): PaletteColor[] {
  const fromProfile = (sp.profile.palette ?? []).filter((c) => HEX.test(c.hex));
  if (fromProfile.length) return fromProfile.slice(0, 8);
  const c = sp.design.colors;
  return (["primary", "accent", "background", "text"] as const)
    .map((role) => ({ role, hex: c[role] ?? "" }))
    .filter((x) => HEX.test(x.hex));
}

export const safeLogo = (v?: string) => (v && v.length < 80_000 && LOGO.test(v) ? v : "");

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="sp-block">
      <h4>{title}</h4>
      <ul>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

export function SiteProfileView({ sp }: { sp: SiteProfile }) {
  const p = sp.profile;
  const logo = safeLogo(sp.logo_data);
  const colors = swatches(sp);
  const heading = p.typography?.heading || sp.design.fonts.heading || "";
  const body = p.typography?.body || sp.design.fonts.body || "";
  const captured = sp.captured_at ? new Date(sp.captured_at).toLocaleDateString() : "";
  return (
    <details className="siteprofile">
      <summary>
        Brand and site profile{p.name ? `: ${p.name}` : ""}
        <span className="mute"> · {KIND_WORDS[p.kind] ?? "Website"}</span>
      </summary>
      <div className="sp-head">
        {logo ? <img className="sp-logo" src={logo} alt={`${p.name || sp.brand} logo`} /> : null}
        <div>
          <b>{p.name || sp.brand}</b>
          {p.what_it_is ? <p>{p.what_it_is}</p> : null}
          {p.audience ? <p className="mute">For: {p.audience}</p> : null}
        </div>
      </div>

      {colors.length ? (
        <div className="sp-block">
          <h4>Brand colours</h4>
          <ul className="sp-swatches" aria-label="Brand colours">
            {colors.map((c) => (
              <li key={`${c.role}${c.hex}`}>
                <span className="sp-swatch" style={{ background: c.hex }} aria-hidden="true" />
                <span>
                  <b>{c.role}</b> <code>{c.hex}</code>
                  {c.note ? <span className="mute"> · {c.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {heading || body ? (
        <div className="sp-block">
          <h4>Fonts</h4>
          <p>
            {heading ? (
              <>
                Headings: <b>{heading}</b>
              </>
            ) : null}
            {heading && body ? " · " : null}
            {body ? (
              <>
                Body: <b>{body}</b>
              </>
            ) : null}
          </p>
          {p.typography?.notes ? <p className="mute">{p.typography.notes}</p> : null}
        </div>
      ) : null}

      {p.tone_of_voice ? (
        <div className="sp-block">
          <h4>Tone of voice</h4>
          <p>{p.tone_of_voice}</p>
        </div>
      ) : null}
      <List title="Offerings" items={p.offerings} />
      <List title="Key facts" items={p.key_facts} />
      <List title="Look and feel" items={p.layout_patterns} />
      {p.store ? (
        <List
          title="Store"
          items={[
            ...(p.store.categories?.length ? [`Categories: ${p.store.categories.join(", ")}`] : []),
            ...(p.store.price_range ? [`Prices: ${p.store.price_range}`] : []),
          ]}
        />
      ) : null}
      {p.paper ? (
        <List
          title="Paper"
          items={[
            ...(p.paper.title ? [p.paper.title] : []),
            ...(p.paper.authors?.length ? [`By ${p.paper.authors.join(", ")}`] : []),
            ...(p.paper.abstract ? [p.paper.abstract] : []),
            ...(p.paper.findings ?? []),
          ]}
        />
      ) : null}
      {p.docs ? (
        <List title="Documentation" items={[...(p.docs.product ? [p.docs.product] : []), ...(p.docs.concepts ?? [])]} />
      ) : null}
      <List
        title="Page structure"
        items={(sp.content?.outline ?? []).slice(0, 15).map((h) => `H${h.level} · ${h.text}`)}
      />
      <List title="Calls to action" items={sp.content?.ctas} />
      <List title="Pages read" items={(sp.pages ?? []).map((x) => x.title || x.url)} />
      <p className="mute sp-foot">
        {`Read from ${sp.brand}${captured ? ` on ${captured}` : ""}. Add the link again to refresh it.`}
      </p>
    </details>
  );
}

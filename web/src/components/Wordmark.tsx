// The logo (decision 169): the owner's own eye drawing (public/eye.svg, traced from their image) beside "VAIC"
// set plainly in capitals with open letter spacing. The eye is a mask filled with the HUD's text colour, so it is
// light on the dark theme and dark on the light one, with no tile or background behind it.
export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wm-eye" aria-hidden="true" />
      <span className="wm-word" aria-label="VAIC">
        VAIC
      </span>
    </span>
  );
}

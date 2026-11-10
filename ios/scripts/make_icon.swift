// Draws the app icon (1024×1024, no transparency): the owner's eye (decision 169), the web's logo
// (web/public/eye.svg), in white on black, as the owner drew it, 0.84 of the width and centred.
// Run from ios/: swift scripts/make_icon.swift
import AppKit

let size = 1024
let out = URL(fileURLWithPath: "AICity/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
guard let eye = NSImage(contentsOf: URL(fileURLWithPath: "../web/public/eye.svg")) else { fatalError("no eye.svg") }
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.setFillColor(CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))
// The eye as a mask, filled white.
let w = CGFloat(size) * 0.84, h = w * eye.size.height / eye.size.width
let r = CGRect(x: (CGFloat(size) - w) / 2, y: (CGFloat(size) - h) / 2, width: w, height: h)
var rr = r
let mask = eye.cgImage(forProposedRect: &rr, context: nil, hints: [.ctm: AffineTransform(scale: 1)])!
ctx.saveGState()
ctx.clip(to: r, mask: mask)
ctx.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
ctx.fill(r)
ctx.restoreGState()
// Flatten to RGB with no alpha channel (App Store icons must not have one).
let flat = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                     bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
flat.draw(ctx.makeImage()!, in: CGRect(x: 0, y: 0, width: size, height: size))
let rep = NSBitmapImageRep(cgImage: flat.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: out)
print("wrote \(out.path)")

// Draws the app icon (1024×1024, no transparency): AIC's eye (the owner's drawing, web/public/ace-eye.png)
// over a small pixel skyline in the City's colours. Run from ios/: swift scripts/make_icon.swift
import AppKit

let size = 1024
let eyeURL = URL(fileURLWithPath: "AICity/Assets.xcassets/AICEye.imageset/ace-eye.png")
let out = URL(fileURLWithPath: "AICity/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
guard let eye = NSImage(contentsOf: eyeURL)?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fatalError("no eye") }
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
func rgb(_ h: UInt32) -> CGColor { CGColor(srgbRed: CGFloat((h >> 16) & 255) / 255, green: CGFloat((h >> 8) & 255) / 255, blue: CGFloat(h & 255) / 255, alpha: 1) }
// Parchment sky.
ctx.setFillColor(rgb(0xf4ecd8)); ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))
// Skyline (y grows upward in CoreGraphics).
let blocks: [(Int, Int, Int, UInt32)] = [(60, 150, 260, 0x3b82ff), (230, 130, 200, 0xff7a45), (380, 260, 300, 0x3b82ff), (660, 130, 230, 0xf72585), (810, 160, 180, 0x06d6a0)]
ctx.setFillColor(rgb(0x8cc66d)); ctx.fill(CGRect(x: 0, y: 0, width: size, height: 120))
for (x, w, h, c) in blocks {
    ctx.setFillColor(rgb(0xe9d8a6)); ctx.fill(CGRect(x: x, y: 120, width: w, height: h))
    ctx.setFillColor(rgb(c)); ctx.fill(CGRect(x: x - 8, y: 120 + h, width: w + 16, height: 32))
    ctx.setFillColor(rgb(0xfff3b0))
    var wy = 150
    while wy < 120 + h - 30 { var wx = x + 20; while wx < x + w - 30 { ctx.fill(CGRect(x: wx, y: wy, width: 22, height: 22)); wx += 44 }; wy += 44 }
    ctx.setStrokeColor(rgb(0x2b1d14)); ctx.setLineWidth(6); ctx.stroke(CGRect(x: x, y: 120, width: w, height: h))
}
// The eye, in ink, large and centred above the town.
let ew = 780.0, eh = ew * Double(eye.height) / Double(eye.width)
let rect = CGRect(x: (Double(size) - ew) / 2, y: 520, width: ew, height: eh)
ctx.saveGState(); ctx.clip(to: rect, mask: eye); ctx.setFillColor(rgb(0x2b1d14)); ctx.fill(rect); ctx.restoreGState()
let img = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: img)
try! rep.representation(using: .png, properties: [:])!.write(to: out)
print("wrote \(out.path)")

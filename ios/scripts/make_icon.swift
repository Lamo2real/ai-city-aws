// Draws the app icon (1024×1024, no transparency): the VAIC mark of decision 159, a striped sunset with a skyline in
// front, filling the whole square (iOS rounds the corners itself), in the same 32-unit box as the web's
// Wordmark.tsx and favicon.svg. Run from ios/: swift scripts/make_icon.swift
import AppKit

let size = 1024
let out = URL(fileURLWithPath: "AICity/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
// Draw with y growing downward, as the web's SVG does.
ctx.translateBy(x: 0, y: CGFloat(size)); ctx.scaleBy(x: 1, y: -1)
func rgb(_ h: UInt32) -> CGColor { CGColor(srgbRed: CGFloat((h >> 16) & 255) / 255, green: CGFloat((h >> 8) & 255) / 255, blue: CGFloat(h & 255) / 255, alpha: 1) }
let k = CGFloat(size) / 32

// The sunset: #ffd98a at the top, #f2b33d at 55 %, #e07a3a at the bottom.
let sunset = CGGradient(colorsSpace: cs, colors: [rgb(0xffd98a), rgb(0xf2b33d), rgb(0xe07a3a)] as CFArray, locations: [0, 0.55, 1])!
ctx.drawLinearGradient(sunset, start: .zero, end: CGPoint(x: 0, y: CGFloat(size)), options: [])

// The stripes and the skyline, in the dark ink.
ctx.setFillColor(rgb(0x2a1a08))
for (y, h) in [(14.6, 1.1), (17.6, 1.5), (20.8, 1.9)] as [(CGFloat, CGFloat)] {
    ctx.fill(CGRect(x: 0, y: y * k, width: CGFloat(size), height: h * k))
}
let skyline: [(CGFloat, CGFloat)] = [
    (0, 32), (0, 24), (3.5, 24), (3.5, 21), (6, 21), (6, 24), (8, 24), (8, 15.5), (11.5, 15.5), (11.5, 24),
    (13, 24), (13, 9.5), (14.2, 9.5), (14.2, 7), (15.8, 7), (15.8, 9.5), (17, 9.5), (17, 24), (18.5, 24),
    (18.5, 18), (21.5, 18), (21.5, 24), (23, 24), (23, 15), (26.5, 15), (26.5, 24), (28.5, 24), (28.5, 21.5),
    (32, 21.5), (32, 32),
]
let path = CGMutablePath()
for (i, (x, y)) in skyline.enumerated() {
    let pt = CGPoint(x: x * k, y: y * k)
    if i == 0 { path.move(to: pt) } else { path.addLine(to: pt) }
}
path.closeSubpath()
ctx.addPath(path); ctx.fillPath()

let img = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: img)
try! rep.representation(using: .png, properties: [:])!.write(to: out)
print("wrote \(out.path)")

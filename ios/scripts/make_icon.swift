// Draws the app icon (1024×1024, no transparency): the VAIC tile of decisions 158 and 162, the same as the web's
// favicon (web/public/favicon.svg): the accent gradient filling the square (iOS rounds the corners itself) and the
// skyline in the accent ink, 0.75 of the size and centred, as the favicon's translate(3 3) scale(.75).
// Run from ios/: swift scripts/make_icon.swift
import AppKit

let size = 1024
let out = URL(fileURLWithPath: "AICity/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
// Draw with y growing downward, as the web's SVG does.
ctx.translateBy(x: 0, y: CGFloat(size)); ctx.scaleBy(x: 1, y: -1)
func rgb(_ h: UInt32) -> CGColor { CGColor(srgbRed: CGFloat((h >> 16) & 255) / 255, green: CGFloat((h >> 8) & 255) / 255, blue: CGFloat(h & 255) / 255, alpha: 1) }

// The accent gradient: #f9c976 at the top, #e8a33d at the bottom.
let amber = CGGradient(colorsSpace: cs, colors: [rgb(0xf9c976), rgb(0xe8a33d)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(amber, start: .zero, end: CGPoint(x: 0, y: CGFloat(size)), options: [])

// The skyline (the web's five paths in a 24-unit box): three buildings with rounded tops, the aerial, the ground.
let k = CGFloat(size) * 0.75 / 24, o = CGFloat(size) * 0.125
func box(_ x: CGFloat, _ top: CGFloat, _ w: CGFloat) -> CGRect {
    // Each building runs a little under the ground, so only its top corners show as rounded.
    CGRect(x: o + x * k, y: o + top * k, width: w * k, height: (22 - top) * k)
}
ctx.setFillColor(rgb(0x2a1a08))
for b in [box(3, 11.5, 5.2), box(9.4, 5.2, 5.2), box(15.8, 8.6, 5.2)] {
    ctx.addPath(CGPath(roundedRect: b, cornerWidth: k, cornerHeight: k, transform: nil))
}
ctx.addRect(CGRect(x: o + 11.6 * k, y: o + 2.4 * k, width: 0.8 * k, height: 2.8 * k)) // the aerial
ctx.addRect(CGRect(x: o + 2 * k, y: o + 21 * k, width: 20 * k, height: 1.2 * k)) // the ground
ctx.fillPath()

let img = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: img)
try! rep.representation(using: .png, properties: [:])!.write(to: out)
print("wrote \(out.path)")

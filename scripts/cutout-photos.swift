// Détourage des photos joueurs, en local sur le Mac (Vision, macOS 14+) : aucune photo ne part vers un service extérieur.
// Garde la plus grande personne détectée (le joueur, pas les gens derrière), fond transparent, carré 600 px,
// joueur centré et posé en bas. Usage : swift scripts/cutout-photos.swift data/photos-joueurs data/photos-joueurs-detourees
import AppKit
import CoreImage
import Vision

let args = CommandLine.arguments
guard args.count == 3 else { print("usage : swift cutout-photos.swift <dossier source> <dossier sortie>"); exit(1) }
let (src, dst) = (URL(fileURLWithPath: args[1]), URL(fileURLWithPath: args[2]))
try FileManager.default.createDirectory(at: dst, withIntermediateDirectories: true)
let side: CGFloat = 600
let ctx = CIContext()

func area(_ buffer: CVPixelBuffer) -> Int {
  CVPixelBufferLockBaseAddress(buffer, .readOnly); defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
  let (w, h, row) = (CVPixelBufferGetWidth(buffer), CVPixelBufferGetHeight(buffer), CVPixelBufferGetBytesPerRow(buffer))
  let base = CVPixelBufferGetBaseAddress(buffer)!.assumingMemoryBound(to: Float32.self)
  var n = 0
  for y in stride(from: 0, to: h, by: 4) { for x in stride(from: 0, to: w, by: 4) where base[y * row / 4 + x] > 0.5 { n += 1 } }
  return n
}

let files = try FileManager.default.contentsOfDirectory(at: src, includingPropertiesForKeys: nil)
  .filter { ["png", "jpg", "jpeg"].contains($0.pathExtension.lowercased()) }.sorted { $0.lastPathComponent < $1.lastPathComponent }
for file in files {
  // Orientation EXIF appliquée : les JPG d'appareil photo sont souvent pivotés
  guard let image = CIImage(contentsOf: file, options: [.applyOrientationProperty: true]) else { print("ILLISIBLE   \(file.lastPathComponent)"); continue }
  let handler = VNImageRequestHandler(ciImage: image)
  let request = VNGenerateForegroundInstanceMaskRequest()
  do { try handler.perform([request]) } catch { print("ÉCHEC       \(file.lastPathComponent) : \(error)"); continue }
  guard let obs = request.results?.first, !obs.allInstances.isEmpty else { print("PERSONNE    \(file.lastPathComponent) : aucun sujet détecté"); continue }
  let sizes = try obs.allInstances.map { ($0, area(try obs.generateScaledMaskForImage(forInstances: [$0], from: handler))) }
  let biggest = sizes.max { $0.1 < $1.1 }!
  let cut = CIImage(cvPixelBuffer: try obs.generateMaskedImage(ofInstances: [biggest.0], from: handler, croppedToInstancesExtent: true))
  let scale = min(side * 0.96 / cut.extent.height, side / cut.extent.width)
  let placed = cut.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
  let moved = placed.transformed(by: CGAffineTransform(translationX: (side - placed.extent.width) / 2 - placed.extent.minX, y: -placed.extent.minY))
  let canvas = moved.cropped(to: CGRect(x: 0, y: 0, width: side, height: side))
  let out = dst.appendingPathComponent(file.deletingPathExtension().lastPathComponent + ".png")
  try ctx.writePNGRepresentation(of: canvas, to: out, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
  let total = Double(image.extent.width * image.extent.height) / 16
  print("détourée    \(file.lastPathComponent) · \(sizes.count) sujet(s) · joueur \(Int(100 * Double(biggest.1) / total)) % de l'image")
}

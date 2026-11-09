// The files VAIC shows in the chat (show_files, docs/FILES.md §8), like web/src/components/FileCards.tsx: a preview
// (the image, a video player, a PDF's first page, or a card) and Download, which saves a copy and opens the share
// sheet (Save Image, Save to Files, AirDrop…). Addresses are fetched fresh when a card is drawn.
import AVKit
import PDFKit
import SwiftUI

struct FileCards: View {
    var files: [ChatFile]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(files.enumerated()), id: \.element.id) { i, f in
                FileCard(file: f, number: files.count > 1 ? i + 1 : nil)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(files.count > 1 ? "\(files.count) files VAIC found" : "A file VAIC found")
    }
}

struct FileCard: View {
    @Environment(AppModel.self) private var model
    var file: ChatFile
    var number: Int?
    @State private var links: FileLinks?
    @State private var problem: String?
    @State private var saving = false
    @State private var shareURL: URL?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topLeading) {
                FilePreview(file: file, links: links)
                if let number {
                    Text("\(number)")
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(Glass.accentInk)
                        .frame(minWidth: 28, minHeight: 28)
                        .background(Glass.accentFill, in: Capsule())
                        .padding(8)
                        .accessibilityLabel("Number \(number)")
                }
            }
            Text(file.name).font(.subheadline.weight(.bold)).foregroundStyle(Glass.text)
            Text(file.meta).font(.caption).foregroundStyle(Glass.mute)
            if let problem {
                Text(problem).font(.caption).foregroundStyle(Glass.badLight)
            }
            if links?.downloadURL != nil {
                Button {
                    Task { await download() }
                } label: {
                    if saving { ProgressView().tint(Glass.accentInk) } else { Text("Download") }
                }
                .buttonStyle(.glassPrimary)
                .disabled(saving)
                .accessibilityHint("Saves a copy: Save Image, Save to Files or share it")
            }
        }
        .padding(10)
        .glassTint(Glass.fill, radius: Glass.radiusSmall, edge: Glass.edge)
        .task(id: file.id) { await load() }
        .sheet(item: Binding(get: { shareURL.map(ShareItem.init) }, set: { if $0 == nil { shareURL = nil } })) { item in
            ShareSheet(items: [item.url])
        }
    }

    private func load() async {
        guard let api = model.api else { return }
        do {
            links = try await api.fileLinks(file.id)
        } catch let e as APIError where e.status == 404 {
            problem = "This file was deleted."
        } catch {
            problem = "The preview didn't load (\(error.localizedDescription)). Open Files on the web to see it."
        }
    }

    /// The file into a temporary folder under its own name, then the share sheet.
    private func download() async {
        guard let url = links?.downloadURL else { return }
        saving = true
        defer { saving = false }
        do {
            let (tmp, response) = try await URLSession.shared.download(from: url)
            if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                problem = "The download didn't work (the storage answered \(http.statusCode)). Try again."
                return
            }
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent(file.id, isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let dest = dir.appendingPathComponent(file.name.replacingOccurrences(of: "/", with: "-"))
            try? FileManager.default.removeItem(at: dest)
            try FileManager.default.moveItem(at: tmp, to: dest)
            shareURL = dest
        } catch {
            problem = "The download didn't work (\(error.localizedDescription)). Try again."
        }
    }
}

private struct ShareItem: Identifiable {
    let url: URL
    var id: String { url.path }
}

private struct ShareSheet: UIViewControllerRepresentable {
    var items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

/// The preview a file deserves.
struct FilePreview: View {
    var file: ChatFile
    var links: FileLinks?

    var body: some View {
        Group {
            if let links, let url = links.url {
                if file.kind == "image" {
                    AsyncImage(url: links.thumbURL ?? url) { phase in
                        if let img = phase.image {
                            img.resizable().scaledToFit()
                        } else if phase.error != nil {
                            placeholder("photo")
                        } else {
                            ProgressView().frame(maxWidth: .infinity, minHeight: 160)
                        }
                    }
                    .accessibilityLabel(links.description.isEmpty ? file.name : links.description)
                } else if file.kind == "video" {
                    VideoPlayer(player: AVPlayer(url: url)).frame(height: 220)
                        .accessibilityLabel("Video: \(file.name)")
                } else if file.kind == "audio" {
                    VideoPlayer(player: AVPlayer(url: url)).frame(height: 60)
                        .accessibilityLabel("Recording: \(file.name)")
                } else if links.isPDF {
                    PDFFirstPage(url: url).frame(height: 260)
                        .accessibilityLabel("First page of \(file.name)")
                } else {
                    placeholder("doc")
                }
            } else {
                Rectangle().fill(Glass.deep).frame(height: 160)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: 320)
        .clipShape(RoundedRectangle(cornerRadius: Glass.radiusSmall - 4, style: .continuous))
    }

    private func placeholder(_ symbol: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: symbol).font(.largeTitle).foregroundStyle(Glass.mute)
            Text("\(ChatFile.kindWord(file.kind)): no preview, download it to open.").font(.caption).foregroundStyle(Glass.mute)
        }
        .frame(maxWidth: .infinity, minHeight: 120)
        .background(Glass.deep)
    }
}

/// A PDF's first page, drawn by PDFKit from the downloaded document.
struct PDFFirstPage: View {
    var url: URL
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable().scaledToFit().background(Color.white) }
            else { ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity) }
        }
        .task(id: url) {
            guard let (data, _) = try? await URLSession.shared.data(from: url), let doc = PDFDocument(data: data),
                  let page = doc.page(at: 0) else { return }
            image = page.thumbnail(of: CGSize(width: 600, height: 800), for: .mediaBox)
        }
    }
}

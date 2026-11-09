// The + button beside the message box and its menu, in the style of Claude's own composer (the web HUD's
// PlusMenu.tsx, decision 106): add files or photos, add folders, slash commands, connectors and plugins
// (skills). The menu is a glass sheet that rises from the bottom; each list opens in place with a Back row.
// The pure parts (commands, the folder filter, the attached line) are in Core/Attach.swift.
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// The round glass + button; the sheet is presented by the screen that owns the box.
struct PlusButton: View {
    @Binding var open: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button { open = true } label: {
            Image(systemName: "plus")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(open ? Glass.amber : Glass.text)
                .rotationEffect(.degrees(open ? 45 : 0))
                .animation(reduceMotion ? nil : Glass.ease(Glass.durS), value: open)
                .frame(width: 44, height: 44)
                .glassTint(Glass.fill2, radius: 22, edge: Glass.edge2)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add to your message")
    }
}

/// What the menu puts into the box: a command in front (replacing one already there), other words at the end.
struct MenuInsert: Equatable {
    var words: String
    var atStart: Bool
}

struct PlusMenuSheet: View {
    enum Page { case main, files, slash, connectors, plugins }

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    /// Files picked from Files or a folder (security-scoped URLs, read by the caller) and photos from the library.
    var onURLs: ([URL], _ fromFolder: Bool) -> Void
    var onPhotos: ([PhotosPickerItem]) -> Void
    var onInsert: (MenuInsert) -> Void

    @State private var page: Page = .main
    @State private var photos: [PhotosPickerItem] = []
    @State private var pickingPhotos = false
    @State private var pickingFiles = false
    @State private var pickingFolder = false

    var body: some View {
        let commands = Slash.allCommands(model.skills)
        let skills = model.skills.filter(\.enabled)
        let connectors = model.connectors
        ScrollView {
            VStack(spacing: 2) {
                switch page {
                case .main:
                    MenuRow(symbol: "doc.on.doc", label: "Add files or photos", hint: "Kept in Knowledge; VAIC reads them with your message", more: true) { page = .files }
                    MenuRow(symbol: "folder", label: "Add folders", hint: "Every file inside, up to \(Attach.maxFolderFiles)") { pickingFolder = true }
                    MenuRow(symbol: "command", label: "Slash commands", hint: "Quick things to say", more: true) { page = .slash }
                    MenuRow(symbol: "powerplug", label: "Connectors",
                            hint: connectors.isEmpty ? "Outside services VAIC can use" : "\(connectors.count) connected", more: true) { page = .connectors }
                    MenuRow(symbol: "puzzlepiece.extension", label: "Plugins",
                            hint: skills.isEmpty ? "Skills your agents follow" : "\(skills.count) \(skills.count == 1 ? "skill" : "skills")", more: true) { page = .plugins }
                case .files:
                    back("Add files or photos")
                    MenuRow(symbol: "photo.on.rectangle", label: "From Photos", hint: "Pictures and videos on this iPhone") { pickingPhotos = true }
                    MenuRow(symbol: "doc", label: "From Files", hint: "iCloud Drive, On My iPhone, and other apps") { pickingFiles = true }
                case .slash:
                    back("Slash commands")
                    ForEach(commands) { c in
                        MenuRow(symbol: c.skill ? "puzzlepiece.extension" : "command", label: "/\(c.name)", hint: c.hint) {
                            insert(MenuInsert(words: "/\(c.name) ", atStart: true))
                        }
                    }
                case .connectors:
                    back("Connectors")
                    if connectors.isEmpty { none("No connectors yet.") }
                    ForEach(connectors) { c in
                        MenuRow(symbol: "powerplug", label: c.label ?? c.id, hint: c.statusWords) {
                            insert(MenuInsert(words: "Use \(c.label ?? c.id) to ", atStart: false))
                        }
                    }
                    // The browser writes "Add ___ as a connector" with the blank selected; a phone's box cannot
                    // select, so the /connect command does the same with the service typed after it.
                    MenuRow(symbol: "plus", label: "Add a connector…", hint: "Name the service; VAIC sets it up") {
                        insert(MenuInsert(words: "/connect ", atStart: true))
                    }
                case .plugins:
                    back("Plugins")
                    if skills.isEmpty { none("No plugins yet.") }
                    ForEach(skills) { s in
                        MenuRow(symbol: "puzzlepiece.extension", label: s.name, hint: s.description.isEmpty ? "A skill you added" : s.description) {
                            insert(MenuInsert(words: "/\(s.name) ", atStart: true))
                        }
                    }
                    MenuRow(symbol: "plus", label: "Add a plugin…", hint: "Skills are added on the web") {
                        dismiss()
                        model.show("Skills are added on the web HUD's Skills tab, then they show here.")
                    }
                }
            }
            .padding(12)
        }
        .nightSheet()
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .accessibilityLabel("Add to your message")
        .task { await model.loadLists() }
        .photosPicker(isPresented: $pickingPhotos, selection: $photos, maxSelectionCount: Attach.maxFolderFiles, matching: .any(of: [.images, .videos]))
        .onChange(of: pickingPhotos) { _, picking in
            // The picker closed: the picks (if any) go up once the sheet is gone.
            guard !picking, !photos.isEmpty else { return }
            let picked = photos
            photos = []
            dismiss()
            onPhotos(picked)
        }
        .fileImporter(isPresented: $pickingFiles, allowedContentTypes: [.item], allowsMultipleSelection: true) { r in
            if case .success(let urls) = r, !urls.isEmpty { dismiss(); onURLs(urls, false) }
        }
        .fileImporter(isPresented: $pickingFolder, allowedContentTypes: [.folder], allowsMultipleSelection: false) { r in
            if case .success(let urls) = r, !urls.isEmpty { dismiss(); onURLs(urls, true) }
        }
    }

    private func insert(_ i: MenuInsert) {
        dismiss()
        onInsert(i)
    }

    @ViewBuilder private func back(_ title: String) -> some View {
        MenuRow(symbol: "chevron.left", label: "Back") { page = .main }
        Text(title.uppercased())
            .font(.caption.weight(.bold)).kerning(0.8).foregroundStyle(Glass.mute)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12).padding(.top, 8).padding(.bottom, 4)
            .accessibilityAddTraits(.isHeader)
    }

    private func none(_ words: String) -> some View {
        Text(words).foregroundStyle(Glass.mute).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 12).padding(.vertical, 8)
    }
}

/// One row of the menu: icon, words with a hint under them, a chevron when it opens a list. 44 pt tall at least.
struct MenuRow: View {
    var symbol: String
    var label: String
    var hint: String?
    var more = false
    var action: () -> Void

    init(symbol: String, label: String, hint: String? = nil, more: Bool = false, action: @escaping () -> Void) {
        self.symbol = symbol
        self.label = label
        self.hint = hint
        self.more = more
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol).frame(width: 24).foregroundStyle(Glass.mute).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).font(.body.weight(.semibold)).foregroundStyle(Glass.text)
                    if let hint { Text(hint).font(.footnote).foregroundStyle(Glass.mute) }
                }
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                if more { Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Glass.mute).accessibilityHidden(true) }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .frame(minHeight: 44)
            .contentShape(RoundedRectangle(cornerRadius: Glass.radiusSmall, style: .continuous))
        }
        .buttonStyle(MenuRowStyle())
        .accessibilityHint(more ? "Opens a list" : "")
    }
}

private struct MenuRowStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Glass.fill2 : .clear, in: RoundedRectangle(cornerRadius: Glass.radiusSmall, style: .continuous))
    }
}

// MARK: Reading what was picked

enum FilePicks {
    /// The bytes behind security-scoped URLs from Files, each copied while the access lasts.
    static func read(_ urls: [URL]) async -> [PickedFile] {
        var out: [PickedFile] = []
        for url in urls {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            if let data = try? Data(contentsOf: url, options: .mappedIfSafe) {
                out.append(PickedFile(name: url.lastPathComponent, contentType: mime(url), data: data))
            }
        }
        return out
    }

    /// Every file under a picked folder (hidden folders are not entered), as paths relative to it.
    static func listFolder(_ folder: URL) -> [(url: URL, path: String)] {
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        guard let e = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: [.isRegularFileKey, .isDirectoryKey],
                                                     options: [.skipsPackageDescendants]) else { return [] }
        let base = folder.standardizedFileURL.path
        var out: [(URL, String)] = []
        for case let u as URL in e {
            let v = try? u.resourceValues(forKeys: [.isRegularFileKey, .isDirectoryKey])
            let rel = String(u.standardizedFileURL.path.dropFirst(base.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            if v?.isDirectory == true {
                if u.lastPathComponent.hasPrefix(".") { e.skipDescendants(); out.append((u, rel)) } // counted once as hidden
                continue
            }
            if v?.isRegularFile == true { out.append((u, rel)) }
        }
        return out
    }

    /// The folder's files as PickedFiles, after the hidden-file and 100-file rules; `note` says what was left out.
    static func readFolder(_ folder: URL) async -> (files: [PickedFile], note: String?) {
        let all = listFolder(folder)
        let pick = Attach.folderFiles(all.map(\.path)) { $0 }
        let chosen = Set(pick.files)
        let urls = all.filter { chosen.contains($0.path) }.map(\.url)
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        let files = await read(urls)
        return (files, Attach.folderNote(hidden: pick.hidden, added: files.count, skipped: pick.skipped))
    }

    /// Photos and videos from the library: the bytes, a type and a name like "Photo 2026-11-08 14.03.07.jpeg".
    static func read(_ items: [PhotosPickerItem]) async -> [PickedFile] {
        var out: [PickedFile] = []
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd HH.mm.ss"
        for (n, item) in items.enumerated() {
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            let type = item.supportedContentTypes.first
            let video = type?.conforms(to: .movie) == true
            let ext = type?.preferredFilenameExtension ?? (video ? "mov" : "jpeg")
            let stamp = f.string(from: Date())
            out.append(PickedFile(name: "\(video ? "Video" : "Photo") \(stamp)\(items.count > 1 ? " (\(n + 1))" : "").\(ext)",
                                  contentType: type?.preferredMIMEType ?? (video ? "video/quicktime" : "image/jpeg"), data: data))
        }
        return out
    }

    static func mime(_ url: URL) -> String {
        UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
    }
}

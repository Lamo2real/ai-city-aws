// The Files tab (docs/FILES.md §11), like the web's #/files: browse folders by hand (each folder is a page, Back goes
// up, the path shows above), scroll a long list that loads more as it goes, thumbnails loaded lazily; search names
// and what's in them, everywhere or in this folder; sort, grid or list; upload from Photos or the Files app into
// the open folder; open a file to see it, save or share it, rename, move or delete it.
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct FilesScreen: View {
    var body: some View {
        FolderView(folder: "")
            .navigationDestination(for: SubFolder.self) { FolderView(folder: $0.path) }
    }
}


struct FolderView: View {
    @Environment(AppModel.self) private var model
    let folder: String
    @AppStorage("vaic.files.list") private var asList = false
    @State private var search = ""
    @State private var onlyHere = false
    @State private var kind = ""
    @State private var sort: FilesQuery.Sort?
    @State private var page: FilesPage?
    @State private var files: [StoredFile] = []
    @State private var problem: String?
    @State private var loadingMore = false
    @State private var open: StoredFile?
    @State private var photos: [PhotosPickerItem] = []
    @State private var importing = false
    @State private var uploading: [String: Int] = [:]

    private var query: FilesQuery { FilesQuery(folder: folder, search: search, onlyHere: onlyHere, kind: kind, sort: sort) }
    private var searching: Bool { !search.trimmingCharacters(in: .whitespaces).isEmpty }
    private var title: String { folder.split(separator: "/").last.map(String.init) ?? "Files" }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if !folder.isEmpty {
                    Text(["Files", folder.split(separator: "/").joined(separator: " › ")].joined(separator: " › "))
                        .font(.caption).foregroundStyle(Glass.mute)
                        .accessibilityLabel("Where you are: Files, \(folder.split(separator: "/").joined(separator: ", "))")
                }
                kinds
                if let problem {
                    Text(problem).font(.callout).foregroundStyle(Glass.badLight)
                        .padding(10).glassTint(Glass.badTint)
                    Button("Try again") { Task { await load() } }.buttonStyle(.glass)
                }
                ForEach(uploading.sorted(by: { $0.key < $1.key }), id: \.key) { name, pct in
                    Label("Uploading “\(name)” \(pct) %", systemImage: "arrow.up.circle").font(.callout).foregroundStyle(Glass.text)
                }
                let folders = searching ? (page?.foundFolders ?? []) : (page?.subfolders ?? [])
                ForEach(folders) { f in
                    NavigationLink(value: f) {
                        HStack {
                            Image(systemName: "folder.fill").foregroundStyle(Glass.amber)
                            Text(f.name).foregroundStyle(Glass.text)
                            Spacer()
                            if let n = f.files { Text(n == 1 ? "1 file" : "\(n) files").font(.caption).foregroundStyle(Glass.mute) }
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(Glass.mute)
                        }
                        .frame(minHeight: 44).padding(.horizontal, 12).glassTint(Glass.fill2)
                    }
                }
                if let page, page.count > 0 {
                    Text(searching ? "\(page.count) \(page.count == 1 ? "file matches" : "files match")" : "\(page.count) \(page.count == 1 ? "file" : "files")")
                        .font(.caption).foregroundStyle(Glass.mute)
                }
                if asList {
                    ForEach(files) { f in row(f).onAppear { more(after: f) } }
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], spacing: 8) {
                        ForEach(files) { f in tile(f).onAppear { more(after: f) } }
                    }
                }
                if loadingMore { ProgressView().frame(maxWidth: .infinity) }
                if page != nil, files.isEmpty, folders.isEmpty, problem == nil {
                    Text(searching ? "Nothing matches “\(search)”. Try other words, or search everywhere." : folder.isEmpty ? "Nothing here yet. Tap + to add photos, videos or files." : "No files here.")
                        .font(.callout).foregroundStyle(Glass.mute).frame(maxWidth: .infinity).padding(.top, 40)
                }
                if page == nil, problem == nil { ProgressView().frame(maxWidth: .infinity).padding(.top, 40) }
            }
            .padding(16)
        }
        .nightScreen()
        .navigationTitle(title)
        .searchable(text: $search, prompt: "Names and what's in them")
        .searchScopes($onlyHere, activation: .onSearchPresentation) {
            if !folder.isEmpty {
                Text("Everywhere").tag(false)
                Text("In “\(title)”").tag(true)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { options }
            ToolbarItem(placement: .topBarTrailing) { addMenu }
        }
        .task(id: query) {
            if searching { try? await Task.sleep(for: .milliseconds(350)) }  // typing: wait for a pause
            await load()
        }
        .refreshable { await load() }
        .onChange(of: photos) { _, items in
            guard !items.isEmpty else { return }
            photos = []
            Task { await uploadPhotos(items) }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.item], allowsMultipleSelection: true) { r in
            if case .success(let urls) = r { Task { await uploadFiles(urls) } }
        }
        .sheet(item: $open) { f in
            FileSheet(file: f, folders: page?.folders ?? []) { Task { await load() } }
        }
    }

    // MARK: Pieces

    private var kinds: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach([("", "All"), ("image", "Images"), ("video", "Videos"), ("document", "Documents"), ("audio", "Audio"), ("other", "Other")], id: \.0) { k, label in
                    Button(label) { kind = k }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 12).frame(minHeight: 36)
                        .foregroundStyle(Glass.text)
                        .glassTint(kind == k ? Glass.text.opacity(0.22) : Glass.fill, radius: 18)
                        .accessibilityAddTraits(kind == k ? .isSelected : [])
                }
            }
        }
    }

    private var options: some View {
        Menu {
            Picker("Sort", selection: Binding(get: { sort ?? (searching ? .best : .newest) }, set: { sort = $0 })) {
                ForEach(FilesQuery.Sort.allCases.filter { $0 != .best || searching }) { Text($0.label).tag($0) }
            }
            Picker("Show as", selection: $asList) {
                Label("Grid", systemImage: "square.grid.2x2").tag(false)
                Label("List", systemImage: "list.bullet").tag(true)
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down.circle").accessibilityLabel("Sort and view")
        }
    }

    @State private var pickingPhotos = false
    private var addMenu: some View {
        Menu {
            Button { pickingPhotos = true } label: { Label("Photos and videos", systemImage: "photo.on.rectangle") }
            Button { importing = true } label: { Label("From the Files app", systemImage: "folder") }
        } label: {
            Image(systemName: "plus.circle.fill").accessibilityLabel(folder.isEmpty ? "Add files" : "Add files to \(title)")
        }
        .photosPicker(isPresented: $pickingPhotos, selection: $photos, matching: .any(of: [.images, .videos]))
    }

    private func tile(_ f: StoredFile) -> some View {
        Button { open = f } label: {
            VStack(alignment: .leading, spacing: 4) {
                thumb(f).frame(height: 96).frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                Text(f.name).font(.caption.weight(.semibold)).foregroundStyle(Glass.text).lineLimit(2)
                if searching || f.folder != folder {
                    Text("in \(f.folder.isEmpty ? "Files" : f.folder)").font(.caption2).foregroundStyle(Glass.mute).lineLimit(1)
                }
                if let s = f.statusWords { Text(s).font(.caption2).foregroundStyle(f.status == "failed" ? Glass.badLight : Glass.warnLight).lineLimit(3) }
            }
            .padding(6).glassTint(Glass.fill)
        }
        .accessibilityLabel("\(f.name), \(f.meta)\(searching ? ", in \(f.folder.isEmpty ? "Files" : f.folder)" : "")")
    }

    private func row(_ f: StoredFile) -> some View {
        Button { open = f } label: {
            HStack(spacing: 10) {
                thumb(f).frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(f.name).font(.subheadline.weight(.semibold)).foregroundStyle(Glass.text).lineLimit(1)
                    Text((searching || f.folder != folder ? "in \(f.folder.isEmpty ? "Files" : f.folder) · " : "") + f.meta)
                        .font(.caption).foregroundStyle(Glass.mute).lineLimit(1)
                    if let s = f.statusWords { Text(s).font(.caption2).foregroundStyle(f.status == "failed" ? Glass.badLight : Glass.warnLight) }
                }
                Spacer(minLength: 0)
            }
            .padding(6).frame(minHeight: 56).glassTint(Glass.fill)
        }
    }

    @ViewBuilder private func thumb(_ f: StoredFile) -> some View {
        if let u = f.thumbURL {
            AsyncImage(url: u) { p in
                if let img = p.image { img.resizable().scaledToFill() } else { Glass.deep }
            }
        } else {
            ZStack {
                Glass.deep
                Image(systemName: Self.symbol(f.kind)).font(.title2).foregroundStyle(Glass.mute)
            }
        }
    }

    static func symbol(_ kind: String) -> String {
        ["image": "photo", "video": "film", "audio": "waveform", "document": "doc.text", "text": "doc.plaintext"][kind] ?? "doc"
    }

    // MARK: Loading

    private func load() async {
        guard let api = model.api else { return }
        do {
            let p = try await api.files(query)
            page = p
            files = p.files
            problem = nil
        } catch {
            problem = "Your files didn't load (\(error.localizedDescription))."
        }
    }

    /// The next page, when the last few tiles come into view.
    private func more(after f: StoredFile) {
        guard let next = page?.next, !loadingMore, files.suffix(8).contains(where: { $0.id == f.id }), let api = model.api else { return }
        loadingMore = true
        Task {
            defer { loadingMore = false }
            do {
                let p = try await api.files(query, offset: next)
                let have = Set(files.map(\.id))
                files += p.files.filter { !have.contains($0.id) }
                page?.next = p.next
            } catch {
                problem = "More files didn't load (\(error.localizedDescription))."
            }
        }
    }

    // MARK: Uploads (into this folder)

    private func uploadPhotos(_ items: [PhotosPickerItem]) async {
        for item in items {
            do {
                guard let picked = try await item.loadTransferable(type: PickedMedia.self) else { continue }
                await send(picked.url, takenAt: picked.takenAt)
            } catch {
                model.show("A photo couldn't be read (\(error.localizedDescription)).", tone: .bad)
            }
        }
        await load()
    }

    private func uploadFiles(_ urls: [URL]) async {
        for url in urls {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)
                let copy = tmp.appendingPathComponent(url.lastPathComponent)
                try FileManager.default.copyItem(at: url, to: copy)
                let date = try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
                await send(copy, takenAt: date)
            } catch {
                model.show("“\(url.lastPathComponent)” couldn't be read (\(error.localizedDescription)).", tone: .bad)
            }
        }
        await load()
    }

    private func send(_ url: URL, takenAt: Date?) async {
        guard let up = model.filesUploader() else { return model.show("No connection to AI City right now.", tone: .bad) }
        let name = url.lastPathComponent
        let type = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        uploading[name] = 0
        defer { uploading[name] = nil }
        do {
            _ = try await up.upload(url, name: name, contentType: type, folder: folder, takenAt: takenAt) { pct in uploading[name] = pct }
            model.show("“\(name)” is uploaded.", tone: .good)
        } catch {
            model.show("The upload of “\(name)” stopped (\(error.localizedDescription)). Try again.", tone: .bad)
        }
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }
}

/// A photo or video from the library, as a file on disk: photos become JPEG (keeping the date it was taken, which
/// Files reads from the EXIF), videos stay as they are.
struct PickedMedia: Transferable {
    let url: URL
    var takenAt: Date?

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(importedContentType: .movie) { received in
            PickedMedia(url: try Self.keep(received.file, name: received.file.lastPathComponent))
        }
        FileRepresentation(importedContentType: .image) { received in
            let stem = received.file.deletingPathExtension().lastPathComponent
            let out = try Self.keep(received.file, name: received.file.lastPathComponent)
            guard UTType(filenameExtension: out.pathExtension) != .jpeg,
                  let src = CGImageSourceCreateWithURL(out as CFURL, nil) else { return PickedMedia(url: out) }
            let jpg = out.deletingLastPathComponent().appendingPathComponent("\(stem).jpg")
            guard let dest = CGImageDestinationCreateWithURL(jpg as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
                return PickedMedia(url: out)
            }
            CGImageDestinationAddImageFromSource(dest, src, 0, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
            guard CGImageDestinationFinalize(dest) else { return PickedMedia(url: out) }
            try? FileManager.default.removeItem(at: out)
            return PickedMedia(url: jpg)
        }
    }

    private static func keep(_ file: URL, name: String) throws -> URL {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let dest = dir.appendingPathComponent(name)
        try FileManager.default.copyItem(at: file, to: dest)
        return dest
    }
}

/// One file: its card (preview and Download), and rename, move, delete.
struct FileSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let file: StoredFile
    let folders: [String]
    let changed: () -> Void
    @State private var name = ""
    @State private var folder = ""
    @State private var confirmDelete = false
    @State private var problem: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let card = file.card { FileCard(file: card) }
                    if let d = file.json["description"].string, !d.isEmpty {
                        Text(d).font(.callout).foregroundStyle(Glass.text)
                    }
                    if let s = file.statusWords {
                        Text(s).font(.callout).foregroundStyle(file.status == "failed" ? Glass.badLight : Glass.warnLight)
                        if file.status == "failed" { Button("Try again") { Task { await act { try await $0.retryFile(file.id) } } }.buttonStyle(.glass) }
                    }
                    Text("Name").font(.caption).foregroundStyle(Glass.mute)
                    TextField("Name", text: $name).textFieldStyle(.plain).padding(10).glassTint(Glass.deep)
                    Text("Folder (empty: the top level)").font(.caption).foregroundStyle(Glass.mute)
                    TextField("e.g. Thumbnails/2026", text: $folder).textFieldStyle(.plain).padding(10).glassTint(Glass.deep)
                        .textInputAutocapitalization(.never)
                    if let problem { Text(problem).font(.callout).foregroundStyle(Glass.badLight) }
                    HStack {
                        Button("Delete", role: .destructive) { confirmDelete = true }.buttonStyle(.glass)
                        Spacer()
                        Button("Save changes") {
                            Task {
                                var patch: [String: JSONValue] = [:]
                                if name != file.name { patch["name"] = .string(name) }
                                if folder != file.folder { patch["folder"] = .string(folder) }
                                await act { try await $0.updateFile(file.id, .object(patch)) }
                            }
                        }
                        .buttonStyle(.glassPrimary)
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || (name == file.name && folder == file.folder))
                    }
                }
                .padding(16)
            }
            .nightSheet()
            .navigationTitle(file.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .onAppear { name = file.name; folder = file.folder }
            .confirmationDialog("Delete “\(file.name)”?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { await act { try await $0.deleteFile(file.id) } } }
            } message: {
                Text("It disappears from Files for you and every department. It can be recovered for 30 days if you ask.")
            }
        }
    }

    private func act(_ f: @escaping (APIClient) async throws -> Void) async {
        guard let api = model.api else { return }
        do {
            try await f(api)
            changed()
            dismiss()
        } catch {
            problem = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

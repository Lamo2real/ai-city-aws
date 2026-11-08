// The + menu's brains, the Swift port of web/src/lib/attach.ts (docs/PRODUCT.md, "The + menu"): slash
// commands that become the plain sentences AIC already understands, the files picked from a folder, and the
// line under a message that names what was attached. Pure functions, tested in AICityTests/AttachTests.swift;
// the menu itself is UI/PlusMenu.swift and the uploads are Core/Upload.swift.
import Foundation

// MARK: The lists the menu shows (web/src/lib/connect.ts)

/// A skill the owner added (listed under Plugins, and as a slash command when enabled).
struct Skill: Equatable, Sendable, Identifiable {
    var name: String
    var description: String
    var enabled: Bool
    var id: String { name }

    init(name: String, description: String = "", enabled: Bool = true) {
        self.name = name
        self.description = description
        self.enabled = enabled
    }

    init?(json: JSONValue) {
        guard let name = json["name"].string else { return nil }
        self.init(name: name, description: json["description"].string ?? "", enabled: json["enabled"].bool ?? false)
    }
}

/// An outside service AIC can use.
struct Connector: Equatable, Sendable, Identifiable {
    var id: String
    var label: String?
    var status: String
    var needs: String?
    var error: String?
    var toolCount: Int

    init(id: String, label: String? = nil, status: String, needs: String? = nil, error: String? = nil, toolCount: Int = 0) {
        self.id = id
        self.label = label
        self.status = status
        self.needs = needs
        self.error = error
        self.toolCount = toolCount
    }

    init?(json: JSONValue) {
        guard let id = json["id"].string else { return nil }
        self.init(id: id, label: json["label"].string, status: json["status"].string ?? "", needs: json["needs"].string,
                  error: json["error"].string, toolCount: json["tools"].array.count)
    }

    /// What its status means for the owner, in plain words (`connectorStatus` in web/src/lib/connect.ts).
    var statusWords: String {
        switch status {
        case "ready": return "On · \(toolCount) tools"
        case "needs_login": return "Needs you to sign in"
        case "login_expired": return "Sign in again"
        case "needs_key": return needs == "oauth_client" ? "Needs its app's client id and secret" : "Needs its key"
        case "pending_approval": return "Waiting for your approval"
        case "error": return error ?? "Something went wrong"
        default: return "Setting up…"
        }
    }
}

// MARK: Slash commands

struct SlashCommand: Equatable, Sendable, Identifiable {
    /// Typed after the slash: `/status`.
    var name: String
    /// What it does, in the menu.
    var hint: String
    /// What AIC is sent; `$1` is the words typed after the command. Nil: handled by the app itself (/clear).
    var says: String?
    /// Named when the command needs words after it ("service" for /connect).
    var arg: String?
    /// A skill the owner added (listed under Plugins too).
    var skill = false
    var id: String { name }
}

enum Slash {
    static let builtIn: [SlashCommand] = [
        SlashCommand(name: "status", hint: "How the city is doing", says: "What's the status of the city?"),
        SlashCommand(name: "stop", hint: "Stop the current job", says: "Stop the current job."),
        SlashCommand(name: "home", hint: "Send every worker home", says: "Send everyone home."),
        SlashCommand(name: "knowledge", hint: "What's in my knowledge base", says: "What's in my knowledge base?"),
        SlashCommand(name: "connect", hint: "Add a connector", says: "Add $1 as a connector.", arg: "service"),
        SlashCommand(name: "clear", hint: "Clear this conversation on this iPhone", says: nil),
    ]

    /// Every enabled skill as a command: `/pdf-report make one for Q3` → "Use the “pdf-report” skill: …".
    static func skillCommands(_ skills: [Skill]) -> [SlashCommand] {
        skills.filter(\.enabled).map {
            SlashCommand(name: $0.name, hint: $0.description.isEmpty ? "A skill you added" : $0.description,
                         says: "Use the “\($0.name)” skill: $1", arg: "what to do", skill: true)
        }
    }

    static func allCommands(_ skills: [Skill]) -> [SlashCommand] { builtIn + skillCommands(skills) }

    /// The commands the box is naming so far: `/` lists all, `/st` lists /status and /stop; anything else none.
    static func matchCommands(_ text: String, _ commands: [SlashCommand]) -> [SlashCommand] {
        guard let m = text.firstMatch(of: /^\/([a-z0-9-]*)$/.ignoresCase()) else { return [] }
        let typed = String(m.1).lowercased()
        return commands.filter { $0.name.hasPrefix(typed) }
    }

    enum Meaning: Equatable {
        case send(String)
        case clear
        case needs(SlashCommand)
    }

    /// What a message starting with a slash means. Nil: not a command the app knows; it is sent as typed.
    static func expand(_ text: String, _ commands: [SlashCommand]) -> Meaning? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let m = trimmed.firstMatch(of: /^\/([a-z0-9-]+)(?:\s+([\s\S]*))?$/.ignoresCase()) else { return nil }
        let name = String(m.1).lowercased()
        guard let command = commands.first(where: { $0.name == name }) else { return nil }
        guard let says = command.says else { return .clear }
        let rest = (m.2.map(String.init) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if command.arg != nil, rest.isEmpty { return .needs(command) }
        let said = says.contains("$1") ? says.replacingOccurrences(of: "$1", with: rest) : says
        return .send(command.arg != nil || rest.isEmpty ? said : "\(said) \(rest)")
    }

    /// The hint shown instead of sending a command that misses its words (the browser's toast).
    static func needsWords(_ c: SlashCommand) -> String {
        let example = c.name == "connect" ? "HeyGen" : "what you want done"
        return "Add the \(c.arg ?? "words") after /\(c.name), like “/\(c.name) \(example)”."
    }

    /// Words from the + menu into the box: a command goes in front (replacing one already there), the rest at the end.
    static func insert(_ words: String, into text: String, atStart: Bool) -> String {
        if atStart { return words + text.replacing(/^\/\S*\s?/, with: "") }
        let kept = text.replacing(/\s*$/, with: "")
        return kept.isEmpty ? words : "\(kept) \(words)"
    }
}

// MARK: Attachments

/// An item in the knowledge base, as the API and the `knowledge.updated` event describe it.
struct KnowledgeItem: Equatable, Sendable, Identifiable {
    enum Status: String, Sendable { case uploading, processing, ready, failed, unsupported }
    var id: String
    var kind: String
    var title: String
    var status: Status
    var error: String?

    init(id: String, kind: String = "document", title: String, status: Status, error: String? = nil) {
        self.id = id
        self.kind = kind
        self.title = title
        self.status = status
        self.error = error
    }

    init?(json: JSONValue) {
        guard let id = json["id"].string else { return nil }
        self.init(id: id, kind: json["kind"].string ?? "other", title: json["title"].string ?? "",
                  status: Status(rawValue: json["status"].string ?? "") ?? .processing, error: json["error"].string)
    }

    /// The status in plain words (`statusWords` in web/src/components/Knowledge.tsx), with progress while this
    /// iPhone sends the file.
    func statusWords(percent: Int? = nil, localError: String? = nil) -> String {
        if let localError { return "Failed: \(localError)" }
        switch status {
        case .uploading: return percent.map { "Uploading \($0) %" } ?? "Uploading"
        case .processing:
            if kind == "audio" || kind == "video" { return "Transcribing" }
            if kind == "image" { return "Reading the image" }
            if kind == "link" { return "Reading the page" }
            return "Getting it ready"
        case .ready: return "Ready"
        case .failed: return "Failed: \(error ?? "something went wrong while reading it. Delete it and add it again.")"
        case .unsupported: return "Can't be searched yet"
        }
    }
}

enum Attach {
    static let maxFolderFiles = 100

    struct FolderPick<File>: Equatable where File: Equatable {
        var files: [File]
        var hidden: Int
        var skipped: Int
    }

    /// The files a folder gave, without hidden files and folders (a path part starting with "."), at most
    /// `maxFolderFiles`. `path` is each file's path relative to the picked folder.
    static func folderFiles<File: Equatable>(_ list: [File], path: (File) -> String) -> FolderPick<File> {
        let shown = list.filter { !path($0).split(separator: "/").contains { $0.hasPrefix(".") } }
        return FolderPick(files: Array(shown.prefix(maxFolderFiles)), hidden: list.count - shown.count,
                          skipped: max(0, shown.count - maxFolderFiles))
    }

    /// A message may go once every attachment has left the iPhone (processing can finish while AIC reads).
    static func sendable(_ items: [KnowledgeItem]) -> Bool { items.allSatisfy { $0.status != .uploading } }

    /// The line under a message that names what was attached, so AIC knows where to look.
    static func attachedLine(_ items: [KnowledgeItem]) -> String {
        let parts = items.map { i -> String in
            let state: String
            switch i.status {
            case .ready: state = "ready"
            case .failed: state = "failed to process"
            case .unsupported: state = "stored, but cannot be searched"
            case .uploading, .processing: state = "still being prepared"
            }
            return "“\(i.title)” (\(i.kind), \(state))"
        }
        return "Attached (now in my knowledge base): \(parts.joined(separator: "; "))."
    }

    /// The whole message: the owner's words (or a stand-in when there are none) and the attached line.
    static func body(_ text: String, attached: [KnowledgeItem]) -> String {
        guard !attached.isEmpty else { return text }
        return "\(text.isEmpty ? "Take a look at what I attached." : text)\n\n\(attachedLine(attached))"
    }

    /// What a folder pick leaves out, as one sentence (nil when nothing was).
    static func folderNote(hidden: Int, added: Int, skipped: Int) -> String? {
        var notes: [String] = []
        if hidden > 0 { notes.append("\(hidden) hidden \(hidden == 1 ? "file was" : "files were") left out") }
        if skipped > 0 { notes.append("only the first \(added) files were added") }
        return notes.isEmpty ? nil : notes.joined(separator: "; ") + "."
    }
}

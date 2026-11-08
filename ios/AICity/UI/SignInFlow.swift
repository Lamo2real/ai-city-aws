// AI City's own sign-in screens (like web/src/components/SignIn.tsx): one task per screen, one primary
// button, plain words, and the first login spelled out (temporary password → own password → authenticator
// app). Later sign-ins: email + password, then the 6-digit code. There is no "register": only the owner exists.
import CoreImage.CIFilterBuiltins
import SwiftUI

struct SignInFlow: View {
    enum Screen: Equatable { case signin, newPassword, totpSetup(secret: String, uri: String), totpCode, forgot, forgotConfirm, invite }

    @Environment(AppModel.self) private var model
    @State private var screen: Screen = .signin
    @State private var email = ""
    @State private var password = ""
    @State private var newPassword = ""
    @State private var repeatPassword = ""
    @State private var code = ""
    @State private var problem: String?
    @State private var notice: String?
    @State private var busy = false
    @State private var firstLogin = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack { EyeView(size: 56); Text("AI CITY").font(.headline.monospaced()) }
                        .accessibilityElement(children: .combine)
                    if let step = stepNumber {
                        Text("First sign-in · step \(step) of 3").font(.footnote).foregroundStyle(.secondary)
                    }
                    Text(title).font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                    if let problem { Banner(tone: .bad, text: problem) }
                    if let notice { Banner(tone: .good, text: notice) }
                    content
                }
                .padding(24)
                .glassPanel()
                .padding(.horizontal, 16)
                .padding(.vertical, 24)
                .frame(maxWidth: 552)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .nightScreen()
        }
    }

    private var title: String {
        switch screen {
        case .signin: return "Sign in to AI City"
        case .newPassword: return "Choose your own password"
        case .totpSetup: return "Connect an authenticator app"
        case .totpCode: return "Enter your 6-digit code"
        case .forgot: return "Reset your password"
        case .forgotConfirm: return "Choose a new password"
        case .invite: return "Get a new first-login email"
        }
    }
    private var stepNumber: Int? {
        switch screen {
        case .newPassword: return 2
        case .totpSetup: return firstLogin ? 3 : nil
        default: return nil
        }
    }

    private func go(_ s: Screen) {
        problem = nil
        code = ""
        screen = s
    }

    private func next(_ step: SignInStep) async {
        switch step {
        case .done:
            Haptics.success()
            password = ""; newPassword = ""; repeatPassword = ""
            await model.signedIn()
        case .newPassword:
            firstLogin = true
            go(.newPassword)
        case .totpSetup(let secret, let uri): go(.totpSetup(secret: secret, uri: uri))
        case .totpCode: go(.totpCode)
        }
    }

    private func run(_ fn: @escaping () async throws -> Void) {
        guard !busy else { return }
        busy = true
        problem = nil
        notice = nil
        Task {
            defer { busy = false }
            do { try await fn() } catch {
                Haptics.error()
                problem = authProblem(error)
            }
        }
    }

    private var auth: AuthClient? { model.auth }

    @ViewBuilder private var content: some View {
        switch screen {
        case .signin:
            Text("Use your email and password. The first time, use the temporary password from the email “Welcome to AI City”.")
                .foregroundStyle(.secondary)
            Field(label: "Email", text: $email, kind: .email)
            Field(label: "Password", text: $password, kind: .password(new: false))
            PrimaryButton(title: busy ? "Signing in…" : "Sign in", disabled: busy || email.isEmpty || password.isEmpty) {
                run { if let a = auth { await next(try await a.signIn(email: email, password: password)) } }
            }
            LinkButton("Forgot your password?") { go(.forgot) }
            LinkButton("First time here, or the temporary password expired?") { go(.invite) }

        case .newPassword:
            Text("You signed in with the temporary password. Now choose your own; you will use it from now on.").foregroundStyle(.secondary)
            Field(label: "New password", text: $newPassword, kind: .password(new: true))
            Field(label: "Type it again", text: $repeatPassword, kind: .password(new: true))
            RulesList(password: newPassword)
            if !repeatPassword.isEmpty, newPassword != repeatPassword {
                Text("The two passwords are not the same.").foregroundStyle(Glass.badLight).font(.callout)
            }
            PrimaryButton(title: "Save my password", disabled: busy || PasswordRules.problem(newPassword) != nil || newPassword != repeatPassword) {
                run { if let a = auth { await next(try await a.setNewPassword(newPassword)) } }
            }

        case .totpSetup(let secret, let uri):
            Text("AI City asks for a 6-digit code from your authenticator app every time you sign in. Set it up once:").foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 10) {
                Text("1. Open an authenticator app, for example Microsoft Authenticator, Google Authenticator or 1Password.")
                Text("2. Add AI City: open it in your authenticator app on this iPhone, or scan the code from another device.")
                if let url = URL(string: uri) {
                    Link(destination: url) { Label("Open in authenticator app", systemImage: "key.viewfinder").frame(maxWidth: .infinity) }
                        .buttonStyle(.glass)
                }
                if let qr = QRCode.image(uri) {
                    Image(uiImage: qr).interpolation(.none).resizable().frame(width: 200, height: 200)
                        .frame(maxWidth: .infinity)
                        .accessibilityLabel("QR code for your authenticator app")
                }
                Text("Can’t scan? Type this key instead:").font(.footnote).foregroundStyle(.secondary)
                Text(secret.chunked(4)).font(.body.monospaced()).textSelection(.enabled)
                    .accessibilityLabel("Setup key: \(secret.map(String.init).joined(separator: " "))")
                Button { UIPasteboard.general.setItems([[UIPasteboard.typeAutomatic: secret]], options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(120)]) } label: {
                    Label("Copy the key", systemImage: "doc.on.doc").frame(minHeight: 44)
                }
                Text("3. Type the 6-digit code the app shows for AI City.")
            }
            Field(label: "6-digit code", text: $code, kind: .code(6))
            PrimaryButton(title: "Confirm and sign in", disabled: busy || code.count != 6) {
                run { if let a = auth { await next(try await a.confirmCode(code)) } }
            }

        case .totpCode:
            Text("Open your authenticator app and type the code shown for AI City.").foregroundStyle(.secondary)
            Field(label: "6-digit code", text: $code, kind: .code(6))
            PrimaryButton(title: "Sign in", disabled: busy || code.count != 6) {
                run { if let a = auth { await next(try await a.confirmCode(code)) } }
            }
            LinkButton("Start again") { go(.signin) }

        case .forgot:
            Text("We email you a code. Then you choose a new password.").foregroundStyle(.secondary)
            Field(label: "Email", text: $email, kind: .email)
            PrimaryButton(title: "Email me a code", disabled: busy || email.isEmpty) {
                run {
                    try await auth?.forgotPassword(email: email)
                    go(.forgotConfirm)
                }
            }
            LinkButton("Back to sign in") { go(.signin) }

        case .forgotConfirm:
            Text("We sent a code to \(email.isEmpty ? "your email" : email). It can take a minute to arrive.").foregroundStyle(.secondary)
            Field(label: "Code from the email", text: $code, kind: .code(8))
            Field(label: "New password", text: $newPassword, kind: .password(new: true))
            Field(label: "Type it again", text: $repeatPassword, kind: .password(new: true))
            RulesList(password: newPassword)
            PrimaryButton(title: "Save new password", disabled: busy || code.isEmpty || PasswordRules.problem(newPassword) != nil || newPassword != repeatPassword) {
                run {
                    try await auth?.confirmForgotPassword(email: email, code: code, password: newPassword)
                    password = ""
                    go(.signin)
                    notice = "Your new password is saved. Sign in with it."
                }
            }
            LinkButton("Back to sign in") { go(.signin) }

        case .invite:
            Text("We email you a new temporary password and the steps to sign in. It works only for the owner’s email, and at most once every 10 minutes.")
                .foregroundStyle(.secondary)
            Field(label: "Email", text: $email, kind: .email)
            PrimaryButton(title: "Email me a new first-login email", disabled: busy || email.isEmpty) {
                guard let api = model.config?.apiUrl else { return }
                busy = true
                problem = nil
                Task {
                    defer { busy = false }
                    do {
                        try await APIClient.requestFirstLoginEmail(apiURL: api, email: email)
                        notice = "If this is the owner’s email, a new first-login email is on its way. Check your inbox (and spam) for “Welcome to AI City”."
                    } catch {
                        problem = "The email could not be requested. Check your connection and try again."
                    }
                }
            }
            LinkButton("Back to sign in") { go(.signin) }
        }
    }
}

private struct Field: View {
    enum Kind { case email, password(new: Bool), code(Int) }
    var label: String
    @Binding var text: String
    var kind: Kind
    @State private var reveal = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.subheadline.weight(.medium))
            HStack {
                input
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .frame(minHeight: 44)
                if case .password = kind {
                    Button { reveal.toggle() } label: { Image(systemName: reveal ? "eye.slash" : "eye").frame(width: 44, height: 44) }
                        .accessibilityLabel(reveal ? "Hide password" : "Show password")
                }
            }
            .padding(.horizontal, 12)
            .glassWell()
        }
    }

    @ViewBuilder private var input: some View {
        switch kind {
        case .email:
            TextField(label, text: $text).keyboardType(.emailAddress).textContentType(.username).accessibilityLabel(label)
        case .password(let new):
            Group {
                if reveal { TextField(label, text: $text) } else { SecureField(label, text: $text) }
            }
            .textContentType(new ? .newPassword : .password)
            .accessibilityLabel(label)
        case .code(let n):
            TextField(label, text: Binding(get: { text }, set: { text = String($0.filter(\.isNumber).prefix(n)) }))
                .keyboardType(.numberPad).textContentType(.oneTimeCode).font(.title3.monospacedDigit())
                .accessibilityLabel(label)
        }
    }
}

private struct RulesList: View {
    var password: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(PasswordRules.rules, id: \.0) { rule in
                let ok = rule.1(password)
                Label(rule.0, systemImage: ok ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(ok ? Glass.goodLight : Glass.mute)
                    .font(.callout)
                    .accessibilityLabel("\(rule.0), \(ok ? "done" : "not yet")")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Password rules")
    }
}

struct PrimaryButton: View {
    var title: String
    var disabled: Bool
    var action: () -> Void
    var body: some View {
        Button(action: action) { Text(title).frame(maxWidth: .infinity) }
            .buttonStyle(.glassPrimary)
            .disabled(disabled)
    }
}

private struct LinkButton: View {
    var title: String
    var action: () -> Void
    init(_ title: String, action: @escaping () -> Void) { self.title = title; self.action = action }
    var body: some View {
        Button(title, action: action).frame(minHeight: 44)
    }
}

enum QRCode {
    static func image(_ text: String) -> UIImage? {
        let f = CIFilter.qrCodeGenerator()
        f.message = Data(text.utf8)
        f.correctionLevel = "M"
        guard let out = f.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)),
              let cg = CIContext().createCGImage(out, from: out.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

extension String {
    func chunked(_ n: Int) -> String {
        stride(from: 0, to: count, by: n).map { i in
            let s = index(startIndex, offsetBy: i)
            return String(self[s..<(index(s, offsetBy: n, limitedBy: endIndex) ?? endIndex)])
        }.joined(separator: " ")
    }
}

/// First launch without a built-in address: where is this owner's AI City?
struct ConnectView: View {
    @Environment(AppModel.self) private var model
    @State private var address = ""
    @State private var problem: String?
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                EyeView(size: 96)
                Text("Connect to your AI City").font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                Text("Type the address of your AI City web site, the one you open in the browser (for example d1234abcd.cloudfront.net). The app reads the same public settings from it. You do this once.")
                    .foregroundStyle(.secondary)
                if let problem { Banner(tone: .bad, text: problem) }
                TextField("Web address", text: $address)
                    .keyboardType(.URL).textContentType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .padding(.horizontal, 12).frame(minHeight: 44)
                    .glassWell()
                    .accessibilityLabel("Web address of your AI City")
                    .onSubmit(connect)
                PrimaryButton(title: busy ? "Connecting…" : "Connect", disabled: busy || address.trimmingCharacters(in: .whitespaces).isEmpty, action: connect)
            }
            .padding(24)
            .glassPanel()
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .nightScreen()
    }

    private func connect() {
        busy = true
        problem = nil
        Task {
            defer { busy = false }
            do { try await model.connect(site: address) } catch {
                problem = (error as? LocalizedError)?.errorDescription ?? "That did not work. Check the address."
            }
        }
    }
}

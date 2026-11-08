// Push-to-talk to AIC with Apple's own speech APIs: the Speech framework turns the owner's words into text
// (on the device when the phone supports it, so audio stays on the phone) and AVSpeechSynthesizer reads
// AIC's replies aloud. The web HUD uses Amazon Transcribe and Polly through the identity pool; the app does
// not need AWS credentials for voice (docs/DECISIONS.md).
import AVFoundation
import Foundation
import Observation
import Speech

@MainActor
@Observable
final class VoiceController {
    var listening = false
    var partial = ""
    var problem: String?
    /// Loudness right now, 0…1, for the voice line.
    var inputLevel: Double = 0
    var speaking = false
    var speakReplies = true {
        didSet { UserDefaults.standard.set(speakReplies, forKey: "aic.voice.speak") }
    }

    @ObservationIgnored private let engine = AVAudioEngine()
    @ObservationIgnored private var request: SFSpeechAudioBufferRecognitionRequest?
    @ObservationIgnored private var recognition: SFSpeechRecognitionTask?
    @ObservationIgnored private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    @ObservationIgnored private let synth = AVSpeechSynthesizer()
    @ObservationIgnored private var delegate: SpeechDelegate?
    @ObservationIgnored var onText: (String) -> Void = { _ in }
    @ObservationIgnored var onSpeakingDone: () -> Void = {}

    init() {
        speakReplies = UserDefaults.standard.object(forKey: "aic.voice.speak") as? Bool ?? true
        let d = SpeechDelegate { [weak self] in self?.speaking = false; self?.onSpeakingDone() }
        delegate = d
        synth.delegate = d
    }

    func toggle() {
        if listening { stop(send: true) } else { Task { await start() } }
    }

    private func start() async {
        problem = nil
        stopSpeaking()
        guard await AVAudioApplication.requestRecordPermission() else {
            problem = "Microphone access is off for AI City. Turn it on in Settings → Apps → AI City → Microphone, then tap the mic again. Typing works meanwhile."
            return
        }
        let auth = await withCheckedContinuation { c in SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0) } }
        guard auth == .authorized else {
            problem = "Speech recognition is off for AI City. Turn it on in Settings → Apps → AI City, then tap the mic again. Typing works meanwhile."
            return
        }
        guard let recognizer, recognizer.isAvailable else {
            problem = "Speech recognition is not available right now. Try again in a moment, or type instead."
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker, .allowBluetoothHFP])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            req.contextualStrings = ["AIC", "AI City", "Orchestrator"]
            if recognizer.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
            request = req
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                req.append(buffer)
                let level = Self.level(buffer)
                Task { @MainActor in self?.inputLevel = level }
            }
            engine.prepare()
            try engine.start()
            partial = ""
            listening = true
            Haptics.tap()
            recognition = recognizer.recognitionTask(with: req) { [weak self] result, error in
                Task { @MainActor in
                    guard let self else { return }
                    if let result { self.partial = result.bestTranscription.formattedString }
                    if error != nil, self.listening { self.stop(send: !self.partial.isEmpty) }
                }
            }
        } catch {
            problem = "The microphone could not start. Another app may be using it. Try again, or type instead."
            stop(send: false)
        }
    }

    func stop(send: Bool) {
        guard listening || engine.isRunning else { return }
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        recognition?.cancel()
        request = nil
        recognition = nil
        listening = false
        inputLevel = 0
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        let text = partial.trimmingCharacters(in: .whitespacesAndNewlines)
        partial = ""
        if send, !text.isEmpty { onText(text) }
    }

    func speak(_ text: String) {
        guard speakReplies, !text.isEmpty else { return }
        let plain = text.replacingOccurrences(of: "[*`#|_]", with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\bAIC\b"#, with: "Ace", options: .regularExpression) // written AIC, said "Ace" (the owner's rule, 2026-11-08)
        let u = AVSpeechUtterance(string: String(plain.prefix(2900)))
        u.voice = AVSpeechSynthesisVoice(language: "en-US")
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        speaking = true
        synth.speak(u)
    }

    func stopSpeaking() {
        synth.stopSpeaking(at: .immediate)
        speaking = false
    }

    nonisolated static func level(_ buffer: AVAudioPCMBuffer) -> Double {
        guard let data = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
        var sum: Float = 0
        for i in 0..<Int(buffer.frameLength) { sum += data[i] * data[i] }
        let rms = sqrt(sum / Float(buffer.frameLength))
        return Double(min(1, rms * 8))
    }
}

private final class SpeechDelegate: NSObject, AVSpeechSynthesizerDelegate {
    let done: @MainActor () -> Void
    init(done: @escaping @MainActor () -> Void) { self.done = done }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) { Task { @MainActor in done() } }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) { Task { @MainActor in done() } }
}

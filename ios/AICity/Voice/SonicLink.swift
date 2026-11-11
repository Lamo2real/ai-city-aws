// VAIC's real-time voice on a call (App/Calls.swift): Amazon Nova Sonic on VAIC's AgentCore runtime, over the
// same WebSocket the web HUD talks to. JSON text frames both ways: the owner's microphone goes up as 16 kHz
// PCM16 mono in base64, VAIC's voice comes down as 24 kHz PCM16 mono. Right after `ready` the app says which
// call this is (`{"type":"call"}`), so VAIC speaks first and says why it called. `interrupted` means the owner
// talked over VAIC: what is still queued to play is dropped at once.
//
// The socket and the audio are behind two small protocols so the tests run the whole exchange with fakes.
import AVFoundation
import Foundation

/// One WebSocket carrying text frames.
protocol SonicSocket: AnyObject {
    func send(_ text: String) async throws
    func receive() async throws -> String
    func close()
}

/// The microphone and the speaker for a call.
protocol CallAudio: AnyObject {
    /// Starts both; `mic` gets the owner's voice as 16 kHz PCM16 mono bytes, in whatever sizes the hardware gives.
    func start(mic: @escaping @Sendable (Data) -> Void) throws
    /// Queues VAIC's voice (24 kHz PCM16 mono bytes) to play.
    func play(_ pcm: Data)
    /// Drops everything still queued to play (barge-in).
    func flush()
    func stop()
}

final class WebSocketSonic: SonicSocket {
    private let task: URLSessionWebSocketTask
    init(url: URL, session: URLSession = .shared) {
        task = session.webSocketTask(with: url)
        task.resume()
    }
    func send(_ text: String) async throws { try await task.send(.string(text)) }
    func receive() async throws -> String {
        switch try await task.receive() {
        case .string(let s): return s
        case .data(let d): return String(decoding: d, as: UTF8.self)
        @unknown default: return ""
        }
    }
    func close() { task.cancel(with: .normalClosure, reason: nil) }
}

@MainActor
final class SonicLink {
    enum End: Equatable {
        /// VAIC's side said goodbye (`closed`).
        case remote
        /// An `error` frame, or the socket or the microphone failed.
        case failed(String)
    }

    var onEnd: (End) -> Void = { _ in }
    /// The owner muted the call in CallKit: the microphone keeps running, nothing goes up.
    var muted = false

    private let socket: SonicSocket
    private let audio: CallAudio
    private let callId: String
    /// `call` was sent: VAIC knows which call this is, the microphone may go up.
    private var ready = false
    /// CallKit activated the audio session.
    private var audioOn = false
    private var audioStarted = false
    private var done = false
    /// The owner's voice not yet a whole frame.
    private var pending = Data()
    /// VAIC's voice that came before CallKit gave the app the audio session.
    private var held: [Data] = []
    /// Sends go out one after another, in order.
    private var sending: Task<Void, Never>?

    init(socket: SonicSocket, audio: CallAudio, callId: String) {
        self.socket = socket
        self.audio = audio
        self.callId = callId
    }

    func start() {
        Task { [weak self] in
            while let self, !self.done {
                do {
                    let text = try await self.socket.receive()
                    self.handle(text)
                } catch {
                    self.finish(.failed("The call's connection dropped."))
                    return
                }
            }
        }
    }

    func handle(_ text: String) {
        guard !done, let m = JSONValue.parse(Data(text.utf8)) else { return }
        switch m["type"].string {
        case "ready":
            guard !ready else { return }
            send(["type": "call", "id": .string(callId)])
            ready = true
            startAudio()
        case "audio":
            guard let d = Data(base64Encoded: m["data"].string ?? "") else { return }
            if audioStarted { audio.play(d) } else { held.append(d) }
        case "interrupted":
            held = []
            audio.flush()
        case "error":
            finish(.failed(m["message"].string ?? "VAIC's voice stopped."))
        case "closed":
            finish(.remote)
        default:
            break  // transcript, thinking: the call needs neither
        }
    }

    /// CallKit's `didActivate`: the app may use the microphone and the speaker now.
    func audioActivated() {
        audioOn = true
        startAudio()
    }

    /// CallKit's `didDeactivate`.
    func audioDeactivated() {
        audioOn = false
        if audioStarted { audio.stop() }
        audioStarted = false
    }

    /// The owner hung up: `stop`, then the socket closes.
    func hangUp() async {
        guard !done else { return }
        done = true
        send(["type": "stop"])
        await sending?.value
        close()
    }

    private func startAudio() {
        guard ready, audioOn, !audioStarted, !done else { return }
        do {
            try audio.start { [weak self] bytes in Task { @MainActor in self?.mic(bytes) } }
            audioStarted = true
            for d in held { audio.play(d) }
            held = []
        } catch {
            finish(.failed("The microphone could not start."))
        }
    }

    func mic(_ bytes: Data) {
        guard ready, !done else { return }
        pending.append(bytes)
        for frame in PCM.take(&pending, frameBytes: PCM.micFrameBytes) where !muted {
            send(["type": "audio", "data": .string(frame.base64EncodedString())])
        }
    }

    private func send(_ message: JSONValue) {
        guard let data = try? JSONEncoder().encode(message), let text = String(data: data, encoding: .utf8) else { return }
        let before = sending
        sending = Task { [socket] in
            await before?.value
            try? await socket.send(text)
        }
    }

    private func finish(_ end: End) {
        guard !done else { return }
        done = true
        close()
        onEnd(end)
    }

    private func close() {
        socket.close()
        if audioStarted { audio.stop() }
        audioStarted = false
        held = []
    }
}

/// The audio formats of a call, and the pure pieces of handling them.
enum PCM {
    /// The owner's voice, as Nova Sonic hears it.
    static let micFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: true)!
    /// VAIC's voice, as Nova Sonic speaks it.
    static let voiceFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 24_000, channels: 1, interleaved: true)!
    /// 64 ms of the owner's voice per frame (1,024 samples): about 2.7 KB of base64, well under the 24 KB limit.
    static let micFrameBytes = 2_048

    /// Takes every whole frame off the front of `buffer`; the rest stays for next time.
    static func take(_ buffer: inout Data, frameBytes: Int) -> [Data] {
        var frames: [Data] = []
        while buffer.count >= frameBytes {
            frames.append(Data(buffer.prefix(frameBytes)))
            buffer = Data(buffer.dropFirst(frameBytes))
        }
        return frames
    }

    /// Converts one buffer with a streaming converter (sample rate and sample format); the converter keeps its
    /// state between calls, so consecutive buffers join without clicks.
    static func convert(_ buffer: AVAudioPCMBuffer, with converter: AVAudioConverter) -> AVAudioPCMBuffer? {
        let ratio = converter.outputFormat.sampleRate / converter.inputFormat.sampleRate
        let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up)) + 32
        guard let out = AVAudioPCMBuffer(pcmFormat: converter.outputFormat, frameCapacity: capacity) else { return nil }
        var given = false
        var error: NSError?
        let status = converter.convert(to: out, error: &error) { _, inputStatus in
            if given {
                inputStatus.pointee = .noDataNow
                return nil
            }
            given = true
            inputStatus.pointee = .haveData
            return buffer
        }
        return status == .error ? nil : out
    }

    /// The bytes of a PCM16 mono buffer.
    static func bytes(_ buffer: AVAudioPCMBuffer) -> Data {
        guard let p = buffer.int16ChannelData?[0] else { return Data() }
        return Data(bytes: p, count: Int(buffer.frameLength) * 2)
    }

    /// PCM16 mono bytes as a buffer in `format` (a trailing odd byte is dropped).
    static func buffer(_ data: Data, format: AVAudioFormat = voiceFormat) -> AVAudioPCMBuffer? {
        let frames = data.count / 2
        guard frames > 0, let b = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames)),
              let p = b.int16ChannelData?[0] else { return nil }
        data.withUnsafeBytes { raw in _ = memcpy(p, raw.baseAddress!, frames * 2) }
        b.frameLength = AVAudioFrameCount(frames)
        return b
    }
}

/// The real microphone and speaker: one AVAudioEngine with Apple's voice processing on the input (echo
/// cancellation, so VAIC doesn't hear itself on the speaker). Started only inside CallKit's audio session.
final class SonicAudio: CallAudio {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let playFormat = AVAudioFormat(standardFormatWithSampleRate: 24_000, channels: 1)!
    private var toMic: AVAudioConverter?
    private var toSpeaker: AVAudioConverter?

    init() {
        engine.attach(player)
    }

    func start(mic: @escaping @Sendable (Data) -> Void) throws {
        let input = engine.inputNode
        try input.setVoiceProcessingEnabled(true)
        let hardware = input.outputFormat(forBus: 0)
        guard let toMic = AVAudioConverter(from: hardware, to: PCM.micFormat),
              let toSpeaker = AVAudioConverter(from: PCM.voiceFormat, to: playFormat) else {
            throw NSError(domain: "SonicAudio", code: 1)
        }
        self.toMic = toMic
        self.toSpeaker = toSpeaker
        engine.connect(player, to: engine.mainMixerNode, format: playFormat)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1_024, format: hardware) { buffer, _ in
            guard let out = PCM.convert(buffer, with: toMic), out.frameLength > 0 else { return }
            mic(PCM.bytes(out))
        }
        engine.prepare()
        try engine.start()
        player.play()
    }

    func play(_ pcm: Data) {
        guard engine.isRunning, let toSpeaker, let b = PCM.buffer(pcm), let out = PCM.convert(b, with: toSpeaker) else { return }
        player.scheduleBuffer(out)
    }

    func flush() {
        guard engine.isRunning else { return }
        player.stop()  // drops what is scheduled
        player.play()
    }

    func stop() {
        player.stop()
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        toMic = nil
        toSpeaker = nil
    }
}

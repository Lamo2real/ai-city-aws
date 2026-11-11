---
id: media.audio.loudness-and-audio-standards
department: media
domain: audio
title: 'Media: Loudness and audio standards'
summary: 'Loudness and audio standards: how loudness normalisation works and why louder gains nothing, targets by destination, Apple
  Podcasts loudness, EBU R 128 for broadcast, mono and stereo measurement, proposed house targets and what was not verified.'
type: benchmark
audience: both
confidence: platform-claim
volatility: annual
as_of: '2026-11-11'
review_by: '2027-11-11'
platforms:
- youtube
- podcasts
- tiktok
- instagram
objectives:
- quality
sources:
- https://support.spotify.com/us/artists/article/loudness-normalization/
- https://podcasters.apple.com/support/893-audio-requirements
- https://tech.ebu.ch/docs/r/r128.pdf
- https://sproutsocial.com/insights/social-media-video-specs-guide/
- https://podnews.net/article/lufs-lkfs-for-podcasters
seed_version: 1
---

**When to use this:** When mixing, normalising or exporting audio: loudness targets (LUFS, true peak) per destination, podcasts, broadcast and mono or stereo measurement.

**Source section:** 8. Loudness and audio standards

### How loudness normalisation works and why louder gains nothing

**[PLATFORM CLAIM] [FAST-MOVING, read 11 Nov 2026]** Spotify adjusts tracks to -14 LUFS (measured per ITU 1770) at playback and does not change the uploaded file. Louder masters are turned down. Quieter masters are turned up only as far as headroom allows, leaving 1 dB: Spotify's example is a -20 LUFS track with a -5 dBFS true peak that is raised only to -16 LUFS. Premium listeners can choose Loud at -11 LUFS (with a limiter), Normal at -14 or Quiet at -19 ([Spotify for Artists, loudness normalization, undated, read 11 Nov 2026](https://support.spotify.com/us/artists/article/loudness-normalization/)). The page is undated and addresses music delivery; it does not state a target for podcasts. **[INFERENCE]** A master louder than the platform target gains nothing because it is simply turned down, so mixing for dynamics is safe.

### Targets by destination

**[INFERENCE]** The table gathers the sourced targets. Rows marked unverified must not be used as specifications.

| Destination | Integrated loudness | True peak | Status | Date and source |
|---|---|---|---|---|
| Apple Podcasts | about -16 LKFS, tolerance ±1 dB | no higher than -1 dBFS | Platform's own page; measured per ITU-R BS.1770-5 | read 11 Nov 2026, [Apple Podcasts for Creators, audio requirements, read 11 Nov 2026](https://podcasters.apple.com/support/893-audio-requirements) |
| Spotify (music) | normalised to -14 LUFS at playback | below -1 dBTP; below -2 dBTP if the master is louder than -14 LUFS | Platform's own page; no podcast target stated | read 11 Nov 2026, [Spotify for Artists, loudness normalization, undated, read 11 Nov 2026](https://support.spotify.com/us/artists/article/loudness-normalization/) |
| European broadcast (EBU R 128) | -23.0 LUFS, tolerance ±1.0 LU where exact normalisation is impractical | -1 dBTP maximum | Standards body, version 5 | Nov 2023, [EBU R 128, version 5, Nov 2023](https://tech.ebu.ch/docs/r/r128.pdf) |
| Snapchat video ads | -16 LUFS | not stated | Vendor compilation, not checked on Snap's page | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Spotify and YouTube for podcasts | -14 LUFS as reported by a trade publication | not stated | Trade publication, stated without a cited source | 9 Oct 2026, [Podnews, page modified 9 Oct 2026](https://podnews.net/article/lufs-lkfs-for-podcasters) |
| YouTube video | commonly reported as about -14 LUFS, turn-down only | not stated | Unverified; no official statement found | not verified |

### Apple Podcasts loudness

**[PLATFORM CLAIM] [FAST-MOVING, read 11 Nov 2026]** Apple Podcasts specifies a target of about -16 LKFS with a tolerance of ±1 dB and a true peak no higher than -1 dBFS, measured per ITU-R BS.1770-5, and says loudness processing should be applied before encoding because encoding can cause clipping ([Apple Podcasts for Creators, audio requirements, read 11 Nov 2026](https://podcasters.apple.com/support/893-audio-requirements)).

### EBU R 128 for broadcast

**[DURABLE] [FAST-MOVING, Nov 2023]** EBU R 128, first issued in 2010 and at version 5 since November 2023, sets a target programme loudness of -23.0 LUFS, with a tolerance of ±1.0 LU where exact normalisation is impractical (for example live programmes) and a measurement tolerance of ±0.2 LU in quality-control workflows. The maximum permitted true peak in production is -1 dBTP. Measurement follows ITU-R BS.1770 with gating; metering follows EBU Tech 3341; loudness range follows Tech 3342 and is not recommended for programmes under one minute. Supplement s1 covers short-form content such as adverts and promos, s2 covers normalisation for streaming, s3 radio and s4 cinematic content ([EBU R 128, version 5, Nov 2023](https://tech.ebu.ch/docs/r/r128.pdf)). The s2 streaming supplement was not read.

### Mono and stereo measurement

**[FAST-MOVING, 9 Oct 2026]** The trade publication Podnews notes that a mono file at -19 LUFS sounds as loud as a stereo file at -16 LUFS and that stereo-oriented meters can misreport mono. It also points out that -23 LUFS (Europe) and -24 LUFS (United States) are broadcast standards and not podcast targets ([Podnews, page modified 9 Oct 2026](https://podnews.net/article/lufs-lkfs-for-podcasters)).

### Proposed house targets

**[INFERENCE] [CONTESTED]** The two research passes propose slightly different defaults, and both are inference. For podcasts, a single master at -16 LUFS integrated and -1 dBTP meets Apple's published target and sits within 2 dB of the commonly quoted -14 figure. For music-led and social masters, -14 LUFS integrated and -1 dBTP matches Spotify's published normalisation level. Deliver at -23 LUFS and -1 dBTP only to European broadcasters. A general speech target across platforms other than Apple remains unsourced, and YouTube's own target is unverified, so verify before mastering YouTube video louder than -16 LUFS.

### What was not verified on loudness

**[GAP]** YouTube's loudness target, the EBU R 128 s2 streaming supplement, AES TD1008 and Spotify's podcast specification were not read. The AES streaming guidance of roughly -16 to -20 LUFS for speech is unverified background recall. Snapchat's -16 LUFS comes from a vendor compilation.

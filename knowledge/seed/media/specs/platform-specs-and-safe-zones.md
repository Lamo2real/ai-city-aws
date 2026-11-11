---
id: media.specs.platform-specs-and-safe-zones
department: media
domain: specs
title: 'Media: Platform specs and safe zones (dated)'
summary: 'Platform specs and safe zones (dated): one vertical master for every platform, organic and ad video specs by platform, TikTok
  in-feed ad specs from TikTok, YouTube upload bitrates and thumbnail specs, caption file formats, safe zones from the platform templates,
  and image post sizes.'
type: benchmark
audience: both
confidence: platform-claim
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- youtube
- tiktok
- instagram
- facebook
- linkedin
objectives:
- reach
- quality
sources:
- https://sproutsocial.com/insights/social-media-video-specs-guide/
- https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads
- https://support.google.com/youtube/answer/1722171?hl=en
- https://support.google.com/youtube/answer/72431?hl=en
- https://support.google.com/youtube/answer/2734698?hl=en
- https://adcreate.com/blog/social-media-ad-sizes-safe-zones-2026
- https://www.trymypost.com/blog/social-media-safe-zones-templates-2026
- https://billo.app/blog/meta-ads-safe-zones
- https://strikesocial.com/blog/how-to-guarantee-unobstructed-ads-with-the-youtube-video-view-campaign-safe-zone/
- https://support.google.com/google-ads/answer/17140672
- https://www.digitalapplied.com/blog/social-media-image-sizes-2026-every-platform
seed_version: 1
---

**When to use this:** When exporting or uploading to a platform: aspect ratio, resolution, length, file size, bitrate, caption file format, thumbnail size or safe zones. Dated: verify anything past its date.

**Source section:** 7. Platform specs and safe zones (dated)

### One vertical master that uploads everywhere

**[INFERENCE] [FAST-MOVING, 2 Nov 2026]** Based on Sprout Social's compilation, a single 1080×1920 H.264 MP4 under 60 seconds uploads natively to all major vertical placements as of 2 November 2026 ([Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/)). The proposed vertical master is 1080×1920 at 30 frames per second (Facebook's listed cap), H.264 with AAC audio at 48 kHz, at 8 to 12 Mbps; keep it under 60 seconds when one file must serve every placement and export longer versions per platform. The compilation is a vendor's reading of platform limits, and the official Meta, LinkedIn, Pinterest, Snap and X spec pages were not read directly.

### Organic video specs by platform

**[FAST-MOVING, 2 Nov 2026] [VENDOR]** The table reproduces native direct-upload limits from Sprout Social's compilation, last updated 2 November 2026. It is a vendor compilation of platform limits and not the platforms' own pages.

| Platform and format | Resolution | Aspect ratio | Length | Max size | Formats and notes | Date and source |
|---|---|---|---|---|---|---|
| YouTube standard | 1920×1080 default, up to 8K | 16:9 default | 15 min unverified accounts; up to 12 h verified | 256 GB | MP4 H.264 with AAC-LC preferred; 24 to 60 fps | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| YouTube Shorts | 1080×1920 (min 720×1280) | 9:16 or 1:1 | up to 3 min | 256 GB | MP4 H.264, AAC-LC | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Instagram Reels | 1080×1920 (min width 720) | 9:16 (1.91:1 accepted) | up to 20 min in app; 3 s to 15 min via API | not published | MP4, MOV; cover 420×654; up to 5 hashtags | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Instagram Stories | 1080×1920 | 9:16 | up to 60 s per story | not published | keep about 250 px at top free of text | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Instagram carousel | 1080×1080 or 1080×1350 | 1:1, 4:5 or 3:4 | not published | not published | up to 20 items in app, 10 via API | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| TikTok in-feed | 1080×1920 | 9:16 | 10 min recorded in app; 60 min uploaded | not published | MP4, MOV, WebM; 23 to 60 fps | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| LinkedIn in-feed | 256×144 to 4096×2304 | 1:2.4 to 2.4:1 | 3 s to 10 min | 5 GB | MP4, MOV and others; 10 to 60 fps; 192 kbps to 30 Mbps | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Facebook video and Reels | 1080×1920 (min 720) | 9:16 | no in-app limit; 3 to 90 s via Reels API | 4 GB | MP4, MOV; 30 fps or below | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Facebook Stories | 1080×1920 | 9:16 | up to 60 s | 4 GB | MP4, MOV | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| X | 1280×720, 720×1280 or 720×720 | 16:9, 9:16, 1:1 | 0.5 to 140 s; Premium up to 4 h on web and iOS | 512 MB; Premium 16 GB | 30 or 60 fps | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Pinterest video Pins | not published | 1:1, 2:3, 4:5, 9:16 | 4 s to 15 min | 2 GB | MP4, MOV, M4V; H.264 or H.265; title 100 and description 800 characters | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Snapchat single video | 720×1280 | 9:16 | 3 to 180 s | 5 GB | MP4 or MOV, H.264; -16 LUFS audio | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Threads | up to 1920 px wide | 9:16 recommended | up to 5 min | 1 GB | MP4, MOV | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |

### Ad specs by platform

**[FAST-MOVING, 2 Nov 2026] [VENDOR]** The same Sprout Social compilation gives these ad pointers as of 2 November 2026.

| Ad placement | Spec as relayed | Date and source |
|---|---|---|
| Meta, Facebook feed video ads | 1440×1800 (4:5); 4 GB; MP4, MOV or GIF | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Meta, Stories and Reels ads | 1440×2560 (9:16); 4 GB; Instagram Reels ads primary text 44 characters | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| LinkedIn video ads | 4:5 recommended (720×900), also 9:16, 16:9, 1:1; 3 s to 30 min with 15 to 30 s recommended; 500 MB; MP4; 30 fps; SRT captions only | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| YouTube ads | skippable has no maximum, under 3 min recommended; non-skippable 15 to 20 s (30 s on connected TV); bumper 6 s; Shorts ads under 60 s recommended | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| X video ads | 1920×1080 or 1200×1200; up to 2 min 20 s, 15 s or less recommended | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Pinterest max-width video ads | 1:1 or 16:9; 4 s to 15 min; 2 GB | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |
| Snapchat ads | 720×1280; 3 to 180 s; -16 LUFS, stereo AAC or PCM, 192 kbps minimum | 2 Nov 2026, [Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/) |

### TikTok in-feed ad specs from TikTok's own page

**[PLATFORM CLAIM] [FAST-MOVING, read 11 Nov 2026]** For non-Spark auction in-feed ads TikTok recommends 9:16 (minimum 540×960), and also accepts 1:1 (minimum 640×640) and 16:9 (minimum 960×540); file types .mp4, .mov, .mpeg, .3gp and .avi; up to 10 minutes; up to 500 MB; bitrate at least 516 kbps. Spark Ads accept .mp4 or .mov with no duration restriction, and the caption is taken from the organic post with a maximum of 4 lines ([TikTok Ads Help, auction in-feed ads, read 11 Nov 2026](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads)).

### YouTube upload bitrates

**[PLATFORM CLAIM] [FAST-MOVING, read 11 Nov 2026]** YouTube's recommended SDR video bitrates at 24, 25 or 30 fps are 5 Mbps for 720p, 8 Mbps for 1080p, 16 Mbps for 1440p and 35 to 45 Mbps for 4K. At 48, 50 or 60 fps they are 7.5 Mbps for 720p, 12 Mbps for 1080p, 24 Mbps for 1440p and 53 to 68 Mbps for 4K. For HDR at 24, 25 or 30 fps they are 10 Mbps for 1080p and 44 to 56 Mbps for 4K. SDR colour is BT.709. Recommended audio bitrates are 128 kbps mono, 384 kbps stereo and 512 kbps for 5.1, at 48 kHz ([YouTube Help, recommended upload encoding settings, read 11 Nov 2026](https://support.google.com/youtube/answer/1722171?hl=en)).

### YouTube thumbnail specs for standard video

**[PLATFORM CLAIM] [FAST-MOVING, read 11 Nov 2026]** YouTube recommends video thumbnails of 3840×2160 pixels (16:9) with a minimum width of 640 pixels, in JPG or PNG, with a size limit of 2 MB on mobile and 50 MB on desktop. Podcast playlists use 1:1 thumbnails ([YouTube Help, custom thumbnails, read 11 Nov 2026](https://support.google.com/youtube/answer/72431?hl=en)).

### Caption file formats

**[PLATFORM CLAIM] [FAST-MOVING, read 11 Nov 2026]** YouTube accepts .srt and .sbv files (plain UTF-8, no styling), .vtt (positioning and limited styling), .ttml and .dfxp, .smi, .scc, EBU-STL and other broadcast formats ([YouTube Help, supported subtitle files, read 11 Nov 2026](https://support.google.com/youtube/answer/2734698?hl=en)). **[FAST-MOVING, 2 Nov 2026] [VENDOR]** LinkedIn video ads accept SRT only, per Sprout's compilation ([Sprout Social video specs guide, updated 2 Nov 2026](https://sproutsocial.com/insights/social-media-video-specs-guide/)). **[INFERENCE]** Deliver a sidecar .srt in UTF-8 as the universal caption file, plus .vtt for web players.

### Safe zones: use the platform templates

**[PLATFORM CLAIM] [FAST-MOVING, read 11 Nov 2026]** TikTok's official position is that the safe zone depends on orientation, caption length and add-on formats, and it provides a downloadable safe-zone file with separate right-to-left and anchor versions ([TikTok Ads Help, auction in-feed ads, read 11 Nov 2026](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads)). This is the only official safe-zone statement the research read.

**[VENDOR] [CONTESTED] [FAST-MOVING, Feb-Mar 2026]** Safe-zone pixel values on a 1080×1920 canvas come only from vendor blogs that cite no platform and disagree with each other. AdCreate (19 February 2026) says to keep clear the top 192, bottom 384 and right 162 pixels on TikTok; the bottom 480 and right 162 pixels on Reels and Shorts; the top 270 and bottom 384 pixels on Stories; and the top 288 and bottom 384 pixels on Snapchat ([AdCreate, 19 Feb 2026](https://adcreate.com/blog/social-media-ad-sizes-safe-zones-2026)). TryMyPost (30 March 2026) says the bottom 250 and top 100 pixels on Reels, a right strip of 120 pixels and the bottom 20% on TikTok, and as a general rule to keep text 250 pixels from the top and bottom and out of the rightmost 150 pixels ([TryMyPost, 30 Mar 2026](https://www.trymypost.com/blog/social-media-safe-zones-templates-2026)). The Reels bottom margin is 480 pixels in one and 250 in the other.

**[INFERENCE] [FAST-MOVING, Nov 2026]** Until official templates are checked, a conservative cross-platform text-safe box on a 1080×1920 canvas keeps clear the top 290 pixels, the bottom 480 pixels, the left 60 pixels and the right 165 pixels. This takes the largest vendor value for each edge; the left value is the researchers' own assumption. Replace it with the platform's own template for any paid placement.

**[GAP]** No official safe-zone page from Meta (Reels and Stories), YouTube (Shorts), LinkedIn, Pinterest or Snapchat was found. The often-quoted Meta Reels margins of 14% top, 35% bottom and 6% sides are unverified: a targeted search returned only third-party pages. Unread vendor leads are [Billo, unread vendor page](https://billo.app/blog/meta-ads-safe-zones) and [Strike Social, unread vendor page](https://strikesocial.com/blog/how-to-guarantee-unobstructed-ads-with-the-youtube-video-view-campaign-safe-zone/); an unread Google Ads page on Demand Gen image assets is [Google Ads Help 17140672, unread](https://support.google.com/google-ads/answer/17140672). The Instagram 3:4 profile-grid crop was not sourced.

### Image post sizes and other bitrates

**[GAP]** Feed image sizes per platform were not researched; an unread lead is [digitalapplied.com 2026 image sizes, unread](https://www.digitalapplied.com/blog/social-media-image-sizes-2026-every-platform). Bitrate recommendations for platforms other than YouTube and TikTok ads were not found.

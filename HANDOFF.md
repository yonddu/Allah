## Completed: prayer socks and joined feet · 2026-11-06

Live: https://noorrealm.com . Deployed source a2f62d7615a7ab42afa436cc0e74ca19a8ba2c8f; Cloudflare build c064af29-ad5e-4196-81f4-67145dffc20b stopped/success; Worker version ad2a57d3-c4d0-40ea-a084-8ea4b867e50d. HTTPS DNS and health verification succeeded.

Female models08–10 now wear opaque prayer socks (dark for08, ivory for09/10), including standing, bowing, prostrating and sitting. Closed foot/cuff shells share the avatar skeleton; a per-avatar foot-texture guard also covers any original mesh protrusion. Face/hand textures remain original. Sock coverage persists during the brief getting-up transition, then returns to the ordinary non-prayer appearance. Men do not receive socks.

All ten characters bring their feet together and keep them parallel in all four prayer poses. Actual source foot edges calibrate leg bind positions and ankle targets instead of assuming the same original stance width. Standing/bowing soles, kneeling toes and knees remain planted on the mat. Forehead contact and palm orientation are preserved. Exiting prayer restores ordinary leg rotations for walking. Existing closed waist/thigh/calf coverage follows the calibrated leg positions.

GitHub Verify 42206073962 / job127852915129: success. All49 Node tests passed; mobile browser flows, public/private chat bubbles, character changes, both maps, party synthetic-microphone audio/outsider isolation/prayer stop, donation,50-slot admission and isolated100-client networking passed. Local additional check covered240 remote combinations (10 models x2 detail levels x3 yaws x4 poses), with actual inner foot gaps12–20.54mm and no intersections. Physical Android FPS remains unmeasured.

Visual review completed: four all-character sheets (200 full-body camera views) plus four female foot-detail sheets (36 closeups). All10 models are clothed in the folded poses; female feet show sock material rather than bare skin, and feet are visibly together. Some top foot-closeup views are naturally occluded by the covering garment/body; full-body top and rear/side views were also reviewed. Original supplied garments retain automatic weighting, not manual cloth simulation.

An earlier Verify attempt42205464527 stopped at the own-public-bubble wait after creating peer tabs. The check now brings the game tab to foreground before testing animated head labels and respects the server chat interval; it also captures state on failure. Subsequent full run passed. No production chat logic changed in this release.

The local workspace contains a partial working copy of this GitHub-backed project. Node actual-mesh tests run locally, but local Wrangler exits with uv_interface_addresses system error1; integration testing is on the repository's normal GitHub runner. Reload existing site tabs to load fresh modules. This handoff-only commit follows the validated/deployed application source.

## Prayer socks and joined feet · implementation history

User requests opaque socks for female characters during prayer and feet together for all characters in all prayer poses. Actual foot boundaries now calibrate leg bind positions and target ankle spacing per supplied mesh; this avoids fixed-offset crossing/overlap between differently authored models. Standing/bowing soles, and sitting/prostration toes/knees stay planted. Exiting prayer blends lateral leg rotation back to ordinary walking. Female models08–10 use closed opaque sock/cuff shells and a shader guard for original lower-foot texels; per-avatar uniforms keep this prayer-specific and keep coverage during the getting-up transition. The existing hip/leg undergarment follows the calibrated leg positions.

Local actual-mesh tests pass all10 models and all4 poses: foot inner gap 3–25mm, mat contact, female-only sock activation, transition coverage, restored non-prayer stance, existing forehead/knee/toe/palm checks. Local Wrangler cannot start because uv_interface_addresses returns system error1; use GitHub's normal Verify runner for integration renders. Extended visual check to200 full-body views plus36 closeups of female socks (three models x four poses x three views). Inspect the resulting rendered sheets before deployment.

## Completed release · 2026-11-06

Live application: https://noorrealm.com (old workers.dev URL also stays active).
Deployed source: 747ab254fdd2109f56b75d41cd36e223f09f0e02.
Cloudflare build: 76ae5165-de32-4ae2-8c68-8ba4b8d110d7, stopped/success.
Worker version: a26437a1-e3ad-4596-9f6f-bf467c7426d5.
HTTPS DNS and /api/health verification succeeded after deployment.

GitHub Verify run 42202516235, job 127841021097: success. 49 Node tests passed; actual browser flows, public-message bubbles, expiry, literal HTML/Arabic/Korean text, whisper exclusion, privacy-change clearing, character switching from Settings, donation QR and requested Korean support message passed. Synthetic microphone WebRTC sent actual audio to both party peers; outsider received none, prayer ended tracks/peers, no auto microphone restart. Capacity admission stayed50 with51st rejected; isolated100-client network check passed. Real low-end Android FPS remains unmeasured.

Clothing QA: inspected all three contact sheets from this final source (10 models x prostrating/sitting/bowing x front/back/left/right/top =150 views). The first larger ellipsoid design was rejected visually as too bulky; final fitted opaque undergarment and guarded original hip textures cover the previously exposed body without the swollen waist. All10 final views showed covered hips/pelvis/legs; hands/faces/feet remain original. Supplied garments still use automatic weights; no manual cloth simulation or authored garment rig is claimed. Forehead/toes on mat and knees/head separation also pass all10 actual-mesh tests. The emergency three-pose restriction is now lifted: standing/bowing/prostrating/sitting are all enabled.

Taj prayer uses +Z (PI yaw), along the user's marked pool-side path; avatar, mat and invisible barrier share prayerYaw. Noor stays -Z. Settings opens character/outfit customization in-game. Public speech bubbles follow the head, expire4.5–9sec and show only within12m, through the exact public-chat visibility filter; server-authoritative playerId prevents another-avatar attribution. Whispers never become bubbles. Prayer/privacy changes and disconnect clear them. Donor message: “여러분의 후원으로 서버가 유지, 개선 됩니다. 감사합니다. 평화가 있길”, translated into all21 languages. Ko-fi link/QR and six-member same-server private opt-in party voice are deployed.

Only this documentation changes after the validated application source. Reload existing game tabs for fresh modules.

## Chat bubbles and support message follow-up · 2026-11-06

Public-chat bubbles use the server-authoritative playerId and the same Community visibility filter as the dock. Whispers never become bubbles; prayer, block/privacy changes, disconnect and avatar disposal clear or hide them. They use textContent, auto text direction, a 4.5–9s expiry, head-following labels and a 12m range. The Ko-fi dialog now displays the requested support/peace message in all 21 languages. The first 150-view coverage review found opaque coverage but oversized undergarment ellipsoids; these have been tightened to body proportions and require a second visual review before deploying/restoring prostration.

## Urgent clothing coverage and settings/Taj corrections · 2026-11-06

The user reported visible bare buttocks during prostration. Prior validation checked joint/floor contact and did not adequately check clothing coverage. Production interim commit 448e40a31a92220f9383f62a07b596b7697444e3 temporarily removes prostration from pose selection while full coverage is repaired. Interim build e90257a5-1dcb-4eeb-8c7a-f3bc2f43191f succeeded, including HTTPS verification of noorrealm.com. Settings now also opens character/outfit customization.

Current repair adds a closed opaque garment underlayer at waist/pelvis/both thighs/calves plus a per-avatar shader guard against exposed skin-tone texels in the covered hip region. No face/hand/foot texture is changed; original supplied meshes/UVs remain. Coverage remains through pose-to-standing transitions. The material copies are per avatar so one person's prayer does not recolor another standing person. All 10 characters are to be rendered from front/back/left/right/top in prostrating/sitting/bowing poses (150 images), with contact sheets for visual review. Restore the fourth prayer pose only with the repaired asset code.

User also marked Taj prayer direction along the pool-side path toward the entrance (+Z). prayerYaw(taj) now returns PI; body, mat and invisible movement barrier use that same shared direction. Noor sanctuary remains -Z. This is virtual map alignment, not a real geographic Qibla compass.

Donation/party/domain work is complete in the deployed interim code: Ko-fi QR decoded correctly; all 47 prior tests, browser flows and actual synthetic-microphone WebRTC audio delivery passed GitHub run 42198463458. First domain verification ran before DNS/TLS propagation and failed; the next build e90257a5-1dcb-4eeb-8c7a-f3bc2f43191f passed HTTPS health verification. Production voice relay credentials were validated by the deploy script; do not expose private keys.

## In progress: donation, private party voice, noorrealm.com · 2026-11-06

- Added central bottom Support button and modal with https://ko-fi.com/solh130919 and a lossless SVG QR. The 29x29 supplied QR pattern matches version 3/M/mask 2; independent jsQR decoding confirms the exact destination. The SVG adds a four-module quiet zone. No payment request or transfer is performed by the app.
- Same-room parties of up to six: create, consent-based invite/accept/decline, leave, leader-only removal, automatic leader change, disconnect cleanup and hibernation-safe membership in socket attachments. A third avatar-menu action invites to party. Party state and WebRTC descriptions/candidates go only to eligible party members.
- Voice is explicit opt-in, mono Opus capped at 32kbps per sender. Microphone acquisition, mute, disconnect, volume and autoplay recovery are exposed. Prayer mode immediately stops capture and closes send/receive connections; ending prayer does not resume the microphone. Blocks and membership/epoch changes remove peers. ICE/SDP is server-authorized and never room-broadcast. Production uses relay-only short-lived Cloudflare TURN credentials; real browser tests use a server-only local test mode.
- noorrealm.com is an active Cloudflare zone (ecfdbba3a956535ef60bc6979ecc181d) with active Universal SSL. ICN management endpoints for Workers domains/secrets returned 503. The source declares the custom domain, and the build deploy stage configures runtime TURN secrets using build-secret values, then deploys and verifies HTTPS health from the remote build environment. No secret is committed or printed. An attempted cleanup of an unused TURN key was automatically rejected; no deletion was performed. Additive provisioning was used instead, leaving earlier unused keys intact.
- Voice deployment uses Cloudflare build trigger c28274b5-3494-46ac-860e-3cd248ddb8e2; deploy command: node scripts/configure-voice.mjs && npx wrangler deploy && node scripts/verify-domain.mjs . Secrets are configured on that build trigger and injected into the Worker by configure-voice.mjs. Keep these server-side.
- New UI labels cover all 21 languages through feature-labels.js. The existing language catalogs remain unchanged.
- Validation and final deployment results are recorded after CI. The execution environment remains unavailable; code is edited through GitHub and tested on its existing runner.

## Completed prayer/contact and avatar-menu repair · 2026-11-06 (Asia/Seoul)

- Deployed application commit: f74dd40e78c6e185ca94821871f3f82b584ef982.
- GitHub Verify run 42191526873: success. All 39 Node tests passed, including actual forehead/toe skin vertices and knee anchors for all ten user-supplied models, head facing floor and separated from knees, palms facing inward at multiple avatar yaws, and server-side directed-greeting validation. Browser tests passed actual right-click picking, directed greeting and whisper selection/delivery, four prayer poses, onboarding, languages/RTL, chat/block/mute, both courtyards and 50-slot admission/51st rejection.
- The side-view prostration image emitted by the CI renderer was inspected: forehead is on the mat forward of the knees, palms on the mat, pelvis raised. Supplied garments still use automatic weights, so cloth folds are approximations. No manual garment rigging is claimed.
- Cloudflare build d998553a-7980-453b-852f-76c8ae800adc finished stopped/success and deployed to https://allah.songyd1018.workers.dev . Reload existing tabs for new modules. Production remains 50. Geometry/material budgets are unchanged. Actual low-end-phone FPS remains unmeasured.
- Remote 100-client network test: 2,000/2,000 movement acknowledgements, ACK p95 98ms, public 100/private 2 delivery. Software-render capacity snapshots are not physical Android FPS.

## Prayer contact, inward palms and avatar action menu · 2026-11-06

- User reported that prostration folded the face onto the knees and that the hands still faced outward. Replaced numeric wrist roll with a world-space palm frame derived from forearm direction and inward torso normal. Added actual-mesh forehead/toe landmarks, a calibrated pelvis/spine/neck pose and planted knee/ankle solving. Prostration faces downward with forehead and toes on the mat, and head forward of knees. Supplied geometry/UVs remain unchanged.
- Right-clicking another visible avatar opens Greet / Whisper; touch devices use a 550ms hold, cancelled by dragging. Menu actions respect prayer mode, blocks and whisper preferences; leaving avatars close the menu. Greeting targets are validated on server and the sender faces the selected visitor. No automatic messages are sent as greetings.
- The execution environment is unavailable in this turn. Source changes are made against the current GitHub head and validation runs in the existing GitHub Actions pipeline, including actual-mesh contact tests for all ten models and real browser context-menu interactions. Final results/deployment are recorded after validation.

## Completed respectful-interaction release · 2026-11-06 (Asia/Seoul)

- Deployed application commit: bcb96a9f9c29a9f99eac2aaf5a1c47cae1a8e603.
- GitHub Verify run 42185106757: success. 37 Node tests, build and Worker dry-run, mobile onboarding, greeting, prayer-only Quran.com button, hidden chat/greeting in prayer, all four prayer poses, settings language/RTL, both courtyards, public/private chat/mute/block, and actual 50-slot admission/51st rejection passed. Browser page errors: 0. Final mobile screenshots were inspected; chat and bottom actions no longer overlap.
- Cloudflare build 7746cf06-7370-4870-88a4-fd9ffeb6cc3a: stopped/success; deploy log confirms Worker version a95cf84f-a9d0-43a8-b909-87db5c0e8fcc and https://allah.songyd1018.workers.dev . Existing visitors must reload for updated assets/UI.
- 100-client isolated network check: 2,000/2,000 move acknowledgements; ACK p95 97ms; 100 public recipients and 2 whisper recipients; overflow 503. These are local-emulator metrics, not Internet/mobile measurements.
- Actual 32-avatar scene: 53 draws / 229,019 triangles, including prayer mats. Capacity renderer recorded 50 bodies ready / 59 draws / 346,496 triangles, but its later software-render frame sampler produced no fresh frames and the 100-body counters were stale. Do not claim measured physical-phone FPS or a fresh 100-body render budget. Production remains 50; entry-level Android profiling is outstanding.
- Visual limits remain: supplied meshes use automatic skin weights; deep prayer bends and long garments are approximate and may benefit from hand-painted weights. Greeting and relaxed walking poses were additionally reviewed using CPU renders of the actual supplied mesh. No replacement character was invented.

## Respectful prayer interactions and courtyard refresh · 2026-11-06 (Asia/Seoul)

Current user requests supersede the older paid-fence/Qibla/Kaaba plans below.

- Removed visible fence geometry, preview/sales UI and friend exemptions. Every praying avatar now has a rotated invisible mat/front collision area, checked on server and client, even for blocked avatars. Prayer entry rejects occupied/overlapping areas and landmark boundaries. Visitors caught inside on reconnect may walk outward. Prayer exit/disconnect releases the area. No jumping control exists. All ten supplied meshes were visually checked to be barefoot; retain this constraint for future assets.
- Prayer mode hides/clears chat locally and suppresses public chat, whispers and greeting events at the server in both directions. Saved public/whisper preferences are unchanged, and messages suppressed during prayer are not replayed. Personal Quran recitation remains personal; there is no voice-chat subsystem.
- A prayer-only Quran.com link appears on the bottom actionbar and opens a new tab. Existing top link remains available outside prayer.
- Greeting action is right hand to chest plus a slight head nod (not a prayer bow), with an Arabic السلام عليكم bubble. Server authenticates sender, enforces cooldown, honors blocks and skips praying recipients. Walking rotates palms inward and softly curls the supplied finger geometry using four added knuckle bones (22 bones total). Prayer poses keep open hands and remain restricted to prayer mode.
- Removed the compass/Qibla card and all direction-sensor use from the application path. New location.js requests coordinates only on the prayer-time location button, using one-shot low-power GPS. Prayer times/city/manual coordinates remain. No coordinates are sent to our server.
- Main mecca-compatible room IDs now open an original Noor Grand Sanctuary courtyard. No Kaaba structure remains. Large turquoise ribbed dome, layered tiled entrance arch, four minarets and side arcades are baked into material-merged GLBs. Low: 7 draws, 23,593 triangles, 962,048-byte GLB; high: 7 draws, 38,481 triangles, 1,513,232 bytes. Taj courtyard remains selectable. Generic sanctuary prayer faces the virtual front; this is not a physical Qibla compass.
- Settings now contains the language chooser; changes apply during play and persist. All 21 locale catalogs include new labels/help/notices.
- Preserve user-supplied character models, feminine hair covering, native-resolution labels, centered camera and 50-person production cap. No Allah/Prophet figurative depictions or prayer-as-game emotes.
- Local 37 Node tests, syntax checks and Worker dry-run pass. Managed local browser preview could not launch with the current Wrangler/preview CLI; remote CI browser screenshots/integration results and deployment result are recorded after completion. Actual entry-level-phone FPS is still unmeasured.

## Deployment completed · 2026-11-06 (Asia/Seoul)

- Deployed application commit:9339585a933d4e063db36ea9a636d643122b6bee.
- GitHub Verify run42158372299: success.33Node tests, reproducible supplied-model build, Worker dry-run, real50-slot admission/51st rejection, onboarding/three female presets/mandatorycovering, analog movement, private/public chat/mute/block, both maps/complete Taj dome, Qibla/five prayers, RTL, and100-client stress all passed. Browser page errors:0.
-100-client CI:2,000/2,000 moves acknowledged,2,000 delivered batch frames,12,478,000bytes,3,015ms; local ACKp95=90ms. Public recipients100,whisper recipients2;101st rejected. These are isolated local-emulator metrics.
- Standing50-avatar view:63draws/361,131triangles;100:113draws/684,081triangles. Software WebGL screenshots were inspected. These do not prove physical entry-level Android30fps. The3–4GB/30fps target remains; actual-phone profiling is outstanding.
- Cloudflare deployment build:d4b4d33c-5a19-49ff-a439-1e15e66b0d83. Deploy command succeeded; Worker version79a5791d-7925-4a89-94da-b9d1a2011121. API status/binding verification recorded in session: production NOOR_ROOM_CAPACITY=50.
- Play:https://allah.songyd1018.workers.dev . Reload an existing tab for the new user-supplied GLB catalog, centred camera/readable names and50-person limit. Existing movement clients keep legacy full-state compatibility.
- Material visual limit: the supplied GLBs have no author-painted skin weights. Automatic18-bone prayer poses are functional, but long garment folds at deep bends/prostration still need manual rigging/weight refinement. Preserve supplied faces/clothes and do not replace them with invented meshes.
- Public URL probes from this executor returned403; the successful Cloudflare deployment API, deployed binding, build logs and local integration tests were used for verification. Do not interpret executor-proxy denial as a confirmed public-site failure.

## Latest decision:50 visitors per production room · 2026-11-06

User explicitly changed the production limit from32 to50, retaining the3–4GB Android /720–1080p /30fps target. wrangler.jsonc now pins NOOR_ROOM_CAPACITY=50; Worker default/API room capacity and offline UI fallback are50. The real local browser test fills50 slots and rejects51 with503.100 remains an isolated capacity override; do not imply100-person phone30fps. Unknown-memory mobile browsers default to the conservative low profile.50/100 rendering are included in the capacity report; real entry-level-device FPS is still unmeasured.

## Capacity check and movement protocol · 2026-11-06

Production remains32 visitors/room. A bounded server-only NOOR_ROOM_CAPACITY override accepts32/64/100 for isolated tests; the client cannot set it. scripts/capacity-smoke.mjs runs a separate local Worker with100, checks101st rejection,100 public-chat recipients,2 whisper recipients,2,000 moves and32/100 actual-model rendering. No production traffic or data are used.

Baseline100-moving-client test:2,000 acknowledged moves,200,000 delivered frames,90,564,000 bytes,14,639ms to drain, ACKp95=11,184ms. Movement was repeatedly deserializing peers and individually broadcasting full profiles. Version2 negotiation now batches latest numeric movement deltas every75ms, encodes each batch once, avoids protected-host scans when no fence is active, and keeps profile/prayer updates immediate. Legacy clients still receive full state. Full profile state is retained client-side and merged with deltas; pending movement is invalidated before prayer/profile changes to prevent stale rollback. Tests cover both protocols and self reconciliation.

After batching local100-client result:2,000 acknowledged moves,2,000 delivered frames,12,478,000 bytes,3,020ms elapsed; ACKp50=89ms/p95=100ms; public100/private2/capacity101 rejection passed. Those are local-emulator latencies, not Internet or phone measurements. The renderer displayed all100 supplied models:113draws/684,081triangles, versus32=42draws/225,498triangles in the same standing scene. Desktop software WebGL managed only~1–2fps and cannot establish physical Android FPS. Do not claim100-person entry-level-phone30fps. Production cap stays32 until real-device profiling and further crowd rendering work justify raising it.

Current supplied assets: full geometry6,197–6,457triangles with1K maps; safe remote maps512. Aggressive geometry reduction was rejected by appearance QA for most variants (allfar retain original topology; only two near meshes pass~2.5k). Never claim800-triangle distant models. Deduplicated loading fetches only the chosen full model for self and low-texture geometry for others; shared geometry/materials, view-frustum culling, and12Hz distant skeletal updates limit CPU/GPU memory. Source faces/clothes are unchanged. Automatic weights were smoothed at shoulders; further manual garment rigging may improve deep bends.

## Supplied GLB integration · 2026-11-06

User provided the new /chracter Dropbox link. It contains10 actual Meshy GLBs (~6.2–6.5k triangles each), one material, embedded color textures, no skins/animations. Use these supplied files; do not substitute the experimental Blender-generated landmarks or old projected reference avatars. scripts/user-model-sources.json pins each original file by SHA256 and size. Build downloads the already-public supplied folder and prepares the assets; no binary model blobs need to be committed to GitHub. The authoring workflow for experimental landmarks remains manual-only and unused.

The new model catalog contains7 male and3 female complete dressed-character presets; all3 female models cover hair. Faces and clothes are part of each supplied mesh, so the UI selects a complete character/outfit. Server validates model IDs against gender. Original topology/UV/materials remain in the full model, scaled to1.8m and turned to -Z. Attribute-aware LOD simplification preserves UV islands; native-resolution HTML labels and centred camera are retained. Source models are unrigged: runtime18-bone spatial weights drive existing walk/prayer IK. This automatic rig needs visual review of bows/prostration and is not a manually painted production garment rig.

Final validation/deployment results will be recorded after the visual pass. Actual3–4GB phone FPS remains unmeasured.

## User-supplied models only · 2026-11-06

The user explicitly stopped replacement model generation: “노노 내모델써라”. Do not deploy the newly authored Blender landmarks or replace characters with generated models. The original Dropbox /salah folder was inspected: eight PNG references, no GLB/FBX/OBJ or subfolders. User-provided3D assets are pending. The Blender authoring workflow is now manual-only; its generated files are not integrated into the app. Local experimental landmark merge was reverted before deployment.

Continue the authorized camera and readability repair: centred body framing, native-resolution HTML labels, larger mobile chat text, sharper bounded low-quality rendering, lighter draw count through HTML labels and instanced contact shadows. The dressed-character authoring target remains12,000 exported triangles total, GLB/T-pose,1K maps. Do not claim actual3–4GB phone FPS without device measurements.

## Graphics/readability repair in progress · 2026-11-06

User rejected the low-detail appearance and requested a centred avatar, readable labels and Blender-authored background models; the user will provide character models. CHARACTER_ASSET_SPEC.md sets a12k-triangle dressed-character target.

Camera now follows the character body centre (standing focus .94m; default camera1.6m /5.2m distance), with pose-dependent focus and preserved portrait framing. Player labels use native-resolution CSS2D HTML, not textures rendered inside the reduced-resolution3D canvas. Nearby/friend labels are shown, blocked labels remain hidden. Device memory/cores select quality, so capable phones no longer get forced into low mode; balanced mode targets30fps. Adaptive resolution floors at85% rather than65%. Low quality starts at DPR1.25 (650k render-pixel cap), so a390px-wide phone retains at least414 render columns after adaptation. Chat body/tabs are12px and hint text11px, on an opaque dark panel. MSAA, lower ambient fill, and a single instanced soft contact-shadow draw improve edges, contrast and grounding.

scripts/blender-landmarks.py authors Kaaba and Taj main landmarks in Blender4 with folded cloth, bevels, detailed doors, real portal cavities, cornices, inlays and smooth domes, exporting embedded low/high GLBs. The dedicated author-assets workflow runs official Ubuntu Blender and uploads the files for validation/integration; final authoring and deployment results are recorded after completion. This authoring step is separate from ordinary Cloudflare builds.

## Completion record · 2026-11-06 (Asia/Seoul)

- Final application commit: d2210ee91974f9176a93dd21ff334929dc195673.
- GitHub validation: https://github.com/yonddu/Allah/actions/runs/42118205483 — success.28 Node tests, Cloudflare dry-run, real local-Worker browser flows (onboarding, full Taj dome in play view, Qibla, analog joystick, all5 prayer rows/timezones/Quran link, whispers with3 isolated sessions, mute/block/unblock, both maps and RTL) passed. Browser report has no page errors.
- Mecca32-total-avatar budget:116 draw calls,93,778 triangles. Taj solo:13 draw calls,17,249 triangles. These were software Chromium rendering-budget checks, not actual low-end Android FPS tests.
- Cloudflare deployment build:2d4da05e-4dee-49c9-ac77-67b07a007405. Status: stopped / success, verified through the Cloudflare Builds API. The pinned application commit was deployed successfully.
- Play URL: https://allah.songyd1018.workers.dev . Refresh an already-open tab to load the new maps, compact HUD, original-image-based avatar choices and local prayer-time tools.
- Remaining product limits: actual billing is disabled; front-image-based3D heads/clothes have approximated side/back geometry; physical3–4GB phone performance and local-mosque timetable review still need real-device/local validation. Prayer times are starts, not congregational iqamah schedules.

## 2026-11-06 outdoor worlds, Quran link and five daily prayer times

- Active maps are now mecca and taj, each with3 rooms /32 visitors. Old zayed/nabawi room IDs migrate to mecca and blue IDs to taj through parseRoom. Menu and generated GLBs contain only the two new worlds.
- Both courtyards have a168x188m ground slab and148x168m walking bounds, with open sky and distant architecture. Makkah has a Kaaba landmark, concentric marble paths, two-level arcades, minarets and a distant skyline. Taj Mahal has a marble monument, onion dome, four minarets, gardens, cypress rows and a reflecting pool. These are inspired virtual reconstructions, not exact surveys. No invented Arabic sacred lettering is used for the geometric Kaaba brocade.
- Server and client use the same map-aware collisions; the Kaaba, Taj building and reflecting pool are excluded from movement. Mecca prayer faces the in-world Kaaba; Taj prayer uses the geographic Qibla bearing at Agra. Fence collision and rendering account for avatar rotation. Spawn positions and map camera angles frame the new landmarks.
- Top HUD retains compact icons on mobile. Quran link opens the verified https://quran.com/ in a separate tab, with no referrer. The user typed guran.com; Quran.com is the intended Quran-reading site and this assumption was stated in commentary.
- Prayer-time clock icon opens5 daily start times and the next-prayer countdown. GPS and manual city/coordinates update both Qibla and prayer times. Coordinates stay in browser memory; only method/Asr/Isha-adjustment preferences persist locally. No external prayer/geolocation service is used. Timezone is estimated offline, shown explicitly and editable; city presets have known IANA zones. Intl handles DST. Selected-location calendar date and tomorrow Fajr are computed independently of the device timezone.
- Adhan4.4.6 (MIT) and maintained tz-lookup11.7.0 (CC0) are vendored in public/lib; see UPSTREAM.md and licenses. Methods, Shafi/Hanafi Asr, Isha correction and high-latitude handling are exposed with local-mosque timetable guidance. There are no scheduled notifications or new permission prompts on entry; GPS is requested only by the location button.
- Local Node suite:28 tests pass, including target-zone date boundaries, DST/host-zone independence, tomorrow Fajr, Hanafi timing, Isha correction and polar summer handling. Outdoor integration commit3ea9695d passed GitHub run42117528910: full Worker dry-run,28 Node tests, mobile onboarding/Quran link/five prayer rows, timezone choice, private-chat isolation, mute/block/unblock, map switching and RTL. The32-avatar Makkah view used116 draws /93,778 triangles in software Chromium; Taj solo used13 draws /17,249 triangles. A final visual pass widens the play camera to80 degrees with a higher look target to keep the full Taj dome in view (portrait mode stays56 degrees), and corrects sleeve UVs to sample cloth rather than neighbouring reference cells. Final deployment status follows in the completion record. Actual3–4GB Android FPS remains unmeasured.

## 2026-11-05 compact HUD, private chat and reference avatars

- Play HUD: a 104px mobile Qibla widget stays upper-left; room/language/settings and social buttons stay on top. Joystick is bottom-left, collapsible chat bottom-right, prayer/customize/fence actions on the bottom edge. Customize panel is closed until requested. The camera centers the avatar at a closer 5.6m distance.
- Public and whisper tabs have independent server-persisted off settings. The people button opens the current-room visitor list, the two chat switches and blocked list. Messages are ephemeral, capped at 100 in the browser, and rendered using textContent.
- A whisper targets an authenticated account currently in the same room, never broadcasts to bystanders, and is rejected if either side blocks the other or either side disables whispers. Public delivery respects each receiver's public switch, block relationship and paid friends-only rule. COMMUNITY access is fetched for each chat send; the client cannot supply paid/sender identity flags.
- New SQLite tables chat_preferences and blocks are created idempotently. Blocks are owner-scoped (max200), persist across DO restart, hide the blocked person's body/name/rug locally, and purge their old chat. A protected fence remains visible to explain collision boundaries. Cookies remain anonymous device accounts; payments are still disabled.
- Attached original references are now available and processed. Character presets: six male faces + one female face; wardrobe: eleven male + four female outfits. Female face/outfit combinations and hijab enforcement run through sanitizeProfile on client and server. Old cosmetic fields remain accepted for compatibility; current visual selection uses character and wardrobe IDs.
- public/avatars.js builds real 3D, 18-bone skinned skin/clothing volumes with nose relief, ears, hands and fingers. Both parts share atlases and cached geometry. Full models stay under6k triangles; distant models under1.8k. Nearby detail limit remains4 on low. All body poses use the rig; arm IK handles folded hands, bowing, kneeling and prostration.
- IMPORTANT: these are source-image-projected anatomical approximations, not exact photogrammetric reconstruction. Side/back geometry and unseen fabric require approximation. Review front, side and prayer-pose screenshots before claiming fidelity. No Blender or paid model API was used.
- public/reference-assets holds compressed user-image-derived atlases/thumbs (~475KB combined). Mobile atlas sizes512x512 clothes and512x256 faces; high1024x1024 and1024x512. scripts/prepare-avatar-textures.py reproduces them from the original eight filenames, using Pillow, NumPy and SciPy; it is an optional authoring step, not required for deployment.
- Validation: 24 Node tests pass locally. Chat/HUD commit71ab65e passed real local-Worker browser QA with three isolated sessions, server dry-run and 32-avatar render budget. New avatar browser QA and deployment results are recorded in the final handoff update below. Real entry-level Android FPS remains unmeasured.

# 인수인계 · 2026-11-06

## 최종 요구
온라인 기도원 / 개인 캐릭터·이름·복장·양탄자 / 고급 질감 / 위치와 절대 방향 센서로 메카 안내 / 세계 유명 모스크를 참고한 내부 맵과 서버 선택 / 건의사항·자유게시판 / 친구 요청·수락 / 유료 펜스의 친구 입장 허용과 친구 채팅 필터 / 자연음 기본 BGM / 기도모드에서 긴 개인 꾸란 낭송 연속 재생.

## 구현
- Three.js, 브라우저 Canvas 기반 고해상도 대리석·직조·금속·이즈니크 타일 텍스처.
- zayed / blue / nabawi 세 가지 테마. 같은 기하 기반의 모스크에서 영감을 받은 가상 공간이며 실제 건물의 정밀 복제물이 아님.
- 맵당 3개 서버, 각 32개 WebSocket 연결. 방 ID는 `map:server` 형식이며 Durable Object별로 분리.
- Community Durable Object의 SQLite에 기기별 사용자, 친구, 게시판을 저장.
- 기기 ID는 무작위 토큰의 HttpOnly / SameSite=Strict 쿠키. DB에는 해시만 저장. 이메일 로그인·복구·다기기 동기화는 아직 없음.
- 친구는 코드로 요청하고 상대가 수락해야 성립. 코드나 위치를 채팅 패킷에 넣지 않음.
- 서버가 구독자에게 친구 메시지만 전달. 펜스 충돌도 서버가 검사하며 친구는 통과, 친구 해제 후 내부에 있던 사람은 나갈 수 있음.
- premium_until은 서버 DB 필드. 공개 API로 변경 불가. 기본은 모두 무료. 실제 결제 공급자·인증·웹훅이 없어 실제 유료 판매는 꺼져 있음. 무료 사용자는 로컬 펜스 디자인만 미리 볼 수 있음.
- 낭송: CC0 알바카라 2시간 25분 10초, 원본 스트리밍·반복. 전체 꾸란 녹음으로 표시하지 말 것. 기도 종료 후 일시 정지, 다음 기도에서 이어 재생.
- 기본 소리: 퍼블릭 도메인 물소리 + 합성 바람·룸톤. 악기와 허밍 없음. 음량·음소거 독립 설정. 기도모드에서는 자연음 끔. 자연음은 배경탭에서 정지하고, 개인 낭송은 HTML Audio로 기도모드 동안 계속 재생. 실제 백그라운드 허용 여부는 기기 정책에 따름.
- 위치는 클라이언트에서만 계산. 상대 회전 센서는 절대 나침반으로 취급하지 않음.

## 배포
GitHub `yonddu/Allah`, main. Cloudflare 기존 Worker 이름 `allah`와 정확히 일치시킴. 연결된 빌드 트리거를 `npm run check && npm test && npm run build`로 설정했고 배포 명령은 `npx wrangler deploy`.
Wrangler의 커스텀 build도 자산 복사를 수행하므로 직접 deploy할 때도 vendor 파일이 누락되지 않음.
Workers subdomain은 songyd1018. 실 배포 상태를 API에서 확인할 것.

## 다음 작업
1. 실 기기 WebGL/나침반/오디오 재생 및 두 브라우저 간 접속 확인.
2. 사용자가 원하는 로그인 공급자·결제 공급자 결정 후 인증과 결제를 연결. 서버 premium_until은 서명 검증 웹훅에서만 변경.
3. 3D 원본 캐릭터 모델·정교한 기도 동작으로 교체, 모스크별 구조 차이 확대.
4. 공개 운영용 신고·관리자 게시판 관리와 이름 관리, 연결/IP 한도 추가.
5. 긴 낭송은 원본 약332MB 외부 스트리밍. 모바일 데이터와 원본 가용성에 유의. 필요 시 허가된 저장소/R2에 최적화 사본과 Range 응답 구성.
6. 공급된 테스트 통과 외에 유료 결제/실 종교 의식 적합성 검수가 완료되었다고 표시하지 말 것.

## 검증
`npm run check` / `npm test` / `npm run build` / `npx wrangler deploy --dry-run`.
Node 내장 SQLite를 이용한 게시판·친구·기기 쿠키 테스트와 서버 필터·방향·펜스 충돌 테스트 포함.

## 다국어 추가
21개 언어, 언어당 293문구. public/i18n.js와 locales/*.json. 초기 브라우저 언어 또는 ?lang=ar 지정, 선택값 기기 저장. 4개 RTL 언어에서 패널·방향·카메라 구도를 반전. 사용자 글/이름은 data-no-i18n으로 보호. 번역문 전문 원어민 검수는 미완료. 공통 키/변수 일치 검증 포함.

## 모바일 사용자 피드백 반영
나침반 기본 창을 약170px 폭의 작은 형태로 축소. 방향 바깥쪽에 카바 SVG 표식을 방위각으로 배치하고 기기 회전 시 아이콘은 똑바로 유지. 상세는 펼치기. 방향 버튼 대신 Pointer Capture 기반 드래그 조이스틱, 데드존/아날로그 속도/손을 떼거나 기도 시작 시 리셋. 첫 입장 모스크 선택창에 언어 선택 추가. bootstrap.js가 언어 UI를 3D 모듈보다 먼저 초기화. 첫 방문 기본은 id, 명시적 URL 언어 및 저장한 선택을 우선. Pew 2025 발표(2020 인구 기준)에서 인도네시아가 최대 무슬림 인구 국가인 점을 확인.

## 최종 배치 지시
소개 문구(평온을 향한 당신만의 자리)는 화면에서 제거. 작은 나침반은 모든 언어에서 왼쪽 위(헤더 아래)에 고정하며 RTL에서도 이 위치를 유지.

## 품질·저사양·입장 흐름
Node 빌드에서 재질별 병합 GLB/512~1K 모바일 텍스처 생성. 모스크별 천장/카펫/타일/꽃무늬 기둥 차이를 확대. 클라이언트는 선택한 맵의 LOD만 요청. 보급폰 자동30fps와 픽셀예산, 4초 평균 지연에 따른 해상도하향, 숨김탭 렌더중지, 멀리있는인물2재질모델 적용. 첫 입장 언어→캐릭터→모스크 단계에서 같은캔버스를 옮겨 미리보기. 실제인물/복장 원본그림 픽셀은 Dropbox툴에서 아직읽지못함(파일8장목록만확인); 원본디자인적용 완료로 보고하지말것.

여성아바타: gender=female이면서버/클라이언트공통sanitizeProfile에서cover=hijab강제. UI의쿠피/없음숨김. 히잡은얼굴앞개구부있는형태. 21언어297문구로확장.

## QA와 참고 이미지 상태
scripts/browser-smoke.mjs는 로컬 Worker + Chromium에서 입장3단계/여성히잡/나침반위치·카바표시/아날로그조이스틱/모스크3개·32명렌더예산/RTL을검사하고 artifacts/에스크린샷저장. 실제보급폰FPS측정은아님. Dropbox /salah 8개PNG는목록확인만했으며원본요청은연결의네트워크정책으로차단됨. 우회하지말것. 사용자에게원본채팅첨부등지원되는입력경로요청필요. REFERENCE_ASSETS.md에토큰없는파일명목록만기록.

## 오프라인 생성 검증 결과
19개 Node 검사와 건축자산 생성/Worker dry-run 통과. 모바일 GLB: zayed 10 draws/17,572tri/762,016bytes, blue 11 draws/18,548tri/789,120bytes, nabawi 10 draws/26,856tri/1,300,612bytes. 고품질각각39,116/43,100/55,144tri. 최초브라우저검사는Playwright1.56의Ubuntu26지원부재로실행전실패; CI runner를Ubuntu24.04로고정하여재검사. 이메모작성당시실기기FPS측정없음.

## 최종 검증
2026-11-06: Node검사19개통과. 로컬Chromium실행에서언어→캐릭터→입장,여성히잡강제,나침반왼쪽위/카바표시,조이스틱드래그/리셋,3개맵전환,RTL통과. 화면앞밀집한32명렌더는199draws/53,794tri기록. 이것은소프트웨어WebGL의렌더예산검사이며실제3~4GB폰의FPS측정이아님. 보급폰가로화면도coarse포인터및RAM4GB이하로저사양판별. 평균프레임지연시해상도뿐아니라상세원격캐릭터수도최소2명까지하향.

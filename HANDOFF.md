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

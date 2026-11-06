# 출처와 라이선스

## 긴 개인 낭송
- 제목: Chapter 2, Al-Baqarah (Murattal) - Recitation of the Holy Qur'an.mp3
- 길이: 2시간 25분 10초 (145분 10초), 원본 약 332.26MB / 320kbps
- 업로더·저작권자 표기: Atcovi. 파일 분류의 낭송자: Aaqib Azeez.
- 라이선스: 파일 설명에 저작권자의 CC0 1.0 선언이 표시되어 있음 (2026-11-06 확인)
- 원본 페이지: https://commons.wikimedia.org/wiki/File:Chapter_2,_Al-Baqarah_(Murattal)_-_Recitation_of_the_Holy_Qur%27an.mp3
- 원본 오디오: https://upload.wikimedia.org/wikipedia/commons/4/4f/Chapter_2%2C_Al-Baqarah_%28Murattal%29_-_Recitation_of_the_Holy_Qur%27an.mp3
- 라이선스: https://creativecommons.org/publicdomain/zero/1.0/
- 수정하지 않고 원본 URL에서 스트리밍합니다. 최초 입장에는 내려받지 않습니다. 기도모드에서 사용자 재생 동작 후에만 재생하며 끝나면 원본을 다시 반복합니다.
- 이 파일은 꾸란 전체가 아니라 긴 알바카라 낭송입니다. 낭송 내용·종교적 적합성의 별도 전문 검수는 하지 않았습니다.

## 기본 자연음
- 제목: Flowing-water-100019.ogg
- 저자: Fg2
- 길이: 약 19초. 자연 물소리를 반복 재생.
- 라이선스: 저작권자가 전 세계 퍼블릭 도메인으로 공개한 자체 녹음.
- 페이지: https://commons.wikimedia.org/wiki/File:Flowing-water-100019.ogg
- 원본: https://upload.wikimedia.org/wikipedia/commons/2/26/Flowing-water-100019.ogg
- 원본을 수정하지 않고 빌드 시 복사합니다. 실패하면 원본 스트리밍으로 대체합니다.
- 바람·실내 룸톤은 이 프로젝트에서 Web Audio로 합성합니다. 악기 연주와 허밍은 포함하지 않습니다.

## 시각 자료와 소프트웨어
- 3D 장면·양탄자·대리석·타일·직조·금속 텍스처: 프로젝트 코드로 생성. 실제 모스크의 공식 스캔이나 인증된 복제물이 아닙니다.
- Three.js 0.180.0: MIT, https://github.com/mrdoob/three.js/blob/r180/LICENSE. /vendor/THREE-LICENSE.txt에 함께 배포합니다.
- Noto Sans KR / Manrope: Google Fonts. Google Fonts CSS에 표시된 글꼴 라이선스 적용. 미지원 시 시스템 글꼴 사용.

## 빌드/검증 도구
- @napi-rs/canvas 0.1.80: MIT, https://github.com/Brooooooklyn/canvas . 빌드 환경에서 텍스처 PNG 생성에만 사용하며 브라우저에는 포함하지 않습니다.
- Playwright 1.56.1: Apache-2.0, https://github.com/microsoft/playwright . 로컬 CI 브라우저 검사 전용입니다.
- 모스크 GLB·재질·꽃무늬·접촉 음영은 이 프로젝트의 절차적 생성물이며 실제 모스크의 스캔 자료가 아닙니다.

## User-supplied character references

The seven face presets and fifteen clothing designs in public/reference-assets are derived from images supplied by the project owner for this application. They are not assigned a CC0 or third-party asset license. Mobile anatomical geometry, skeleton, IK, HUD and chat implementation are project code. Unseen sides and backs of the references are approximated.

## Offline prayer-time calculations

Adhan JS4.4.6 (Batoul Apps, MIT) and @photostructure/tz-lookup11.7.0 (CC0) are included under public/lib with their licenses and immutable source references. Quran.com is linked as an external reading service; no claim of endorsement or content ownership is made.

## 사용자 제공 캐릭터 모델
- Dropbox `chracter` 폴더에 제공된 Meshy GLB10개를 사용합니다. 원본 파일명과 SHA256은 `scripts/user-model-sources.json`에 기록했습니다.
- 원본 얼굴·복장·UV를 유지하며 크기와 방향을 통일하고 텍스처 크기를 조정했습니다. 간소화로 외형이 손상되는 모델은 원본 형상을 유지합니다.
- 빌드 도구: glTF-Transform core4.2.1 (MIT), meshoptimizer0.25.0 (MIT). 두 라이브러리는 빌드 단계에서 사용됩니다.

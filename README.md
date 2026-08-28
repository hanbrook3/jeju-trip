# 제주 4박 5일 · 우리 가족 여행 가이드

2026.10.05(월) ~ 10.09(금) 제주 여행 일정 가이드.
단일 HTML 파일로 동작하며 Leaflet 지도가 내장되어 있습니다.

## 보기

**https://hanbrook3.github.io/jeju-trip/** — 휴대폰 브라우저에서 바로 열립니다.
한 번 연 뒤에는 인터넷이 없어도 일정·사진·맛집·여행지·준비물이 그대로 열립니다.

## 구성

| | |
|---|---|
| `index.html` | 앱 전체 — 스타일·스크립트·지도 라이브러리·사진이 모두 들어 있습니다 |
| `sw.js` | 서비스워커 (오프라인 지원, 새 버전 알림) |
| `manifest.webmanifest`, `icon-*.png` | 홈 화면에 추가했을 때 쓰는 정보 |
| `.nojekyll` | GitHub Pages 의 Jekyll 처리 비활성화 |
| `.github/workflows/pages.yml` | 배포 (main 에 push 하면 자동, 3~4분) |
| `tools/` | 개발용 — 로컬 서버, 회귀 점검, 개략도 자료 파이프라인 |

## 고치기 전에

**[HANDOVER.md](HANDOVER.md) 를 먼저 읽으세요.** 파일 구조, 함정, 확인 절차,
남은 일이 정리되어 있습니다. 특히 `index.html` 안의 base64 사진 줄을 그냥 열면
안 되는 이유와, 지도 타일이 카카오톡에서 막히는 문제를 어떻게 다루는지가 들어 있습니다.

```bash
node tools/serve.js     # http://127.0.0.1:8765 — 서비스워커 때문에 file:// 로는 안 됩니다
```

개략도 밑그림을 다시 만들거나 눈으로 확인하려면 [tools/mapdata/README.md](tools/mapdata/README.md).

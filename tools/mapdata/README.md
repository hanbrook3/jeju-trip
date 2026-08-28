# 개략도 밑그림 자료

`index.html` 의 `COAST` · `ISLES` · `CONT` · `RD` 를 만들어 낸 파이프라인이다.

이 그림은 **타일 지도가 막혔을 때 대신 나오는 밑그림**이다. 카카오톡 인앱 브라우저가
국토지리정보원 타일 서버를 막는 일이 잦고, 이 앱은 카톡으로 공유되므로 개략도가
사실상 주 화면이 된다. 그래서 손으로 찍은 도형이 아니라 실측 자료를 쓴다.

## 이미 만들어진 것

색·굵기만 손보려면 파이프라인을 다시 돌릴 필요가 없다. 중간 산출물이 여기 있다.

| 파일 | 내용 |
|---|---|
| `geo.json` | 본섬 해안선 881점 + 부속 섬 12곳 |
| `contours.json` | 등고선 5단 (100·300·600·1000·1400m) |
| `roads-final.json` | 간선도로 57선 |
| `dem.json` | 표고 격자 96×48 (등고선의 원자료) |

`node gen-data.js` 로 이것들을 `mapdata.js` 로 다시 뽑아 `index.html` 에 넣으면 된다.

## 미리보기 — 눈으로 확인하는 유일한 방법

이 작업 환경에서는 **브라우저 스크린샷이 안 된다**(Browser pane 이 화면에 안 뜨면
`computer{action:"screenshot"}` 이 타임아웃난다). 개략도가 실제로 어떻게 보이는지는
이걸로 PNG 를 찍어 `Read` 도구로 열어 봐야 한다.

```bash
node tools/mapdata/preview.js                    # 섬 전체 (줌 9) + 예시 경로·핀
node tools/mapdata/preview.js z12                # 최대 배율 굵기
node tools/mapdata/preview.js z11 126.60,33.42,126.90,33.58   # 특정 구역
node tools/mapdata/preview.js z9 - nopins        # 밑그림만
```

색과 선 굵기는 `index.html` 의 `VEC` / `VW` 를 **직접 파싱해서** 가져온다.
따로 적어 두면 반드시 어긋나므로 `preview.js` 안에 색 값을 복사해 두지 말 것.

## 처음부터 다시 만들기

순서대로 돌린다. 전부 이 디렉터리 안에서.

### 1. 해안선 · 부속 섬 → `geo.json`

```bash
# 본섬 — 통계청 2018 시도경계 (7.5MB)
curl -o sk-prov.json "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json"
node extract.js          # 어떤 시도가 들어 있는지 확인만
node jeju.js             # 제주 폴리곤만 뽑아 jeju-raw.json 으로

# 부속 섬 — OpenStreetMap
curl -X POST --data-binary @queries/q-isles.txt -o isles.json https://overpass-api.de/api/interpreter
curl -X POST --data-binary @queries/q-udo.txt  -o udo.json  https://overpass-api.de/api/interpreter

node build-geo.js        # 단순화 → geo.json
```

통계청 자료에는 **우도가 빠져 있다**. 그래서 `q-udo.txt` 로 따로 받는다.
단순화 허용오차는 `build-geo.js` 안의 `dp(main, 0.0003)` — 줌 12 에서 0.9px 오차,
881점이 나온다. 0.0005 로 올리면 652점(1.5px), 0.0002 로 내리면 1046점(0.6px).

### 2. 표고 → 등고선 → `contours.json`

```bash
node dem.js              # 표고 격자 96x48 을 받는다. 47회 요청, 약 1분
node contour.js          # 마칭스퀘어 → 차이킨 다듬기 → 단순화
```

`dem.js` 는 opentopodata(SRTM 90m) 를 먼저 쓰고 막히면 open-meteo 로 넘어간다.
**둘 다 초당 1회 제한이 있어 간격을 두고 요청한다.** 빨리 돌리면 429 가 난다.

등고선 단계는 `contour.js` 의 `LEVELS=[100,300,600,1000,1400]`.

### 3. 도로 → `roads-final.json`

```bash
curl -X POST --data-binary @queries/q-roads.txt -o roads.json https://overpass-api.de/api/interpreter
node build-roads.js      # 조각 1641개를 노선별로 이어 붙인다 → roads-clean.json
node dedupe-roads.js     # 겹치는 구간 제거 → roads-final.json
```

`build-roads.js` 의 `GROUPS` 가 개략도에 남길 노선 목록이다.
`k` 는 `ring`(일주도로) / `trunk`(간선) / `br`(지선) — 선 굵기 등급이 된다.

`dedupe-roads.js` 가 중요하다. OSM 에서 상·하행 분리도로는 별개의 way 라 그대로
그리면 모든 길이 두 줄로 나온다. 이미 그린 선에서 **300m 안에 있는 구간을 지운다.**
등급 순(ring → trunk → br)으로 처리해 굵은 선이 공유 구간을 차지하게 한다.
덕분에 결과 파일에는 서로 겹치는 도로 쌍이 0건이다.

### 4. `index.html` 에 넣기

```bash
node gen-data.js         # mapdata.js 생성
```

`mapdata.js` 의 내용으로 `index.html` 의 `const COAST=` 부터 `const RD=[...];` 까지를
바꿔치기한다. 앵커는 `/* ══════ 개략도 밑그림 — 실측 자료 ══════` 주석부터
`const RD=[` 블록 끝까지.

## 자료 출처와 표기

| 자료 | 출처 | 표기 의무 |
|---|---|---|
| 본섬 해안선 | 통계청 2018 시도경계 (southkorea-maps) | — |
| 부속 섬 · 도로 | OpenStreetMap | ODbL. 타일을 쓸 때는 `© OpenStreetMap 기여자` 표기 |
| 표고 | SRTM 90m (opentopodata / open-meteo) | — |

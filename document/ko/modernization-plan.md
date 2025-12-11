# Mdir.js 현대화 전략 제안

본 문서는 Node.js 20 이상 전환 및 neo-blessed 대체 UI 스택 도입을 위한 선행 검토 결과입니다.

## 1. 목표 요약
- **런타임 업그레이드**: Node.js 20 LTS 이상을 기본으로 정착하고, 패키징(`pkg`, Docker)과 배포 스크립트를 동일 버전에 맞춰 재정렬.
- **TUI 프레임워크 재검토**: neo-blessed의 성능·유지보수 한계를 보완할 대안을 선정해 중장기적으로 UI 계층을 개선.

---

## 2. Node.js 20+ 전환 계획
### 2.1 범위 및 영향
- `package.json`의 `engines`, `pkg.targets`, CI 런타임, Dockerfile, `tsconfig` 타겟, 문서(README/설치 가이드) 등.
- 바이너리 빌드 체인: `pkg`, `node-pty-prebuilt-multiarch`, `fswin`, `ssh2`, `lzma-native` 등 네이티브 확장 의존성을 포함.

### 2.2 단계별 계획
1. **사전 진단**
   - `npm outdated` + `npm ls`로 Node 20 미지원 버전 식별.
   - 네이티브 모듈(`node-pty-prebuilt-multiarch`, `fswin`, `ssh2`, `lzma-native`)의 릴리스 노트를 확인하여 Node 20 대응 버전 목록화.
   - `pkg` 타겟을 `node20` 이상으로 조정 가능한지 확인.
2. **엔진/빌드 설정 업데이트**
   - `package.json > engines.node`를 `>=20.0.0` 혹은 `^20 || ^22`로 상향.
   - `tsconfig.json`의 `target`/`lib`를 Node 20 환경에 맞게 `ES2021+`로 유지 혹은 상향(필요 시 `DOM` 의존 제거 검토).
   - Dockerfile과 CI 워크플로에서 Node 20 이미지를 사용하도록 수정.
3. **의존성 업그레이드 & 호환성 코드 수정**
   - `chalk`, `ssh2`, `node-pty`, `i18next` 등 주요 패키지를 최신 LTS 호환 버전으로 올리고, 브레이킹 체인지 유무를 정리.
   - CommonJS 경로(`*.mjs`) 호출부를 점검해 ESM 전환 규칙 변화(Node 20의 stricter ESM 로더)를 맞춤.
4. **테스트 & 패키징 검증**
   - `npm run build`, `npm test`, `npm run pkg`, Docker 빌드 시나리오를 Node 20에서 실행.
   - Windows/macOS/Linux 별 로컬 smoke test (패널 전환, SFTP 접속, 압축 파일 열기, 에디터 입력, 터미널 round-trip).
5. **릴리스 및 문서화**
   - README / CHANGELOG / 새 `document/ko` 가이드에 Node 20 요구사항 명시.
   - 이전 Node 버전 사용자에 대한 마이그레이션 주의사항(패키지 재설치, `~/.m` 백업 등) 안내.

### 2.3 위험 및 완화
- **네이티브 모듈 빌드 실패**: CI에 OS별 `node-gyp` prerequisites를 추가하고, 필요 시 `prebuildify` 아티팩트 활용.
- **패키징 체인 지연**: `pkg`가 Node 20을 아직 정식 지원하지 않은 경우, `nexe` 등 대체 도구 비교 및 임시로 `npm` 배포 유지.
- **사용자 환경 잔존 Node 16/18**: CLI 실행 시 친절한 경고와 다운로드 링크를 안내하는 프리체크 로직 추가.

---

## 3. neo-blessed 대체 방안 평가
### 3.1 요구사항 재정의
- 듀얼 패널/탭, 다국어, 마우스 & 키보드 단축키, 가변 크기 위젯, 커스텀 렌더링(Mcd, 이미지 박스, ProgressBox), 내장 터미널(xterm)과의 통합.
- 256색 이상, True Color, 한글/UTF-8 안정성, CPU 점유 개선.

### 3.2 후보 비교
| 후보 | 장점 | 단점/리스크 | 비고 |
| --- | --- | --- | --- |
| **Ink (React 기반 TUI)** | React 생태계 활용, 풍부한 커뮤니티, 테스트 친화 | 현재 UI 레이아웃(절대 좌표 기반)과 개념 차이 큼, 렌더 오버헤드 | 장기적 리팩터링 시 고려
| **terminal-kit** | 빠른 렌더링, 마우스/키 이벤트, 고성능 스트림 API | 위젯 생태계 빈약, 기존 blessed 레이아웃 재사용 불가 | 저수준 API로 커스텀 구현 필요
| **blessed (upstream)** | 안정적, 커뮤니티 유지, neo-blessed 대비 버그 적음 | 최신 Node 20 테스트 필요, 일부 neo-blessed 고유 패치 재구현 필요 | 최소 변경 경로
| **React-blessed (blessed + React)** | 선언적 UI, 부분적 blessed 호환 | 러닝 커브, 성능 이슈 가능 | Ink 대비 가벼우나 유지비용 존재
| **xterm 기반 전면 UI** | 터미널 뷰 일원화, WebGL renderer 활용 가능 | 모든 위젯 재작성 필요, CLI 입력 처리 난도 상승 | 연구용 옵션

### 3.3 권장 접근
1. **1단계: blessed upstream PoC**
   - neo-blessed와 API 호환성이 높아 가장 낮은 리스크.
   - 필요한 패치(예: focus/mouse 개선, True Color) 목록화 후, 내부 포크 유지 혹은 PR 진행.
2. **2단계: terminal-kit 기반 성능 실험**
   - 가장 CPU를 많이 쓰는 View(MainFrame, 리스트 렌더링)를 terminal-kit로 재현하여 실제 프레임 타임 비교.
   - 성능이 유의미하게 개선된다면, panel/view abstraction을 재설계하는 roadmap 도출.
3. **3단계: 선언적 UI(React 계열) 탐색**
   - 장기적으로 유지보수성을 높이고 싶다면 Ink/React-blessed를 위한 브랜치에서 기능 parity 체크리스트 작성.

### 3.4 실행 로드맵
1. **요구사항 정의 & 벤치마크 기준 작성** (렌더 주기, CPU/메모리, 입력 지연 지표).
2. **PoC 브랜치 생성** (`poc/blessed-upstream`, `poc/terminal-kit`).
3. **핵심 시나리오 구현**: 기본 패널·리스트 렌더링, 키 입력, ProgressBox, Xterm 삽입.
4. **비교 리포트 작성**: metrics + 개발 복잡도 + 유지보수성 평가.
5. **최종 선택 & 마이그레이션 계획 수립**: 모듈 단위(Widget, Panel, Editor)로 단계적 전환 일정 도출.

---

## 4. 일정 제안 (예시)
| 주차 | 작업 |
| --- | --- |
| 1주차 | Node 20 호환성 조사, 의존성 버전 맵 작성 |
| 2주차 | 엔진/빌드 스크립트 업데이트, 기본 테스트 통과 |
| 3주차 | neo-blessed 대체 PoC 1차(blessed upstream) |
| 4주차 | terminal-kit 실험 및 성능 리포트, 결정 회의 |
| 5주차+ | 선택된 스택으로 단계적 리팩터링 착수 |

---

## 5. 후속 액션 체크리스트
- [x] Node 20 지원 여부 문서화 (`README`, `document/ko`).
- [ ] 네이티브 모듈별 지원 현황 표 작성.
- [ ] PoC 결과를 공유할 회의 일정 확정.
- [ ] 최종 선택된 UI 스택에 맞춰 `openspec` proposal 작성 및 승인 요청.

## 6. 진행 현황 (2025-12-11)
- `package.json`의 `engines.node`와 `pkg.tagets`를 Node 20 이상으로 상향했습니다.
- Docker 빌드 이미지를 `node:20-bullseye-slim`으로 교체해 배포 컨테이너 기본 런타임을 통일했습니다.
- `README.md`, `README_KO.md`에 Node 20 이상 요구사항을 반영해 사용자 가이드를 최신화했습니다.

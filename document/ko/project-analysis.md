# Mdir.js 소스 분석

## 1. 프로젝트 개요
- Mdir.js는 MS-DOS 시절 Mdir을 현대 Node.js 환경에서 재현한 터미널 기반 파일 매니저입니다.
- 두 개의 패널, 통합 터미널, SFTP/SSH 접속, 내부 편집기, 압축 파일 탐색 등 복합 기능을 하나의 풀스크린 CLI UI로 제공합니다.
- Node.js \>= 16, TypeScript, neo-blessed TUI, ssh2, node-pty, xterm 등을 핵심 의존성으로 사용합니다.

## 2. 소스 구조 하이라이트
| 디렉터리 | 역할 |
| --- | --- |
| `src/common` | 파일, 경로, 로거, 문자열, 국제화 등 공통 유틸리티.
| `src/config` | 사용자 환경(`configure.json`), 색상, 키맵, 메뉴 구성을 로드 및 검증.
| `src/panel` | 디렉터리 패널의 추상 계층과 로컬/원격/아카이브 리더, 선택/클립보드 로직.
| `src/panel_blassed` | neo-blessed 기반 UI 레이어(MainFrame, Panel, Mcd, Editor, Xterm, 각종 위젯).
| `src/editor` | 내부 텍스트 편집기의 로직, 인코딩 감지, 선택/클립보드, 저장 기능.
| `src/test` | 데모 및 기능 테스트 스크립트.
| `translation` | i18next 기반 다국어 리소스(영/한 지원).

## 3. 실행 흐름(엔트리 포인트)
1. `src/main.ts`에서 로케일 감지 및 i18n 초기화 후 임시 디렉터리, `.m` 홈 설정을 준비합니다.
2. `yargs`로 언어, 로그 파일 등 CLI 옵션을 파싱하고 ASCII 로고와 상태 메시지를 출력합니다.
3. `Configure`/`ColorConfig` 싱글턴을 로드하여 사용자 환경과 테마를 적용합니다.
4. `panel_blassed/MainFrame`을 동적으로 import하여 UI를 생성하고 `MainFrame.start()`로 이벤트 루프를 시작합니다.

## 4. 주요 런타임 컴포넌트
- **MainFrame (`panel_blassed/MainFrame.mts`)**: BaseMainFrame을 확장해 패널, MCD, 터미널, 에디터 뷰를 스위칭하고 키맵/힌트/헬프 메타데이터(`@KeyMapping`, `@Hint`, `@Help`)를 주입합니다. 아카이브 열기/생성, 터미널 세션, SFTP 연결, 이미지 뷰 등 대부분의 사용자 액션을 조정합니다.
- **Panel 계층 (`src/panel`)**: `Panel`은 `Reader` 추상화와 디렉터리 이력을 관리하며, 하위 `BlessedPanel`이 실제 UI를 담당합니다. `Reader` 구현(`FileReader`, `SftpReader`, `ArchiveReader`)으로 로컬, 원격, 압축 파일 시스템을 동일한 API로 다룹니다.
- **Selection/Clipboard**: 멀티 파일 선택, 복사/이동 큐, 진행률 콜백(`ProgressFunc`)을 이용해 대용량 작업을 처리합니다.
- **Editor (`src/editor`)**: `BlessedEditor`가 `Editor` 추상을 구현합니다. `jschardet`와 `iconv`로 인코딩을 감지/변환하고, 라인 기반 버퍼·선택·Undo(`DoData`) 등 터미널 전용 편집 기능을 제공합니다.
- **Terminal (`BlessedXterm`)**: `node-pty-prebuilt-multiarch` 및 `xterm` 위젯으로 내장 터미널을 제공하며, SFTP 세션과 연계해 원격 경로를 유지합니다.

## 5. 설정 및 확장 포인트
- `Configure`는 `~/.m/configure.json`을 기준으로 기본값(`ConfigureDefault`)과 버전 검증을 수행합니다. 파일 확장자/이름을 `MimeTypeAlias`에 매핑해 외부 프로그램 실행 구성을 유연하게 바꿀 수 있습니다.
- `ColorConfig`, `MenuConfig`, `KeyMapConfig`는 사용자 정의 테마, 메뉴, 단축키를 지원하며, Decorator 기반 메타데이터로 UI 힌트와 도움말이 자동 생성됩니다.
- `Translation` 모듈은 `i18next`와 FS backend를 사용해 런타임 언어 교체(영/한)를 지원합니다.

## 6. 로깅과 진단
- `common/Logger`는 `winston`을 래핑해 전역 싱글턴 로거를 제공합니다. `--logfile` 옵션과 `updateDebugFile`로 파일/콘솔 출력 및 동기화 모드를 제어합니다.
- 주요 모듈이 `Logger("ModuleName")`을 호출해 일관된 로그 라벨을 사용하며, 사용자 모드에서도 `.m/m.log` 로깅이 가능하도록 기본 경로를 설정합니다.

## 7. 빌드 · 실행 · 패키징
- `npm run build`: TypeScript 컴파일(`tsconfig.json`).
- `npm start`: 빌드 후 `node ./build/src/main.js` 실행.
- `npm run pkg` / `pkg-osx`: `pkg`를 이용한 단독 실행 바이너리 생성.
- `npm run docker`: npm 패키지 생성 후 `docker-compose build`.
- 테스트 스크립트(`test`, `testimage`, `archivetest` 등)는 TUI 상호작용 검증용으로 제공됩니다.

## 8. 관찰된 개선 포인트
1. **번들 효율화**: TypeScript -> Node 실행 구조에 비해 `esbuild` 의존성만 있고 사용 예가 없어 보이므로, 실제 빌드 파이프라인 반영이나 불필요 의존성 정리가 필요합니다.
2. **테스트 자동화 강화**: 현재 `src/test`는 수동 실행 스크립트 위주입니다. 핵심 로직(Reader, Selection, Configure 등)에 대한 단위 테스트를 추가하면 안정성이 올라갑니다.
3. **에러 처리 일관성**: `MainFrame` 내 Promise 체인에서 동일한 메시지 박스 패턴이 반복되므로 헬퍼 추출을 통해 유지보수를 단순화할 수 있습니다.
4. **형상 관리**: `build/` 산출물이 저장소에 함께 존재하므로, 배포/개발 브랜치 분리 또는 산출물 제외 정책을 고려해볼 수 있습니다.
5. **현대화된 입력 처리**: neo-blessed 기반 UI에서 IME/복합 입력 지원이 제한적이므로, 필요 시 xterm 기반 컴포넌트 재사용 또는 WebAssembly 기반 렌더러 검토 여지가 있습니다.

(본 문서는 `src/main.ts`, `src/panel_blassed/MainFrame.mts`, `src/panel/Panel.mts`, `src/editor/Editor.mts`, `src/config/Configure.mts`, `src/common/Logger.mts`, `README.md`, `package.json`을 기준으로 작성되었습니다.)

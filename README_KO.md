![Mdir.js](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.8.1.gif?raw=true)

# 1. 소개

Mdir.js 는 터미널 쉘 화면에서 파일 복사, 이동, 삭제 기능을 지원하며, 디렉토리를 트리구조로 보여주고 파일 검색 및 화면 내 서브 터미널로 명령을 실행할 수 있습니다.
이것은 90년대 말 도스용 파일 관리 툴인 Mdir 클론하여 만든 파일 관리 프로그램입니다.

특히, 압축 파일 zip, tar.gz 등의 압축 파일을 보는 기능과, 간단하게 터미널에서 이미지를 볼 수 있고,
터미널 쉘 화면 안에서 현재 디렉토리를 자동으로 인식하여 터미널 쉘을 종료해도 해당 디렉토리로 바로 이동할 수 있습니다.
SFTP, SSH로 접속 관리 화면을 통해 손쉽게 접속할 수 있으며, SFTP에 접속했을 때 SSH도 바로 접속 가능하며, 디렉토리간 이동이 편리합니다.

버그 및 문의 사항은 GitHub 홈페이지(https://github.com/la9527/mdir.js/issues)나 이메일(la9527@daum.net)을 통해 알려주시면 해결해 드리도록 하겠습니다.

참고로 2009년 LinM v0.8 이후로 지지부진하다가 2020년 초부터 다시 Mdir.js로 시작해 만들고 있습니다. ^^;
LinM의 기능 대부분 재구현하였고, 현재는 더 발전되었습니다.

# 2. 필수 설치 프로그램

 - Node.js 10.0 이상 (https://nodejs.org/)
 
# 3. 테스트한 OS

 - 윈도우 10
 - 맥 OSX 카탈리나 (10.15.x)
 - 우분투 리눅스

# 4. 라이센스

 Mdir.js 은 BSD3-Clause 라이센스를 따릅니다. 라이센스['LICENSE'] 파일을 참조하세요.

# 5. 설치

### 1) 설치 방법

 - 공통적으로 https://nodejs.org/ 에서 node.js 16.x 이상 버전을 시스템에 설치합니다.
  
 - Windows

    npm install 로 실행하려면 시스템에 파이선과 C++ 컴파일러가 설치되어 있어야 합니다. 
    커맨드에서 관리자 실행으로 아래 명령을 실행해 주시면 됩니다. 자세한 실행 방법은 여기(https://github.com/felixrieseberg/windows-build-tools)를 참고하세요.

    ```bash
    $ npm install -g --production windows-build-tools
    ```

 - Mac OS

    소스 컴파일을 위해서는 앱스토어를 통해 Xcode를 설치하시기 바랍니다.

 - Linux/Ubuntu
    
    리눅스 우분투 OS의 경우는 아래 패키지가 설치되면 정상적으로 실행 가능합니다.

    ```bash
    sudo apt install -y make python build-essential
    ```

### 2) Install 

```
$ mkdir mdir
$ cd mdir
$ npm install mdir.js
```

### 2) 실행

- 아래 명령으로 실행 가능합니다. 실행이 안되면 터미널을 종료 후 다시 실행해 보세요.

```bash
$ mdir
```

### 버전별 업데이트 정보

- v1.3.0
    - [개선] 모듈 코드 개선 Node.js의 CommonJS 모듈에서 ECMAScript 모듈로 변경
    - [개선] 전반적으로 기존 라이브러리 업데이트 및 Node.js 16 이상으로 반영
- v1.2.8
    - [보안이슈 수정] ssh2 버전 업그레이드 반영
- v1.2.7
    - [개선] 새파일 기능 추가
    - [개선] 리눅스 마운트 정보 개선
    - 검색 기능 버그 수정
- v1.2.5
    - [개선] 분할되지 않은 에디터 및 터미널에서는 마우스 선택 기능이 작동될 수 있게 수정
- v1.2.4
    - [버그수정] zsh의 프롬프트가 잘못 노출되는 버그 수정
- v1.2.0
    - [개선] MCD에서 검색 및 디렉토리 캐싱 지원
- v1.1.0
    - [추가] xz 파일 압축 지원
- v1.0.0
    - [추가] SFTP, SSH 접속을 지원합니다. (F6)
    - [추가] 터미널(서브쉘) 진입 후 전체화면을 지원합니다. (Ctrl+U)
    - [추가] 터미널(서브쉘) 에서 디렉토리 변경을 자동으로 인식하여 터미널 종료 시 마지막 디렉토리로 이동합니다.
- v0.8.4
    - [버그수정] 스페이스가 포함된 파일명 실행 오류 수정(win32)
    - [개선] ESLint 포함 
- v0.8.3
    - 파일을 실행할 때, 프로그램을 선택하게 적용 (Ctrl+R)
    - 설정 파일을 추가 (~/.m/configure.json)
- v0.8.2
    - [버그수정] 윈도우10에서 패키지 유효성 오류 수정
    - [추가] 실행 시 로고 추가
- v0.8.1
    - 압축 파일 보기 복사, 이동 삭제 기능 적용 (zip, tar.gz, gz, bz2)
- v0.7.x
    - 에디터 기능 추가(파일 인코딩을 자동인식)
- v0.6.x 
    - 한국어 지원
- v0.5.x 
    - 터미널 내에서 심플한 이미지 뷰어 추가 (png, jpeg, gif)
    - iTerm 내에서는 트루컬러 이미지로 보일 수 있게 적용(iTerm은 맥전용).
- v0.4.x 
    - 화면 윈도우 박스안에 터미널(서브쉘) 지원
- v0.2.x
    - 하단 힌트 추가
    - '/' 키로 하단 실행명령 라인 추가
- v0.1.x
    - 트리 형태의 디렉토리 이동 패널을 적용(MCD)

# Gallery

### 1. 메인 화면 (Split Window)
![Mdir.js MAIN](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.1_windows10_cmd.png?raw=true)

### 2. Mcd 화면 (트리 구조)
![Mdir.js MCD](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.1_windows10_cmd_mcd.png?raw=true)

### 3. 터미널(서브쉘)
![Mdir.js XTerm](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.8.1_zsh_terminal.png?raw=true)

### 4. 내장 에디터
![Mdir.js XTerm](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.8.1_inside_editor.png?raw=true)

### 5. 터미널 화면내 이미지 보기
![Mdir.js XTerm](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.8.1_picture_viewer.png?raw=true)

### 6. SSH, SFTP 접속 지원
![Mdir.js SSH,SFTP](https://github.com/la9527/mdir.js/blob/master/images/mdir_1.0.0_connection_manager.png?raw=true)

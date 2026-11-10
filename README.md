# Firefox MCP

AI가 Firefox의 탭을 읽고, 클릭하고, 입력할 수 있게 해 주는 MCP 서버입니다.
**내가 열어 둔 Firefox에 연결해서 함께 사용할 수 있습니다.**

[Mozilla Firefox DevTools MCP](https://github.com/mozilla/firefox-devtools-mcp) v0.10.7을 바탕으로, 연결이 멈췄을 때의 처리를 보완한 개인 수정본입니다.

## 무엇을 고쳤나요?

- **무한 대기 방지:** WebDriver 명령에 15초 제한을 적용합니다.
- **연결 복구:** 응답하지 않는 연결을 정리하고 다음 요청에서 재접속할 수 있게 합니다. 기존 Firefox에 연결한 경우 브라우저 창은 유지합니다.
- **중복 실행 방지:** 결과를 확인하지 못한 클릭·입력을 자동으로 다시 실행하지 않습니다.
- **프로세스 정리 개선:** 실제 geckodriver를 직접 실행해 연결 프로세스가 남는 문제를 줄였습니다.

모든 사이트나 Firefox 오류를 해결하는 도구는 아닙니다. 시간 초과가 발생한 작업은 화면에서 결과를 확인한 뒤 다시 요청하세요.

## 설치

Node.js **20.19 이상**, Firefox, Git이 필요합니다.

```bash
git clone https://github.com/Junyoung1201/firefox-mcp.git
cd firefox-mcp
npm ci
npm run build:moz
```

## Codex에서 사용하기

**1. Firefox를 원격 연결 옵션으로 실행합니다.**

이미 실행 중이라면 먼저 종료한 뒤 실행하세요. 아래는 Linux 기준입니다.

```bash
firefox --marionette --remote-debugging-port
```

자주 사용한다면 Firefox 바로가기의 실행 명령에 위 두 옵션을 추가하면 됩니다.

**2. `~/.codex/config.toml`에 추가합니다.**

`/절대/경로/firefox-mcp`를 실제 설치한 폴더 경로로 바꾸세요. 기존 Firefox MCP 설정이 있으면 해당 항목을 교체합니다.

```toml
[mcp_servers.firefox-devtools]
command = "node"
args = [
  "/절대/경로/firefox-mcp/dist.moz/index.js",
  "--connect-existing",
  "--marionette-port", "2828",
  "--idle-timeout", "60"
]
```

**3. Codex를 재시작하고 요청합니다.**

> Firefox에서 열려 있는 탭 목록을 보여줘.

사용하지 않는 연결은 60초 후 해제하고, 다음 요청에서 다시 연결합니다. 연결된 브라우저의 로그인된 페이지도 접근할 수 있으므로, 사용하는 AI와 작업 범위를 확인하세요.

## 검증

Linux · Firefox 159 환경에서 단위 테스트 **729개**, 연결 복구 등을 포함한 통합 테스트 **12개**를 통과했습니다. geckodriver를 강제로 멈춘 뒤, Firefox 창을 유지하면서 재접속하는 경우도 확인했습니다.

```bash
npm run test:unit
npm run typecheck
npm run typecheck:tests
```

전체 테스트 방법은 [테스트 문서](docs/testing.md)를 참고하세요.

## 원본과 라이선스

- 원본: [mozilla/firefox-devtools-mcp](https://github.com/mozilla/firefox-devtools-mcp)
- 원본 코드와 이력을 보존한 독립 저장소이며, Mozilla 공식 배포판이 아닙니다.
- 라이선스: [MIT](LICENSE-MIT) 또는 [Apache-2.0](LICENSE-APACHE)
- 이 수정본은 npm에 배포하지 않았습니다. 위의 소스 설치 방법을 사용하세요.

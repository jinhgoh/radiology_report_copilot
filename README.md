# Radiology Report Copilot

프로젝트 디렉터리 및 패키지 이름: `radiology_report_copilot`.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)

개와 고양이의 한국어 심장 초음파 소견서를 작성하는 로컬 웹 앱입니다. 개는 체중별 M mode 참고범위를, 고양이는 모든 체중에 동일한 고정 참고범위를 적용합니다.

## 실행

Windows에서는 `run.bat`을 더블 클릭하거나 `index.html`을 브라우저에서 여세요. 설치, 로그인, 인터넷 연결 없이 사용할 수 있습니다.

Node.js와 npm이 설치되어 있다면 프로젝트 폴더에서 다음 명령으로 로컬 서버를 실행할 수도 있습니다. 외부 의존 패키지가 없어 `npm install`은 필요하지 않습니다.

```sh
npm start
```

브라우저에서 http://127.0.0.1:4173 을 여세요. 서버는 로컬 주소에서만 연결을 받으며, 터미널에서 `Ctrl+C`로 종료합니다.

## 사용 방법

1. 환자 종류(개/고양이)를 선택하고 환자 체중을 kg 단위로 입력합니다. 고양이는 0보다 큰 모든 체중을 입력할 수 있습니다.
2. `Report preview`에서 소견, 측정값, 진단, 작성자를 직접 편집합니다. 체중을 바꾸면 템플릿의 참고범위가 갱신되며 직접 작성한 내용은 유지됩니다. M mode 측정값의 입력 단위는 cm입니다.
3. 왼쪽 `Findings` 드롭다운에서 문장을 선택하면 해당 평가 문단 끝에 추가됩니다. 여러 문장을 차례로 선택할 수 있으며 같은 문단의 동일 문장은 중복 추가하지 않습니다. 추가된 문장은 미리보기에서 직접 수정하거나 삭제합니다. 해당 문단 제목을 삭제하거나 변경한 경우 원래 제목을 복원해야 추가할 수 있습니다.
4. 소견서를 복사하거나 UTF-8 TXT 파일로 저장합니다.
5. 다음 환자를 작성할 때 ‘새 환자’를 누릅니다. 새로고침하거나 창을 닫으면 입력 내용은 사라집니다.

샘플의 양성 소견은 기본으로 입력하지 않습니다. 작성자 기본값은 GJH이며 보고서에서 수정할 수 있습니다. 진단과 FS는 직접 입력합니다.

종을 전환하면 각 종의 입력 초안을 메모리에 따로 유지하여 소견과 측정값이 다른 종으로 섞이지 않도록 합니다. ‘새 환자’는 두 초안을 모두 지우고 현재 선택한 종을 유지합니다.

고양이 템플릿은 사용자 제공 범위를 그대로 사용합니다: IVSd 0.3–0.6, LVDd 1.08–2.14, LVPWd 0.26–0.60, IVSs 0.4–0.9, LVDs 0.4–1.12, LVPWs 0.43–0.98 (cm). 고양이 B mode의 좌심실벽 두께와 LA diameter는 mm 단위이며, LA FS, SEC 소견, E/A, IVRT (ms), 대동맥 유출로 및 LA appendage 속도 (m/s)를 입력할 수 있습니다. LVIDDN은 개 보고서에만 포함됩니다.

## 참고자료 적용

- `assets_for_reference/Canine_Mmode_Refer.docx`: 총 87개 체중 행(0.5–40 kg)의 6개 M mode 범위를 추출합니다. 8.6 kg 입력 시 제공된 샘플의 모든 참고범위가 일치합니다.
- 표에 없는 체중은 가장 가까운 행을 사용하고, 중간값이면 더 낮은 체중을 선택합니다. 실제 체중과 참고 체중을 화면에 표시합니다. 보간 및 외삽은 하지 않습니다. 지원 범위를 벗어나면 내보내기가 비활성화됩니다.
- 범위는 원문의 문자열을 보존합니다. 음수, 잘못된 소수점, 비표준 정밀도를 감지하면 해당 값 대신 ‘원본 확인 필요’를 표시합니다. 현재 감지되는 항목: 0.5 kg LVDd/LVDs, 0.9 kg IVSd/LVDs, 31.4 kg IVSd. 펼침 영역에서 원문을 확인할 수 있습니다. 이 검사는 형식 검증이며, 원본 표의 모든 수치를 임상적으로 검증한 것은 아닙니다.
- `assets_for_reference/LVIDDN_calculator.xlsx`의 Sheet1!B3 수식 `B1/B2^0.294`를 사용하여 실제 환자 체중과 보고서의 LVDd 값으로 LVIDDN을 계산합니다. 편집 영역을 벗어나거나 체중을 바꾸면 소수점 셋째 자리까지 갱신됩니다. 유효한 체중이나 LVDd가 없으면 값은 비워 둡니다. 자동화를 사용하려면 LVDd와 LVIDDN 라벨을 유지하세요. 참고범위 자동화는 M mode 라벨과 괄호 형식을 유지한 줄에 적용되며 삭제한 줄은 다시 추가하지 않습니다.
- `소견서_기준_2024(1).docx`의 진단 기준으로 자동 진단을 생성하지 않습니다. DX and DDX는 직접 작성합니다.

입력 내용은 서버로 전송하거나 브라우저 저장소에 저장하지 않습니다. 모든 참조 원본은 읽기 전용으로 유지됩니다. UI에서 참고 체중을 확인한 뒤 보고서를 내보내세요. 내보낸 텍스트는 사용자가 제공한 템플릿 구조를 유지합니다.

## 개발 및 검증

의존 패키지 없이 HTML/CSS/JavaScript로 구현했습니다.

- `npm test`: 샘플 범위 일치, 체중 선택 경계, 데이터 구조, 원본 오류 처리, 보고서 출력을 검증합니다.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/extract-reference.ps1`: 원본 DOCX를 읽어 `reference-data.js`만 다시 생성합니다. 참조 파일은 변경하지 않습니다.

## 프로젝트 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` | 환자 입력 및 보고서 편집 화면 |
| `style.css` | 화면 스타일 |
| `app.js` | 화면 입력, 종별 초안 관리, 복사 및 TXT 내보내기 |
| `core.js` | 참고범위 선택, 보고서 생성, LVIDDN 계산 |
| `reference-data.js` | 원본 표에서 추출한 개의 M mode 참고범위 |
| `server.js` | 선택적으로 사용하는 로컬 웹 서버 |
| `run.bat` | Windows에서 기본 브라우저로 앱 실행 |
| `tests/` | 핵심 로직과 소견 문장 삽입 테스트 |
| `scripts/extract-reference.ps1` | 원본 DOCX에서 참고범위 추출 |

`assets_for_reference/`는 읽기 전용 원본 자료 폴더이며 `.gitignore`에 등록되어 있습니다. 앱 실행에는 포함된 `reference-data.js`를 사용하므로 원본 자료가 없어도 됩니다. 참고범위를 다시 추출하려면 원본 DOCX가 필요합니다. 원본 파일은 수정, 덮어쓰기, 이름 변경, 이동 또는 삭제하지 말고, 파생 파일은 이 폴더 밖에 저장하세요.

# 🕒 시간기록부 (시기부 | Siganlog)

> **당신의 시간을 데이터로 디자인하세요.**
>
> PC 활동 로그를 자동으로 수집 및 분류하고, 데이터 시각화 및 AI 기술을 통해 나만의 '디지털 페르소나'를 분석해 주는 스마트 라이프 로깅 서비스입니다.

---

## 🚀 서비스 주요 기능

### 1. 🖥️ 자동 PC 활동 수집기 (Client Tracker)
- 백그라운드에서 실행되며 활성화된 창(Active Window)의 프로세스명과 창 제목을 기록합니다.
- 수집된 데이터는 사용자의 로컬 환경에 `raw_activity_log.csv` 파일로 안전하게 기록됩니다.

### 2. 📊 데이터 시각화 대시보드 (Web Dashboard)
- **자동 카테고리 매핑**: 수집된 로그를 정밀한 룰셋에 기반하여 업무, 게임, 코딩, 미디어 시청 등으로 자동 카테고리화합니다.
- **다차원 통계 차트**: 
  - 총 기록된 시간 및 활동 개수 요약
  - Top 10 활동 카테고리 (인터랙시브 클릭 기능 제공)
  - 요일별 / 시간대별 활동량 추이 분석

### 3. 🤖 AI 디지털 행동 심리학자 (AI Persona)
- **페르소나 캐릭터 카드**: 
  - 사용자의 시간 데이터를 분석하여 독창적이고 재치 있는 한 줄 페르소나를 정의합니다 (Google Gemini API).
  - 페르소나에 어울리는 귀여운 2D 캐릭터 아트 및 파스텔톤 그라데이션 배경을 AI로 자동 생성 및 합성합니다.
  - SNS(인스타그램, 스토리 등) 공유에 적합한 1:1 비율의 세련된 이미지 카드로 다운로드할 수 있습니다.
- **💎 심층 성향 분석 리포트 (Premium)**:
  - 생산성 점수를 산출하고 집중을 방해하는 병목 요인을 찾아냅니다.
  - 개선을 위한 즉시 실행 가능한 행동 처방(Coaching)을 JSON 모드로 응답받아 동적으로 제공합니다.

### 4. 🌐 AI 페르소나 라운지 (Lounge Gallery)
- 자신이 생성한 AI 캐릭터 카드를 익명 인구통계 정보(성별, 나이대)와 함께 라운지에 즉시 공유할 수 있습니다.
- 다른 사용자들이 올린 개성 넘치는 페르소나 카드를 탐색하고 '좋아요'를 눌러 상호작용합니다.

---

## 🛠️ 기술 스택 (Tech Stack)

### Frontend
- **HTML5 / CSS3 / JavaScript (ES6+)**
- **Tailwind CSS** (Glassmorphism UI 및 반응형 레이아웃 구현)
- **Chart.js** (동적 차트 시각화)

### Backend (Serverless)
- **Firebase Cloud Functions (Node.js)**
- **Firebase Firestore** (빅데이터 저장 및 라운지 게시글/좋아요 관리)
- **Firebase Cloud Storage** (캐릭터 카드 이미지 저장 및 클라이언트 트래커 배포)
- **Firebase Hosting**

### AI & 3rd Party APIs
- **Google Gemini API** (`gemini-2.5-flash` / `gemini-2.5-flash-image`)
- **Remove.bg API** (캐릭터 배경 제거 및 누끼 합성 파이프라인 구축)

### Desktop Client
- **Python** (윈도우 API 연동 및 백그라운드 로깅)

---

## 💻 설치 및 시작 가이드

### 1. 웹 대시보드 로컬 실행
```bash
# Firebase CLI 설치 및 로그인
npm install -g firebase-tools
firebase login

# Functions 의존성 설치
cd functions
npm install

# Hosting 로컬 테스트 실행 (public 폴더 기준)
firebase emulators:start
# 또는
npx serve public
```

### 2. 데스크탑 트래커 빌드 및 실행 (Python)
```bash
# 관련 라이브러리 설치 (Windows 전용)
pip install pywin32 psutil pyinstaller

# 프로그램 실행 파일(EXE) 빌드
python build_installer.py
```

---

## 🔒 라이선스 및 보안 안내
- 수집된 개인별 상세 활동 원본 로그는 서버로 전송되지 않고 오직 사용자의 브라우저 메모리상에서만 안전하게 파싱됩니다.
- 통계 분석 및 AI 생성을 위해 필요한 익명화된 최소한의 메타데이터만 전송됩니다.

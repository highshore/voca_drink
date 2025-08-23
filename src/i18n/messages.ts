export type LanguageCode = "en" | "ko";

export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
];

type Messages = Record<string, string>;

export const messages: Record<LanguageCode, Messages> = {
  en: {
    // Nav
    "nav.decks": "Decks",
    "nav.vocab": "Vocabulary",
    "nav.learn": "Learn",
    "nav.review": "Review",
    "nav.dashboard": "Dashboard",
    "nav.profile": "Profile",
    "nav.signIn": "Sign in with Google",
    "nav.signInShort": "Sign In",
    "nav.signOut": "Sign Out",
    "nav.loading": "Loading",

    // Home
    "home.browseDecks": "Browse Decks",
    "home.dashboard": "Dashboard",

    // Login
    "login.title": "Sign in",
    "login.subtitle": "Use your Google account to continue.",
    "login.cta": "Sign in with Google",

    // Review
    "review.showAnswer": "Show answer",
    "review.again": "Again",
    "review.hard": "Hard",
    "review.good": "Good",
    "review.easy": "Easy",

    // Quiz
    "quiz.continue": "Continue",
    "quiz.idk": "I don't know",

    // Stats
    "stats.progress": "Progress",
    "stats.due": "Due",
    "stats.overdue": "Overdue",
    "stats.remain": "Remain",
    "stats.done": "Done",
    "stats.again": "Again",
    "stats.hard": "Hard",
    "stats.good": "Good",
    "stats.easy": "Easy",
    "stats.acc": "Acc",
    "stats.next7": "Next 7 days load",
    "stats.ret7": "7d Ret",
    "stats.medS": "Med S",
    "stats.mem": "Mem",
    "stats.streak": "Streak",
    "stats.words": "Words",
    "stats.loaded": "Loaded",

    // Common
    "common.loading": "Loading",
    "common.loadingSession": "Loading your study session...",
    "common.initializing": "Initializing…",
    "ui.save": "Save",
    "ui.report": "Report",

    // Profile
    "profile.title": "Profile",
    "profile.language": "Language",
    "profile.displayName": "Display name",
    "profile.dailyGoal": "Daily goal",
    "profile.save": "Save changes",
    "profile.saved": "Saved",
    "profile.changePhoto": "Change photo",
    "profile.buddies": "Accountability buddies",
    "profile.yourUid": "Your UID",
    "profile.copy": "Copy",
    "profile.copied": "Copied",
    "profile.add": "Add",
    "profile.remove": "Remove",
    "profile.enterBuddyUid": "Enter buddy UID",
    "profile.phoneNumber": "Phone number",
    "profile.verify": "Verify",
    "profile.code": "Code",
    "profile.confirm": "Confirm",
    "profile.verified": "Verified",
    "profile.noUsername": "User",
    "profile.namePlaceholder": "Your name",
    "profile.buddyUidPlaceholder": "Enter buddy UID",
    "profile.phonePlaceholder": "Phone number",
    "profile.codePlaceholder": "Code",
  },
  ko: {
    // Nav
    "nav.decks": "덱",
    "nav.vocab": "어휘",
    "nav.learn": "학습",
    "nav.review": "복습",
    "nav.dashboard": "대시보드",
    "nav.profile": "프로필",
    "nav.signIn": "Google로 로그인",
    "nav.signInShort": "로그인 · 가입",
    "nav.signOut": "로그아웃",
    "nav.loading": "로딩 중",

    // Home
    "home.browseDecks": "덱 보기",
    "home.dashboard": "대시보드",

    // Login
    "login.title": "로그인",
    "login.subtitle": "Google 계정으로 계속하세요.",
    "login.cta": "Google로 로그인",

    // Review
    "review.showAnswer": "정답 보기",
    "review.again": "다시",
    "review.hard": "어려움",
    "review.good": "좋음",
    "review.easy": "쉬움",

    // Quiz
    "quiz.continue": "계속",
    "quiz.idk": "모르겠어요",

    // Stats
    "stats.progress": "진행도",
    "stats.due": "대기",
    "stats.overdue": "지연",
    "stats.remain": "남은량",
    "stats.done": "완료",
    "stats.again": "다시",
    "stats.hard": "어려움",
    "stats.good": "좋음",
    "stats.easy": "쉬움",
    "stats.acc": "정확도",
    "stats.next7": "향후 7일 부담",
    "stats.ret7": "7일 유지",
    "stats.medS": "중간 안정도",
    "stats.mem": "암기",
    "stats.streak": "연속일",
    "stats.words": "단어",
    "stats.loaded": "불러옴",

    // Common
    "common.loading": "로딩 중",
    "common.loadingSession": "학습 세션을 불러오는 중...",
    "common.initializing": "초기화 중…",
    "ui.save": "저장",
    "ui.report": "신고",

    // Profile
    "profile.title": "프로필",
    "profile.language": "언어",
    "profile.displayName": "표시 이름",
    "profile.dailyGoal": "일일 목표",
    "profile.save": "변경사항 저장",
    "profile.saved": "저장됨",
    "profile.changePhoto": "사진 변경",
    "profile.buddies": "책임 파트너",
    "profile.yourUid": "내 UID",
    "profile.copy": "복사",
    "profile.copied": "복사됨",
    "profile.add": "추가",
    "profile.remove": "삭제",
    "profile.enterBuddyUid": "친구 UID 입력",
    "profile.phoneNumber": "전화번호",
    "profile.verify": "인증",
    "profile.code": "코드",
    "profile.confirm": "확인",
    "profile.verified": "인증됨",
    "profile.noUsername": "이름 없음",
    "profile.namePlaceholder": "이름 입력",
    "profile.buddyUidPlaceholder": "친구 UID 입력",
    "profile.phonePlaceholder": "전화번호",
    "profile.codePlaceholder": "코드",
  },
};

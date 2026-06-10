import { STUDENT_LIST } from "./studentList";

const COMPUTER_WORDS = [
  "인공지능",
  "하드웨어",
  "소프트웨어",
  "입력장치",
  "출력장치",
  "중앙처리장치",
  "키보드",
  "마우스",
  "모니터",
  "프린터",
  "스피커",
  "마이크",
  "웹브라우저",
  "알고리즘",
  "코딩",
  "운영체제",
  "데이터베이스",
  "네트워크",
  "클라우드",
  "메타버스",
  "사물인터넷",
  "정보보안",
  "컴퓨터 바이러스",
  "로봇",
  "USB 메모리",
  "스마트폰",
  "노트북",
  "와이파이",
  "마우스패드",
  "헤드셋",
  "그래픽카드",
  "인터넷",
  "이메일",
  "비밀번호",
  "폴더"
];

// 덕소중학교 캐치마인드 제시어 목록 데이터베이스
export const WORD_CATEGORIES = {
  custom_submit_others: {
    name: "✍️ 실시간 커스텀 (남이 쓴 단어 그리기)",
    words: []
  },
  custom_submit_self: {
    name: "✍️ 실시간 커스텀 (내가 쓴 단어 그리기)",
    words: []
  },
  deokso: {
    name: "🏫 덕소중학교 스페셜",
    words: [
      "덕소중학교",
      "급식실",
      "체육대회",
      "담임선생님",
      "교복",
      "중간고사",
      "기말고사",
      "수학여행",
      "운동장",
      "교장선생님",
      "과학실",
      "컴퓨터실",
      "체육관",
      "도서실",
      "동아리",
      "방과후학교",
      "교무실",
      "칠판",
      "급식표",
      "수행평가",
      "영어캠프",
      "학교축제",
      "소풍",
      "모둠 활동",
      "수업 시간"
    ]
  },
  class2_1: {
    name: "✏️ 2학년 1반 제시어 (학생 & IT)",
    words: [...(STUDENT_LIST["2-1"] || []), ...COMPUTER_WORDS]
  },
  class2_2: {
    name: "✏️ 2학년 2반 제시어 (학생 & IT)",
    words: [...(STUDENT_LIST["2-2"] || []), ...COMPUTER_WORDS]
  },
  class2_3: {
    name: "✏️ 2학년 3반 제시어 (학생 & 특별)",
    words: [
      ...(STUDENT_LIST["2-3"] || []),
      "배드민턴",
      "송종혁쌤",
      "회장",
      "부회장",
      "피구",
      "피구왕예원",
      "카누타는홍선우",
      "축구하는오정석",
      "이도규",
      "89세",
      "최이서이",
      "샤워한원우씨"
    ]
  },
  class2_4: {
    name: "✏️ 2학년 4반 제시어 (학생 & IT)",
    words: [...(STUDENT_LIST["2-4"] || []), ...COMPUTER_WORDS]
  },
  class2_5: {
    name: "✏️ 2학년 5반 제시어 (학생)",
    words: [...(STUDENT_LIST["2-5"] || [])]
  },
  class2_6: {
    name: "✏️ 2학년 6반 제시어 (학생 & IT)",
    words: [...(STUDENT_LIST["2-6"] || []), ...COMPUTER_WORDS]
  },
  class2_7: {
    name: "✏️ 2학년 7반 제시어 (학생 & IT)",
    words: [...(STUDENT_LIST["2-7"] || []), ...COMPUTER_WORDS]
  },
  class2_8: {
    name: "✏️ 2학년 8반 제시어 (학생 & IT)",
    words: [...(STUDENT_LIST["2-8"] || []), ...COMPUTER_WORDS]
  },
  animals: {
    name: "🦁 동물 & 식물",
    words: [
      "호랑이",
      "사자",
      "독수리",
      "펭귄",
      "기린",
      "판다",
      "돌고래",
      "카멜레온",
      "타조",
      "코알라",
      "나무늘보",
      "캥거루",
      "개구리",
      "다람쥐",
      "해바라기",
      "장미",
      "민들레",
      "단풍나무",
      "선인장",
      "대나무",
      "소나무",
      "연꽃",
      "튤립"
    ]
  },
  food: {
    name: "🍕 맛있는 음식",
    words: [
      "떡볶이",
      "피자",
      "햄버거",
      "삼겹살",
      "짜장면",
      "김밥",
      "치킨",
      "아이스크림",
      "탕후루",
      "비빔밥",
      "라면",
      "초밥",
      "붕어빵",
      "핫도그",
      "빙수",
      "샌드위치",
      "마카롱",
      "갈비탕",
      "부대찌개",
      "도넛",
      "스테이크"
    ]
  },
  knowledge: {
    name: "🧠 교과 및 일반상식",
    words: [
      "지구",
      "화산",
      "공룡",
      "블랙홀",
      "피타고라스",
      "세종대왕",
      "이순신",
      "태극기",
      "인공지능",
      "우주선",
      "경복궁",
      "현미경",
      "돋보기",
      "나침반",
      "컴퍼스",
      "화학 기호",
      "피라미드",
      "자석",
      "지진",
      "태양계",
      "화성"
    ]
  }
};

// 특정 카테고리에서 무작위 단어 하나를 선택하는 함수
export function getRandomWord(categoryKey) {
  const category = WORD_CATEGORIES[categoryKey] || WORD_CATEGORIES.deokso;
  const words = category.words;
  const randomIndex = Math.floor(Math.random() * words.length);
  return words[randomIndex];
}

// 모든 카테고리의 모든 단어에서 무작위 단어를 선택하는 함수
export function getRandomWordFromAll() {
  const categories = Object.keys(WORD_CATEGORIES);
  const randomCategoryKey = categories[Math.floor(Math.random() * categories.length)];
  return getRandomWord(randomCategoryKey);
}

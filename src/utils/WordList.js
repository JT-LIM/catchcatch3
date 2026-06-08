// 덕소중학교 캐치마인드 제시어 목록 데이터베이스
export const WORD_CATEGORIES = {
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
  class7: {
    name: "✏️ 7반 스페셜 & 우리나라 상식",
    words: [
      "김도진",
      "박윤",
      "윤상일",
      "신지후",
      "정해윤",
      "전승우",
      "독도",
      "한글",
      "김치",
      "태극기",
      "무궁화",
      "서울",
      "한라산",
      "경복궁",
      "세종대왕",
      "이순신",
      "비빔밥",
      "윷놀이",
      "아리랑",
      "거북선",
      "숭례문",
      "첨성대",
      "한복",
      "동해",
      "백두산",
      "석굴암",
      "불국사",
      "훈민정음",
      "판소리",
      "인삼"
    ]
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

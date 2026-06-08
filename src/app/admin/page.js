"use client";

import { useEffect, useState } from "react";
import { db } from "@/utils/firebase";
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  writeBatch 
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const ADMIN_PASSWORD = "0121";
const BUILD_VERSION = "v1.2.0";
const BUILD_TIME = "2026-06-05 16:35";

const DEFAULT_CATEGORIES = {
  deokso: "🏫 덕소중학교 스페셜",
  class7: "✏️ 7반 스페셜 & 우리나라 상식",
  animals: "🦁 동물 & 식물",
  food: "🍕 맛있는 음식",
  knowledge: "🧠 교과 및 일반상식"
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  
  // 상태 관리
  const [activeTab, setActiveTab] = useState("create-room"); // create-room, words, scores
  const [words, setWords] = useState([]); // { id, word, category }
  const [scores, setScores] = useState([]); // { id, nickname, score, roomCode, timestamp }
  const [loading, setLoading] = useState(false);

  // 입력 관리 (단어 추가)
  const [newWord, setNewWord] = useState("");
  const [categoryType, setCategoryType] = useState("deokso"); // deokso, animals, food, knowledge, custom
  const [customCatKey, setCustomCatKey] = useState("");
  const [customCatName, setCustomCatName] = useState("");
  
  // 검색 및 필터 관리
  const [searchNickname, setSearchNickname] = useState("");

  // 게임 방 만들기 관리
  const [wordCategory, setWordCategory] = useState("deokso");
  const [roundTime, setRoundTime] = useState(60);
  const [totalRounds, setTotalRounds] = useState(3);

  // 세션 스토리지 기반 인증상태 유지
  useEffect(() => {
    if (typeof window !== "undefined") {
      const authState = sessionStorage.getItem("catch_admin_auth");
      if (authState === "true") {
        setIsAuthenticated(true);
      }
    }
  }, []);

  // 인증 성공 시 데이터 로드
  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
    }
  }, [isAuthenticated]);

  // Firestore 데이터 로드
  const loadAllData = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      await signInAnonymously(auth);

      // 1. 단어 목록 로드
      const wordsCol = collection(db, "catch_words");
      const wordsSnapshot = await getDocs(wordsCol);
      const loadedWords = [];
      wordsSnapshot.forEach((doc) => {
        loadedWords.push({ id: doc.id, ...doc.data() });
      });
      setWords(loadedWords);

      // 2. 학생 점수 목록 로드
      const scoresCol = collection(db, "catch_scores");
      const scoresSnapshot = await getDocs(scoresCol);
      const loadedScores = [];
      scoresSnapshot.forEach((doc) => {
        loadedScores.push({ id: doc.id, ...doc.data() });
      });
      
      // 날짜 최신순 정렬
      loadedScores.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeB - timeA;
      });
      setScores(loadedScores);
    } catch (e) {
      console.error("데이터 로드 실패:", e);
      alert("데이터를 로드하는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 비밀번호 검증
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem("catch_admin_auth", "true");
      setAuthError("");
    } else {
      setAuthError("비밀번호가 일치하지 않습니다.");
    }
  };

  // 로그아웃
  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("catch_admin_auth");
    setPassword("");
  };

  // 신규 단어 등록
  const handleAddWord = async (e) => {
    e.preventDefault();
    const wordText = newWord.trim();
    if (!wordText) {
      alert("제시어 단어를 입력해 주세요.");
      return;
    }

    let finalCatKey = categoryType;
    let finalCatName = DEFAULT_CATEGORIES[categoryType] || categoryType;

    if (categoryType === "custom") {
      const customKey = customCatKey.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const customName = customCatName.trim();
      
      if (!customKey || !customName) {
        alert("커스텀 카테고리 영문 코드와 표시명을 모두 입력해 주세요.");
        return;
      }
      finalCatKey = customKey;
      finalCatName = customName;
    }

    try {
      const wordsCol = collection(db, "catch_words");
      await addDoc(wordsCol, {
        word: wordText,
        category: finalCatKey,
        createdAt: serverTimestamp()
      });

      setNewWord("");
      if (categoryType === "custom") {
        setCustomCatKey("");
        setCustomCatName("");
      }
      
      // 화면 갱신
      loadAllData();
      alert(`[${wordText}] 제시어가 성공적으로 추가되었습니다.`);
    } catch (e) {
      console.error(e);
      alert("단어 저장 중 실패했습니다.");
    }
  };

  // 단어 개별 삭제
  const handleDeleteWord = async (wordId, wordText) => {
    if (!confirm(`[${wordText}] 제시어를 삭제하시겠습니까?`)) return;

    try {
      await deleteDoc(doc(db, "catch_words", wordId));
      loadAllData();
    } catch (e) {
      console.error(e);
      alert("단어 삭제에 실패했습니다.");
    }
  };

  // 학생 성적 개별 삭제
  const handleDeleteScore = async (scoreId, nickname) => {
    if (!confirm(`[${nickname}] 학생의 성적 기록을 삭제하시겠습니까?`)) return;

    try {
      await deleteDoc(doc(db, "catch_scores", scoreId));
      loadAllData();
    } catch (e) {
      console.error(e);
      alert("성적 삭제에 실패했습니다.");
    }
  };

  // 모든 성적 일괄 삭제
  const handleResetAllScores = async () => {
    if (!confirm("⚠️ 주의! 정말 모든 학생들의 성적 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;

    setLoading(true);
    try {
      const scoresCol = collection(db, "catch_scores");
      const snapshot = await getDocs(scoresCol);
      
      // Batch를 활용해 일괄 삭제
      const batch = writeBatch(db);
      snapshot.forEach((d) => {
        batch.delete(doc(db, "catch_scores", d.id));
      });
      await batch.commit();

      loadAllData();
      alert("모든 성적 기록이 일괄 삭제되었습니다.");
    } catch (e) {
      console.error(e);
      alert("성적 초기화 도중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 단어들 카테고리별 그룹화
  const getGroupedWords = () => {
    const grouped = {};
    
    words.forEach((w) => {
      const cat = w.category;
      if (!grouped[cat]) {
        grouped[cat] = {
          name: DEFAULT_CATEGORIES[cat] || `📂 ${cat}`,
          items: []
        };
      }
      grouped[cat].items.push(w);
    });

    return grouped;
  };

  const groupedWords = getGroupedWords();

  // 성적 목록 필터링
  const filteredScores = scores.filter((s) => {
    if (!searchNickname) return true;
    return s.nickname.toLowerCase().includes(searchNickname.toLowerCase().trim());
  });

  // 날짜 포맷 함수
  const formatTime = (ts) => {
    if (!ts) return "-";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // 로그인 전 오버레이 화면
  if (!isAuthenticated) {
    return (
      <div className="login-overlay">
        <div className="login-card">
          <div className="avatar">🔑</div>
          <h2>덕소중 캐치마인드 관리자</h2>
          <p>선생님용 제시어 관리 및 학생 통계를 위한 비밀번호를 입력해 주세요.</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="관리자 비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              autoFocus
            />
            {authError && <p className="error-text">{authError}</p>}
            <button type="submit" className="login-btn">
              로그인하기
            </button>
          </form>
          <button 
            onClick={() => window.location.href = "/"}
            className="back-btn"
          >
            ← 로비로 돌아가기
          </button>
          <div style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#475569", fontWeight: "600" }}>
            버전: {BUILD_VERSION} | 빌드 시각: {BUILD_TIME}
          </div>
        </div>

        <style jsx>{`
          .login-overlay {
            min-height: 100vh;
            background: #0a0e1a;
            background-image: linear-gradient(180deg, #0e1326 0%, #05070e 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 1.5rem;
            color: #f8fafc;
            font-family: sans-serif;
          }
          .login-card {
            background: rgba(22, 30, 57, 0.75);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            padding: 3rem 2.5rem;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
          }
          .avatar {
            font-size: 3rem;
            margin-bottom: 1rem;
          }
          h2 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
            color: #ffffff;
          }
          p {
            color: #94a3b8;
            font-size: 0.9rem;
            line-height: 1.5;
            margin-bottom: 2rem;
          }
          .login-input {
            width: 100%;
            background: rgba(10, 14, 26, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            padding: 0.9rem 1.2rem;
            color: #ffffff;
            font-size: 1rem;
            margin-bottom: 1rem;
            text-align: center;
            transition: all 0.2s;
          }
          .login-input:focus {
            outline: none;
            border-color: #8b5cf6;
            box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
          }
          .error-text {
            color: #ef4444;
            font-size: 0.85rem;
            margin-top: -0.5rem;
            margin-bottom: 1rem;
            font-weight: 600;
          }
          .login-btn {
            width: 100%;
            background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
            color: white;
            font-weight: 600;
            padding: 0.9rem;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            font-size: 1rem;
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.3);
            transition: all 0.2s;
          }
          .login-btn:hover {
            filter: brightness(1.1);
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
          }
          .back-btn {
            background: transparent;
            border: none;
            color: #64748b;
            font-size: 0.85rem;
            font-weight: 600;
            margin-top: 1.5rem;
            cursor: pointer;
            transition: color 0.2s;
          }
          .back-btn:hover {
            color: #94a3b8;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* 관리자 헤더 */}
      <header className="admin-header">
        <div className="logo-section" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <div className="badge">Deokso Admin</div>
          <h1>덕소중 캐치마인드 관리자</h1>
          <span className="build-badge" style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.06)", color: "#94a3b8", padding: "0.25rem 0.5rem", borderRadius: "4px", marginLeft: "0.5rem" }}>
            {BUILD_VERSION} ({BUILD_TIME})
          </span>
        </div>
        <div className="action-section">
          <button onClick={() => window.location.href = "/"} className="btn-outline-sm">
            🏠 로비로 이동
          </button>
          <button onClick={handleLogout} className="btn-danger-sm">
            🔒 로그아웃
          </button>
        </div>
      </header>

      {/* 메인 탭 전환 영역 */}
      <main className="admin-content">
        <div className="tab-buttons">
          <button 
            className={`tab-btn ${activeTab === "create-room" ? "active cyan" : ""}`}
            onClick={() => setActiveTab("create-room")}
          >
            🏫 캐치마인드 방 만들기
          </button>
          <button 
            className={`tab-btn ${activeTab === "words" ? "active pink" : ""}`}
            onClick={() => setActiveTab("words")}
          >
            🎨 제시어 데이터베이스 관리 ({words.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === "scores" ? "active violet" : ""}`}
            onClick={() => setActiveTab("scores")}
          >
            📊 학생 실시간 플레이 점수 기록 ({scores.length})
          </button>
        </div>

        {loading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>데이터 동기화 중...</p>
          </div>
        )}

        {!loading && (
          <div className="tab-pane">
            {/* =======================================================
                [CREATE-ROOM TAB] 방 만들기 탭
                ======================================================= */}
            {activeTab === "create-room" && (
              <div className="admin-panel create-room-panel" style={{ maxWidth: "600px", margin: "0 auto" }}>
                <h3 className="panel-title" style={{ borderLeftColor: "#06b6d4" }}>🏫 캐치마인드 게임 룸 개설</h3>
                <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                  학생들과 함께 플레이할 게임 설정을 선택하고 [방 만들기] 버튼을 클릭하세요. <br />
                  버튼 클릭 시 게임 대기실로 자동 이동합니다.
                </p>

                <div className="form-group">
                  <label className="form-label">제시어 카테고리</label>
                  <select 
                    className="form-select"
                    value={wordCategory}
                    onChange={(e) => setWordCategory(e.target.value)}
                  >
                    {Object.entries(DEFAULT_CATEGORIES).map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                    {/* 만약 동적으로 추가된 카테고리가 있다면 선택 목록에 추가 */}
                    {Object.keys(groupedWords).filter(key => !DEFAULT_CATEGORIES[key]).map((key) => (
                      <option key={key} value={key}>
                        📂 {key} (커스텀)
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">라운드당 시간 (초)</label>
                    <select 
                      className="form-select"
                      value={roundTime}
                      onChange={(e) => setRoundTime(parseInt(e.target.value))}
                    >
                      <option value={30}>30초 (매우 빠름)</option>
                      <option value={60}>60초 (보통)</option>
                      <option value={90}>90초 (느긋함)</option>
                      <option value={120}>120초 (초등/중등 초급)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">총 라운드 수</label>
                    <select 
                      className="form-select"
                      value={totalRounds}
                      onChange={(e) => setTotalRounds(parseInt(e.target.value))}
                    >
                      <option value={1}>1 라운드</option>
                      <option value={2}>2 라운드</option>
                      <option value={3}>3 라운드</option>
                      <option value={5}>5 라운드</option>
                      <option value={10}>10 라운드</option>
                      <option value={20}>20 라운드</option>
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    sessionStorage.setItem("catch_create_room_pending", JSON.stringify({
                      category: wordCategory,
                      time: roundTime,
                      rounds: totalRounds
                    }));
                    window.location.href = "/";
                  }} 
                  className="btn-add btn-block"
                  style={{ background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)", boxShadow: "0 4px 12px rgba(6, 182, 212, 0.3)", marginTop: "1.5rem" }}
                >
                  🏫 캐치마인드 방 만들기 (로비로 자동 이동)
                </button>
              </div>
            )}

            {/* =======================================================
                [WORDS TAB] 제시어 추가/삭제 탭
                ======================================================= */}
            {activeTab === "words" && (
              <div className="words-grid">
                {/* 제시어 추가 패널 */}
                <div className="admin-panel add-panel">
                  <h3 className="panel-title">✏️ 신규 제시어 추가</h3>
                  <form onSubmit={handleAddWord}>
                    <div className="form-group">
                      <label className="form-label">단어 카테고리</label>
                      <select 
                        className="form-select"
                        value={categoryType}
                        onChange={(e) => setCategoryType(e.target.value)}
                      >
                        {Object.entries(DEFAULT_CATEGORIES).map(([key, name]) => (
                          <option key={key} value={key}>{name}</option>
                        ))}
                        <option value="custom">➕ 직접 입력 (신규 카테고리)</option>
                      </select>
                    </div>

                    {categoryType === "custom" && (
                      <div className="custom-cat-inputs">
                        <div className="form-group">
                          <label className="form-label">영문 키 (예: sports, science)</label>
                          <input 
                            type="text" 
                            placeholder="소문자 영문과 숫자만 입력" 
                            className="form-input"
                            value={customCatKey}
                            onChange={(e) => setCustomCatKey(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">표시명 (예: ⚽ 스포츠)</label>
                          <input 
                            type="text" 
                            placeholder="이모지 포함 표시 이름" 
                            className="form-input"
                            value={customCatName}
                            onChange={(e) => setCustomCatName(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">단어 입력</label>
                      <input 
                        type="text" 
                        placeholder="예: 떡볶이 (최대 12자)" 
                        maxLength={12}
                        className="form-input"
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                      />
                    </div>

                    <button type="submit" className="btn-add btn-block">
                      ➕ 제시어 등록하기
                    </button>
                  </form>
                </div>

                {/* 카테고리별 단어 리스트 패널 */}
                <div className="admin-panel list-panel">
                  <h3 className="panel-title">📚 카테고리별 제시어 현황</h3>
                  {Object.keys(groupedWords).length === 0 ? (
                    <p className="empty-text">등록된 제시어가 없습니다. 제시어를 먼저 추가하세요.</p>
                  ) : (
                    <div className="category-accordion">
                      {Object.entries(groupedWords).map(([catKey, cat]) => (
                        <div key={catKey} className="category-card">
                          <div className="category-header">
                            <span className="cat-title">{cat.name}</span>
                            <span className="cat-badge">{cat.items.length}개 단어</span>
                          </div>
                          <div className="words-badge-grid">
                            {cat.items.map((item) => (
                              <div key={item.id} className="word-badge">
                                <span className="word-text">{item.word}</span>
                                <button 
                                  onClick={() => handleDeleteWord(item.id, item.word)}
                                  className="word-del-btn"
                                  title="삭제"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =======================================================
                [SCORES TAB] 학생 점수 데이터 확인 탭
                ======================================================= */}
            {activeTab === "scores" && (
              <div className="admin-panel scores-panel">
                <div className="panel-header-row">
                  <div>
                    <h3 className="panel-title">🎮 학생 점수 로그 기록</h3>
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                      각 방에서 게임이 종료될 때 학생들이 획득한 최종 점수가 실시간으로 기록되는 게시판입니다.
                    </p>
                  </div>
                  
                  <button 
                    onClick={handleResetAllScores} 
                    className="btn-danger"
                    disabled={scores.length === 0}
                  >
                    🗑️ 전체 성적 초기화
                  </button>
                </div>

                {/* 필터 툴바 */}
                <div className="scores-toolbar">
                  <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input 
                      type="text" 
                      placeholder="학생 닉네임 검색..." 
                      className="form-input search-input"
                      value={searchNickname}
                      onChange={(e) => setSearchNickname(e.target.value)}
                    />
                  </div>
                  <div className="stat-summary">
                    <span>전체 기록: <strong>{scores.length}</strong>개</span> | 
                    <span>검색 결과: <strong>{filteredScores.length}</strong>개</span>
                  </div>
                </div>

                {/* 성적 기록 테이블 */}
                {filteredScores.length === 0 ? (
                  <p className="empty-text">표시할 점수 로그가 없습니다.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="scores-table">
                      <thead>
                        <tr>
                          <th>순위</th>
                          <th>참가 닉네임</th>
                          <th>방 코드</th>
                          <th>획득 점수</th>
                          <th>기록 시간</th>
                          <th>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredScores.map((s, index) => (
                          <tr key={s.id}>
                            <td className="rank-col">{index + 1}</td>
                            <td className="name-col font-bold">{s.nickname}</td>
                            <td><span className="room-code-tag">{s.roomCode}</span></td>
                            <td className="score-col font-bold">{s.score.toLocaleString()} 점</td>
                            <td className="date-col">{formatTime(s.timestamp)}</td>
                            <td>
                              <button 
                                onClick={() => handleDeleteScore(s.id, s.nickname)}
                                className="action-del-btn"
                                title="삭제"
                              >
                                🗑️ 삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 전역 스타일 설정 */}
      <style jsx global>{`
        .admin-container {
          min-height: 100vh;
          background: #0a0e1a;
          background-image: linear-gradient(180deg, #0e1326 0%, #05070e 100%);
          color: #f8fafc;
          font-family: 'Noto Sans KR', sans-serif;
          display: flex;
          flex-direction: column;
        }
        
        /* 헤더 */
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 2rem;
          background: rgba(13, 20, 42, 0.7);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .badge {
          background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
          color: white;
          font-weight: 800;
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          font-size: 0.8rem;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
        }
        .logo-section h1 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #ffffff;
        }
        .action-section {
          display: flex;
          gap: 0.75rem;
        }

        /* 메인 콘텐츠 */
        .admin-content {
          flex: 1;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* 탭 버튼 */
        .tab-buttons {
          display: flex;
          gap: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 0.5rem;
        }
        .tab-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1rem;
          font-weight: 700;
          padding: 0.75rem 1.25rem;
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 3px solid transparent;
        }
        .tab-btn:hover {
          color: #ffffff;
        }
        .tab-btn.active.pink {
          color: #ec4899;
          border-bottom-color: #ec4899;
        }
        .tab-btn.active.violet {
          color: #8b5cf6;
          border-bottom-color: #8b5cf6;
        }

        /* 패널 공통 */
        .admin-panel {
          background: rgba(22, 30, 57, 0.65);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        .panel-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 1.25rem;
          border-left: 4px solid #8b5cf6;
          padding-left: 0.75rem;
        }
        .add-panel .panel-title {
          border-left-color: #ec4899;
        }

        /* 로딩 스피너 */
        .loading-spinner {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 1rem;
          padding: 5rem 0;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #8b5cf6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* 제시어 관리 탭 (Grid) */
        .words-grid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .words-grid {
            grid-template-columns: 1fr;
          }
        }

        /* 제시어 입력 폼 */
        .custom-cat-inputs {
          background: rgba(10, 14, 26, 0.4);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.25rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }
        .form-label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .form-input, .form-select {
          background: rgba(10, 14, 26, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          color: #ffffff;
          font-size: 0.95rem;
          transition: all 0.2s;
        }
        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.2);
        }
        .add-panel .form-input:focus {
          border-color: #ec4899;
          box-shadow: 0 0 10px rgba(236, 72, 153, 0.2);
        }

        /* 버튼류 */
        .btn-outline-sm {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f8fafc;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-outline-sm:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .btn-danger-sm {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-danger-sm:hover {
          background: rgba(239, 68, 68, 0.3);
        }
        .btn-add {
          background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
          color: white;
          font-weight: 700;
          padding: 0.85rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 0.95rem;
          box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);
        }
        .btn-add:hover {
          filter: brightness(1.1);
        }
        .btn-danger {
          background: #ef4444;
          color: white;
          font-weight: 700;
          padding: 0.65rem 1.25rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        }
        .btn-danger:hover {
          background: #dc2626;
        }
        .btn-danger:disabled {
          background: #374151;
          color: #9ca3af;
          cursor: not-allowed;
        }
        .btn-block {
          width: 100%;
        }

        /* 단어 목록 아코디언 */
        .category-accordion {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .category-card {
          background: rgba(10, 14, 26, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 1.25rem;
        }
        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 0.5rem;
        }
        .cat-title {
          font-weight: 700;
          color: #ffffff;
        }
        .cat-badge {
          background: rgba(139, 92, 246, 0.12);
          color: #a78bfa;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
        }
        .words-badge-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .word-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .word-badge:hover {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.3);
        }
        .word-badge .word-text {
          font-weight: 500;
        }
        .word-del-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1.1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          transition: all 0.15s;
        }
        .word-del-btn:hover {
          background: #ef4444;
          color: white;
        }
        .empty-text {
          color: #64748b;
          font-size: 0.95rem;
          text-align: center;
          padding: 3rem 0;
        }

        /* 성적 탭 */
        .panel-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          gap: 1.5rem;
        }
        @media (max-width: 600px) {
          .panel-header-row {
            flex-direction: column;
            align-items: stretch;
          }
        }
        .scores-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .search-box {
          position: relative;
          max-width: 320px;
          width: 100%;
        }
        .search-icon {
          position: absolute;
          left: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.9rem;
          color: #64748b;
        }
        .search-input {
          padding-left: 2.25rem !important;
          width: 100%;
        }
        .stat-summary {
          font-size: 0.85rem;
          color: #94a3b8;
        }
        .stat-summary strong {
          color: #ffffff;
        }

        /* 테이블 */
        .table-responsive {
          width: 100%;
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(10, 14, 26, 0.3);
        }
        .scores-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.9rem;
        }
        .scores-table th, .scores-table td {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .scores-table th {
          background: rgba(0, 0, 0, 0.2);
          color: #94a3b8;
          font-weight: 700;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .scores-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .scores-table tbody tr:last-child td {
          border-bottom: none;
        }
        .rank-col {
          font-weight: 800;
          color: #94a3b8;
        }
        .scores-table tbody tr:nth-child(1) .rank-col {
          color: #f59e0b;
        }
        .scores-table tbody tr:nth-child(2) .rank-col {
          color: #cbd5e1;
        }
        .scores-table tbody tr:nth-child(3) .rank-col {
          color: #b45309;
        }
        .name-col {
          color: #ffffff;
        }
        .room-code-tag {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          font-family: monospace;
          font-size: 0.85rem;
          color: #cbd5e1;
        }
        .score-col {
          color: #10b981;
        }
        .date-col {
          color: #64748b;
          font-size: 0.85rem;
        }
        .action-del-btn {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          padding: 0.35rem 0.75rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .action-del-btn:hover {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
        }
        .font-bold {
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}

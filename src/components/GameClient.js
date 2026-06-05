"use client";

import { useEffect, useState, useRef } from "react";
import Canvas from "@/components/Canvas";
import { WORD_CATEGORIES, getRandomWord } from "@/utils/WordList";
import confetti from "canvas-confetti";
import { db } from "@/utils/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// 랜덤 이모지 아바타 할당용
const AVATARS = ["🐶", "🐱", "🦁", "🐯", "🦊", "🐨", "🐼", "🐸", "🐰", "🐵", "🐥", "🐬", "🦄", "🐙", "🦖"];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [isPeerLoaded, setIsPeerLoaded] = useState(false);
  const [peerError, setPeerError] = useState("");
  const [peerLoading, setPeerLoading] = useState(false);

  // 로비 상태 및 입력 값
  const [gameStage, setGameStage] = useState("LOBBY"); // LOBBY, WAITING, PLAYING, OVER
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [players, setPlayers] = useState([]); // { id, name, score, avatar, isConnected }
  
  // 게임 설정 (교사용)
  const [wordCategory, setWordCategory] = useState("deokso");
  const [roundTime, setRoundTime] = useState(60);
  const [totalRounds, setTotalRounds] = useState(3);

  // 진행 중인 게임 상태
  const [currentRound, setCurrentRound] = useState(1);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [drawerId, setDrawerId] = useState("");
  const [drawerName, setDrawerName] = useState("");
  const [currentWord, setCurrentWord] = useState("");
  const [wordLength, setWordLength] = useState(0);
  const [wordHint, setWordHint] = useState(""); // 글자수 자릿수 표시 (예: _ _ _)
  const [timeLeft, setTimeLeft] = useState(60);
  const [turnStatus, setTurnStatus] = useState("DRAWING"); // DRAWING, TRANSITION
  const [transitionMsg, setTransitionMsg] = useState("");
  
  // 채팅 상태
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  // Refs for WebRTC & Game Loop
  const peerRef = useRef(null);
  const connRef = useRef(null); // 학생용: 교사와의 connection 저장
  const connectionsMapRef = useRef(new Map()); // 교사용: 학생 id -> connection 맵
  const playersStateRef = useRef([]); // 점수 관리 및 순위표용
  const gameLoopRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);
  const currentWordRef = useRef(""); // 정답 비교용
  const roundTimeRef = useRef(60);
  const totalRoundsRef = useRef(3);
  const categoryRef = useRef("deokso");
  const turnIndexRef = useRef(0);
  const activeDrawerIndexRef = useRef(0);
  const usedWordsRef = useRef(new Set());

  // Web Audio API 효과음
  const playSound = (type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === "correct") {
        // 정답 성공: 도-미 2음 상승 차임벨
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5 (도)
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5 (미)
        gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.stop(ctx.currentTime + 0.45);
      } else if (type === "tick") {
        // 타이머 긴박음: 짧은 고주파 트라이앵글 톡음
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(750, ctx.currentTime);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "start") {
        // 게임 시작/라운드 시작: 부드럽게 상승하는 화음
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.3); // C5
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === "gameover") {
        // 게임 오버: 도-솔-미 화려한 하프 연주 느낌
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(261.63, ctx.currentTime); // C4
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        
        osc.frequency.setValueAtTime(392.00, ctx.currentTime + 0.1); // G4
        osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.2); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.3); // E5
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.stop(ctx.currentTime + 0.8);
      }
    } catch (e) {
      console.warn("효과음 재생을 지원하지 않는 브라우저입니다.", e);
    }
  };

  // Firestore 연동 제시어 상태
  const [gameWords, setGameWords] = useState(WORD_CATEGORIES);
  const gameWordsRef = useRef(WORD_CATEGORIES);

  // Firestore에서 제시어 목록 로드 및 없으면 Seeding
  const fetchAndSyncWords = async () => {
    try {
      const wordsCol = collection(db, "catch_words");
      const snapshot = await getDocs(wordsCol);
      
      let loadedWordsList = [];
      snapshot.forEach((doc) => {
        loadedWordsList.push(doc.data());
      });
      
      if (loadedWordsList.length === 0) {
        // DB가 비어있는 경우 기존 로컬 단어로 초기화(Seeding)
        console.log("Seeding Firestore with default word list...");
        const promises = [];
        for (const [catKey, catVal] of Object.entries(WORD_CATEGORIES)) {
          for (const wordText of catVal.words) {
            promises.push(
              addDoc(wordsCol, {
                word: wordText,
                category: catKey,
                createdAt: serverTimestamp()
              })
            );
          }
        }
        await Promise.all(promises);
        
        // 다시 데이터 로드
        const reSnapshot = await getDocs(wordsCol);
        reSnapshot.forEach((doc) => {
          loadedWordsList.push(doc.data());
        });
      }
      
      // 불러온 단어들 카테고리별로 정렬
      const newCategories = {
        deokso: { name: "🏫 덕소중학교 스페셜", words: [] },
        animals: { name: "🦁 동물 & 식물", words: [] },
        food: { name: "🍕 맛있는 음식", words: [] },
        knowledge: { name: "🧠 교과 및 일반상식", words: [] }
      };
      
      loadedWordsList.forEach((w) => {
        if (newCategories[w.category]) {
          newCategories[w.category].words.push(w.word);
        } else {
          // 신규 생성된 커스텀 카테고리 처리
          newCategories[w.category] = { name: `📂 ${w.category}`, words: [w.word] };
        }
      });
      
      setGameWords(newCategories);
      gameWordsRef.current = newCategories;
    } catch (error) {
      console.error("Firestore 제시어 동기화 실패, 로컬 데이터를 사용합니다:", error);
    }
  };

  // 4자리 숫자의 방 코드 자동 생성 및 제시어 동기화
  useEffect(() => {
    setMounted(true);
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    setIsPeerLoaded(true);

    const initAuthAndSync = async () => {
      try {
        const auth = getAuth();
        await signInAnonymously(auth);
        console.log("Firestore 익명 로그인 성공");
      } catch (authError) {
        console.error("Firestore 익명 로그인 실패 (비로그인 상태로 계속 진행):", authError);
      }
      await fetchAndSyncWords();

      // 관리자 페이지로부터 넘어온 자동 방 생성 설정 체크 (sessionStorage 방식)
      if (typeof window !== "undefined") {
        const pendingData = sessionStorage.getItem("catch_create_room_pending");
        if (pendingData) {
          try {
            const { category, time, rounds } = JSON.parse(pendingData);
            console.log("[대기 방 설정] 발견:", { category, time, rounds });
            
            setWordCategory(category);
            setRoundTime(time);
            setTotalRounds(rounds);

            // 즉시 중복 생성 방지를 위해 세션 스토리지 정보 클리어
            sessionStorage.removeItem("catch_create_room_pending");

            // 방을 즉시 생성
            console.log("[대기 방 설정] 기반으로 방 생성을 자동 개시합니다. 코드:", code);
            handleCreateRoom(code);
          } catch (e) {
            console.error("[대기 방 설정] 데이터 파싱 오류:", e);
          }
        }
      }
    };
    initAuthAndSync();
  }, []);

  // 채팅 메시지 추가 시 스크롤 최하단 자동 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 교사(방장) 방 만들기
  const handleCreateRoom = async (overrideCode) => {
    const activeCode = (overrideCode || roomCode).trim();
    console.log("[방장] 방 개설 시작. 방코드:", activeCode);
    if (!activeCode || activeCode.length !== 4) {
      alert("올바른 참여 코드를 생성해 주세요.");
      return;
    }

    setPeerLoading(true);
    setPeerError("");

    let isCreated = false;
    let createTimeout = null;

    try {
      console.log("[방장] PeerJS 모듈 로드 중...");
      const PeerModule = await import("peerjs");
      const Peer = PeerModule.default;
      
      const peerId = `deokso-mq-${activeCode}`;
      console.log("[방장] Peer 인스턴스 생성 시도. 등록 예정 ID:", peerId);
      const peer = new Peer(peerId, {
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:openrelay.metered.ca:80" },
            { 
              urls: "turn:openrelay.metered.ca:80",
              username: "openrelayproject",
              credential: "openrelayproject"
            },
            { 
              urls: "turn:openrelay.metered.ca:443",
              username: "openrelayproject",
              credential: "openrelayproject"
            },
            { 
              urls: "turn:openrelay.metered.ca:443?transport=tcp",
              username: "openrelayproject",
              credential: "openrelayproject"
            }
          ]
        }
      });

      // 방 생성 제한 시간 설정 (8초)
      createTimeout = setTimeout(() => {
        if (!isCreated) {
          console.warn("[방장] 방 생성 응답이 8초간 오지 않아 타임아웃 취소 처리합니다.");
          setPeerLoading(false);
          setPeerError("방 생성 시간이 초과되었습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요.");
          alert("방 생성 시간이 초과되었습니다. 네트워크 연결 상태를 확인해주세요.");
          if (peer) {
            peer.destroy();
          }
          peerRef.current = null;
        }
      }, 8000);

      peer.on("open", () => {
        console.log("[방장] PeerJS 시그널링 서버 연결 완료! 방 ID 등록 성공:", peerId);
        isCreated = true;
        if (createTimeout) clearTimeout(createTimeout);
        peerRef.current = peer;
        setIsHost(true);
        setGameStage("WAITING");
        setPlayers([{ id: "host", name: "선생님 (방장)", score: 0, avatar: "🎓", isConnected: true }]);
        playersStateRef.current = [{ id: "host", name: "선생님 (방장)", score: 0, avatar: "🎓", isConnected: true }];
        setPeerLoading(false);
      });

      // 학생이 접속했을 때의 핸들러
      peer.on("connection", (conn) => {
        console.log("[방장] 학생 커넥션 감지됨. 학생 Peer ID:", conn.peer);
        
        conn.on("open", () => {
          console.log("[방장] 학생(" + conn.peer + ")과의 WebRTC 데이터 채널 오픈 완료.");
        });

        conn.on("data", (data) => {
          console.log("[방장] 학생(" + conn.peer + ")으로부터 데이터 수신:", data.type);
          handleHostReceiveData(conn, data);
        });

        conn.on("close", () => {
          console.log("[방장] 학생(" + conn.peer + ")과의 연결 닫힘.");
          handlePlayerDisconnect(conn.peer);
        });

        conn.on("error", (err) => {
          console.error("[방장] 학생(" + conn.peer + ") 커넥션 에러 발생:", err);
          handlePlayerDisconnect(conn.peer);
        });
      });

      peer.on("error", (err) => {
        console.error("[방장] PeerJS 자체 에러 발생:", err);
        isCreated = false;
        if (createTimeout) clearTimeout(createTimeout);
        setPeerLoading(false);
        if (err.type === "unavailable-id") {
          setPeerError("이미 생성된 방 코드입니다. 다른 코드나 페이지 새로고침 후 다시 시도해주세요.");
        } else {
          setPeerError(`방 생성 에러: ${err.message}`);
        }
      });

    } catch (e) {
      console.error("[방장] handleCreateRoom 내부 예외 발생:", e);
      isCreated = false;
      if (createTimeout) clearTimeout(createTimeout);
      setPeerLoading(false);
      setPeerError("실시간 서버 연결 실패. 잠시 후 다시 시도해 주세요.");
    }
  };

  // 학생 방 입장
  const handleJoinRoom = async () => {
    const cleanRoomCode = roomCode.trim();
    const cleanNickname = nickname.trim();
    console.log("[학생] 방 참여 시도 시작. 방코드:", cleanRoomCode, ", 닉네임:", cleanNickname);
    if (!cleanRoomCode || cleanRoomCode.length !== 4) {
      alert("4자리 방 코드를 입력해주세요.");
      return;
    }
    if (!cleanNickname) {
      alert("닉네임을 입력해주세요.");
      return;
    }

    setPeerLoading(true);
    setPeerError("");

    let isConnected = false;
    let connectionTimeout = null;

    try {
      console.log("[학생] PeerJS 모듈 로드 중...");
      const PeerModule = await import("peerjs");
      const Peer = PeerModule.default;

      // 학생은 무작위 ID 생성
      console.log("[학생] 무작위 Peer ID 생성 요청 중...");
      const peer = new Peer({
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:openrelay.metered.ca:80" },
            { 
              urls: "turn:openrelay.metered.ca:80",
              username: "openrelayproject",
              credential: "openrelayproject"
            },
            { 
              urls: "turn:openrelay.metered.ca:443",
              username: "openrelayproject",
              credential: "openrelayproject"
            },
            { 
              urls: "turn:openrelay.metered.ca:443?transport=tcp",
              username: "openrelayproject",
              credential: "openrelayproject"
            }
          ]
        }
      });

      // 연결 제한 시간 설정 (8초)
      connectionTimeout = setTimeout(() => {
        if (!isConnected) {
          console.warn("[학생] 8초 동안 방장 피어와의 연결이 완료되지 않아 타임아웃 처리합니다.");
          setPeerLoading(false);
          setPeerError("방을 찾을 수 없거나 연결 시간이 초과되었습니다.");
          alert("방을 찾을 수 없거나 연결 시간이 초과되었습니다. 방 코드를 확인해 주세요.");
          
          if (peer) {
            console.log("[학생] 타임아웃으로 인해 생성된 Peer 객체를 파괴합니다.");
            peer.destroy();
          }
          peerRef.current = null;
          connRef.current = null;
        }
      }, 8000);

      peer.on("open", (id) => {
        console.log("[학생] PeerJS 시그널링 서버 연결 완료! 부여된 내 Peer ID:", id);
        peerRef.current = peer;
        setIsHost(false);
        
        // 교사의 Peer ID로 연결 요청
        const hostPeerId = `deokso-mq-${cleanRoomCode}`;
        console.log("[학생] 방장 피어(" + hostPeerId + ")와 직접 WebRTC 접속을 시도합니다...");
        const conn = peer.connect(hostPeerId);
        connRef.current = conn;

        const handleConnected = () => {
          console.log("[학생] 방장 피어와 WebRTC 데이터 채널 연결 성공!");
          isConnected = true;
          if (connectionTimeout) clearTimeout(connectionTimeout);

          // 호스트에 JOIN 요청 전송
          const randomAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
          console.log("[학생] 방장에게 JOIN 시그널을 발송합니다. 닉네임:", cleanNickname);
          conn.send({
            type: "JOIN",
            nickname: cleanNickname,
            avatar: randomAvatar
          });
          setGameStage("WAITING");
          setPeerLoading(false);
        };

        if (conn.open) {
          handleConnected();
        } else {
          conn.on("open", () => {
            handleConnected();
          });
        }

        conn.on("data", (data) => {
          console.log("[학생] 방장으로부터 데이터 수신:", data.type);
          handleClientReceiveData(data);
        });

        conn.on("close", () => {
          console.warn("[학생] 방장과의 커넥션이 닫혔습니다.");
          isConnected = false;
          if (connectionTimeout) clearTimeout(connectionTimeout);
          alert("방장과의 연결이 끊어졌습니다.");
          resetGameState();
        });

        conn.on("error", (err) => {
          console.error("[학생] 방장 커넥션 에러 발생:", err);
          isConnected = false;
          if (connectionTimeout) clearTimeout(connectionTimeout);
          alert("방장과 연결 중 오류가 발생했습니다.");
          resetGameState();
        });
      });

      peer.on("error", (err) => {
        console.error("[학생] PeerJS 자체 에러 발생:", err);
        isConnected = false;
        if (connectionTimeout) clearTimeout(connectionTimeout);
        setPeerLoading(false);
        setPeerError("방을 찾을 수 없습니다. 참여 코드를 확인해 주세요.");
      });

    } catch (e) {
      console.error("[학생] handleJoinRoom 내부 예외 발생:", e);
      isConnected = false;
      if (connectionTimeout) clearTimeout(connectionTimeout);
      setPeerLoading(false);
      setPeerError("실시간 서버 연결 실패.");
    }
  };

  // 상태 초기화
  const resetGameState = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    connRef.current = null;
    connectionsMapRef.current.clear();
    setGameStage("LOBBY");
    setIsHost(false);
    setPlayers([]);
    setChatMessages([]);
    setCurrentRound(1);
    setCurrentTurn(0);
    setDrawerId("");
    setDrawerName("");
    setCurrentWord("");
    setWordHint("");
    setTimeLeft(60);
    setTurnStatus("DRAWING");
    usedWordsRef.current.clear();
  };

  // 교사(호스트)가 학생 연결 끊김을 감지했을 때
  const handlePlayerDisconnect = (peerId) => {
    // 맵에서 커넥션 제거
    let disconnectedName = "학생";
    connectionsMapRef.current.forEach((conn, studentId) => {
      if (conn.peer === peerId) {
        connectionsMapRef.current.delete(studentId);
      }
    });

    const updated = playersStateRef.current.filter((p) => {
      if (p.id === peerId) {
        disconnectedName = p.name;
        return false;
      }
      return true;
    });

    playersStateRef.current = updated;
    setPlayers(updated);

    // 새 플레이어 리스트 브로드캐스트
    broadcastToAll({
      type: "PLAYER_LIST",
      players: updated
    });

    // 시스템 메시지 출력 및 전송
    const systemMsg = `📢 ${disconnectedName}님이 퇴장하셨습니다.`;
    addSystemChatMessage(systemMsg);
    broadcastToAll({
      type: "SYSTEM_MSG",
      text: systemMsg
    });
  };

  // 교사(호스트) 데이터 수신 처리기
  const handleHostReceiveData = (conn, data) => {
    switch (data.type) {
      case "JOIN":
        // 새로운 학생 추가
        const studentId = conn.peer;
        const newPlayer = {
          id: studentId,
          name: data.nickname,
          score: 0,
          avatar: data.avatar,
          isConnected: true
        };

        // 교사 커넥션 맵에 등록
        connectionsMapRef.current.set(studentId, conn);

        // 플레이어 배열 갱신
        const updatedPlayers = [...playersStateRef.current, newPlayer];
        playersStateRef.current = updatedPlayers;
        setPlayers(updatedPlayers);

        // 모든 참여 학생들에게 갱신된 플레이어 리스트 브로드캐스트
        broadcastToAll({
          type: "PLAYER_LIST",
          players: updatedPlayers
        });

        // 입장 환영 시스템 메시지
        const systemMsg = `🎉 ${data.nickname}님이 입장하셨습니다!`;
        addSystemChatMessage(systemMsg);
        broadcastToAll({
          type: "SYSTEM_MSG",
          text: systemMsg
        });

        // 뒤늦게 입장한 학생 싱크 맞추기 (게임이 이미 시작된 경우)
        if (gameStage === "PLAYING") {
          conn.send({
            type: "GAME_START",
            settings: {
              duration: roundTimeRef.current,
              rounds: totalRoundsRef.current
            }
          });

          // 약간의 딜레이를 주어 클라이언트가 스테이지 전환을 완료한 후 턴 데이터를 처리하게 함
          setTimeout(() => {
            if (conn.open) {
              conn.send({
                type: "START_TURN",
                drawerId: drawerId,
                drawerName: drawerName,
                wordLength: wordLength,
                hint: wordHint,
                timeLeft: timeLeft,
                round: currentRound,
                turn: turnIndexRef.current + 1,
                word: "" // 중간 참가자는 일단 관전/추측부터 시작
              });
            }
          }, 500);
        } else if (gameStage === "OVER") {
          conn.send({
            type: "GAME_OVER",
            players: updatedPlayers.filter((p) => p.id !== "host").sort((a, b) => b.score - a.score)
          });
        }
        break;

      case "CHAT":
        // 학생이 보낸 채팅 검증
        handleReceivedChatMessage(conn.peer, data.text);
        break;

      case "DRAW_EVENT":
        // 출제자가 그린 좌표 전송 -> 다른 모든 클라이언트로 전달 (호스트 화면에도 그림)
        broadcastDrawToOthers(conn.peer, data.event);
        break;

      default:
        break;
    }
  };

  // 학생(클라이언트) 데이터 수신 처리기
  const handleClientReceiveData = (data) => {
    switch (data.type) {
      case "PLAYER_LIST":
        setPlayers(data.players);
        break;

      case "SYSTEM_MSG":
        addSystemChatMessage(data.text);
        break;

      case "CHAT_BROADCAST":
        addChatMessage({
          id: Math.random().toString(),
          sender: data.senderName,
          text: data.text,
          isDrawer: data.isDrawer
        });
        break;

      case "GAME_START":
        playSound("start");
        setRoundTime(data.settings.duration);
        setTotalRounds(data.settings.rounds);
        setGameStage("PLAYING");
        break;

      case "START_TURN":
        playSound("start");
        setTurnStatus("DRAWING");
        setDrawerId(data.drawerId);
        setDrawerName(data.drawerName);
        setWordLength(data.wordLength);
        setWordHint(data.hint);
        setTimeLeft(data.timeLeft);
        setCurrentRound(data.round);
        setCurrentTurn(data.turn);
        
        // 만약 내가 출제자라면 제시어 원본 표시
        if (peerRef.current && peerRef.current.id === data.drawerId) {
          setCurrentWord(data.word);
        } else {
          setCurrentWord("");
        }

        // 캔버스 초기화
        if (canvasRef.current) {
          canvasRef.current.clear();
        }
        break;

      case "DRAW_EVENT":
        // 캔버스 컴포넌트에 그리기 명령 실행
        if (canvasRef.current) {
          const ev = data.event;
          if (ev.type === "DRAW") {
            canvasRef.current.drawLine(ev.data.x1, ev.data.y1, ev.data.x2, ev.data.y2, ev.data.color, ev.data.size);
          } else if (ev.type === "END_STROKE") {
            canvasRef.current.endReceivedStroke();
          } else if (ev.type === "CLEAR") {
            canvasRef.current.clear();
          } else if (ev.type === "UNDO") {
            canvasRef.current.undo();
          }
        }
        break;

      case "TIMER_TICK":
        setTimeLeft(data.timeLeft);
        if (data.timeLeft <= 10) {
          playSound("tick");
        }
        break;

      case "CORRECT_ANSWER":
        playSound("correct");
        setTurnStatus("TRANSITION");
        setTransitionMsg(`🎉 ${data.winnerName}님이 정답 [${data.word}]을 맞췄습니다! (+${data.points}점)`);
        
        // 정답 알림 시스템 메시지 추가
        addSystemChatMessage(`🎉 ${data.winnerName}님이 정답 [${data.word}]을 맞췄습니다! (+${data.points}점)`);
        break;

      case "TIME_OUT":
        setTurnStatus("TRANSITION");
        setTransitionMsg(`⏰ 시간 초과! 정답은 [${data.word}]였습니다.`);
        addSystemChatMessage(`⏰ 시간 초과! 정답은 [${data.word}]였습니다.`);
        break;

      case "GAME_OVER":
        playSound("gameover");
        setGameStage("OVER");
        // 최종 플레이어 스코어 목록 갱신
        setPlayers(data.players);
        // Confetti 꽃가루 효과
        triggerConfetti();
        break;

      default:
        break;
    }
  };

  // 호스트가 모든 학생에게 데이터 브로드캐스트
  const broadcastToAll = (message) => {
    connectionsMapRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  };

  // 호스트가 특정 학생을 제외하고 브로드캐스트 (드로잉 등)
  const broadcastDrawToOthers = (senderPeerId, drawEvent) => {
    // 1. 호스트 본인 화면에 먼저 그리기
    if (canvasRef.current) {
      if (drawEvent.type === "DRAW") {
        canvasRef.current.drawLine(
          drawEvent.data.x1, drawEvent.data.y1,
          drawEvent.data.x2, drawEvent.data.y2,
          drawEvent.data.color, drawEvent.data.size
        );
      } else if (drawEvent.type === "END_STROKE") {
        canvasRef.current.endReceivedStroke();
      } else if (drawEvent.type === "CLEAR") {
        canvasRef.current.clear();
      } else if (drawEvent.type === "UNDO") {
        canvasRef.current.undo();
      }
    }

    // 2. 다른 모든 피어들에게 전달
    connectionsMapRef.current.forEach((conn, studentId) => {
      if (conn.open && studentId !== senderPeerId) {
        conn.send({
          type: "DRAW_EVENT",
          event: drawEvent
        });
      }
    });
  };

  // 시스템 메시지 출력용
  const addSystemChatMessage = (text) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: "SYSTEM",
        text,
        type: "system"
      }
    ]);
  };

  // 유저 채팅 메시지 출력용
  const addChatMessage = ({ id, sender, text, isDrawer }) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id,
        sender,
        text,
        isDrawer,
        type: "chat"
      }
    ]);
  };

  // 채팅 및 제시어 정답 검증 처리 (호스트 전용)
  const handleReceivedChatMessage = (senderId, text) => {
    // 발신 플레이어 찾기
    const sender = playersStateRef.current.find((p) => p.id === senderId);
    if (!sender) return;

    const isDrawer = senderId === drawerId;
    const cleanGuess = text.trim().replace(/\s+/g, "");
    const cleanAnswer = currentWordRef.current.trim().replace(/\s+/g, "");

    // 출제자가 정답을 스포일러하는 글을 쓰지 못하도록 하거나,
    // 정답 체크 로직 실행 (출제자가 아니며, 진행 중일 때만 정답 검증)
    if (!isDrawer && turnStatus === "DRAWING" && cleanGuess === cleanAnswer) {
      // 정답 득점 처리!
      const basePoints = 100;
      const speedBonus = Math.floor(timeLeft * 1.5);
      const earnedScore = basePoints + speedBonus;

      // 점수 가산
      const updated = playersStateRef.current.map((p) => {
        if (p.id === senderId) {
          return { ...p, score: p.score + earnedScore };
        }
        // 출제자에게도 보너스 제공
        if (p.id === drawerId) {
          return { ...p, score: p.score + 50 };
        }
        return p;
      });

      playersStateRef.current = updated;
      setPlayers(updated);

      // 교사(호스트)가 업데이트된 플레이어 점수 목록을 학생들에게 즉시 브로드캐스트
      broadcastToAll({
        type: "PLAYER_LIST",
        players: updated
      });

      // 정답 맞춤 신호 전송
      broadcastToAll({
        type: "CORRECT_ANSWER",
        winnerName: sender.name,
        points: earnedScore,
        word: currentWordRef.current
      });

      // 호스트 로컬에서도 상태 전송 처리
      playSound("correct");
      setTurnStatus("TRANSITION");
      setTransitionMsg(`🎉 ${sender.name}님이 정답 [${currentWordRef.current}]을 맞췄습니다! (+${earnedScore}점)`);
      addSystemChatMessage(`🎉 ${sender.name}님이 정답 [${currentWordRef.current}]을 맞췄습니다! (+${earnedScore}점)`);

      // 타이머 종료 및 다음 턴 대기
      stopTimer();
      setTimeout(() => {
        nextTurn();
      }, 5000);

    } else {
      // 일반 채팅 브로드캐스트
      broadcastToAll({
        type: "CHAT_BROADCAST",
        senderName: sender.name,
        text,
        isDrawer
      });

      // 호스트 화면에 표시
      addChatMessage({
        id: Math.random().toString(),
        sender: sender.name,
        text,
        isDrawer
      });
    }
  };

  // 교사(호스트)가 직접 메시지를 쳤을 때
  const handleHostSendChat = () => {
    if (!chatInput.trim()) return;

    // 호스트는 출제자나 문제 맞추는 주체는 아니지만 공지 용도로 브로드캐스트 가능
    broadcastToAll({
      type: "CHAT_BROADCAST",
      senderName: "선생님",
      text: chatInput.trim(),
      isDrawer: false
    });

    addChatMessage({
      id: Math.random().toString(),
      sender: "선생님",
      text: chatInput.trim(),
      isDrawer: false
    });

    setChatInput("");
  };

  // 학생(참여자)이 메시지를 전송할 때 (호스트에게 발신)
  const handleStudentSendChat = () => {
    if (!chatInput.trim()) return;

    if (connRef.current && connRef.current.open) {
      connRef.current.send({
        type: "CHAT",
        text: chatInput.trim()
      });
    }
    setChatInput("");
  };

  // 키보드 엔터 키 제출 핸들러
  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (isHost) {
      handleHostSendChat();
    } else {
      handleStudentSendChat();
    }
  };

  // 캔버스 마우스/터치 그리기 이벤트 송신
  const handleCanvasDrawEvent = (event) => {
    // 내가 출제자일때만 동작
    const isMeDrawer = (isHost && drawerId === "host") || (!isHost && peerRef.current && peerRef.current.id === drawerId);
    
    if (!isMeDrawer) return;

    if (isHost) {
      // 호스트 본인이 출제자인 경우 -> 다른 학생들에게 브로드캐스트
      connectionsMapRef.current.forEach((conn) => {
        if (conn.open) {
          conn.send({
            type: "DRAW_EVENT",
            event
          });
        }
      });
    } else {
      // 학생이 출제자인 경우 -> 교사(호스트)에게만 발송하면, 교사가 타 피어들에게 리디렉트
      if (connRef.current && connRef.current.open) {
        connRef.current.send({
          type: "DRAW_EVENT",
          event
        });
      }
    }
  };

  // 교사용 게임 시작 실행
  const handleStartGame = () => {
    const students = players.filter((p) => p.id !== "host");
    if (students.length < 1) {
      alert("최소 한 명 이상의 학생이 들어와야 게임을 시작할 수 있습니다.");
      return;
    }

    // refs 바인딩
    roundTimeRef.current = roundTime;
    totalRoundsRef.current = totalRounds;
    categoryRef.current = wordCategory;
    
    // 게임 시작 시그널 브로드캐스트
    broadcastToAll({
      type: "GAME_START",
      settings: {
        duration: roundTime,
        rounds: totalRounds
      }
    });

    playSound("start");
    setGameStage("PLAYING");
    setCurrentRound(1);
    turnIndexRef.current = 0;
    activeDrawerIndexRef.current = 0;
    usedWordsRef.current.clear();

    // 첫 턴 시작
    setTimeout(() => {
      startNewTurn();
    }, 1000);
  };

  // 로드된 제시어 중 랜덤으로 선출하는 헬퍼 함수
  const getLocalRandomWord = (categoryKey) => {
    const category = gameWordsRef.current[categoryKey] || gameWordsRef.current.deokso;
    const words = category.words;
    if (!words || words.length === 0) return "덕소중학교";
    const randomIndex = Math.floor(Math.random() * words.length);
    return words[randomIndex];
  };

  // 새 턴 시작 처리 (호스트만 수행)
  const startNewTurn = () => {
    const candidates = playersStateRef.current.filter((p) => p.id !== "host");
    if (candidates.length === 0) return;
    
    // 출제자 객체 선택
    let drawerIdx = activeDrawerIndexRef.current;
    if (drawerIdx >= candidates.length) {
      drawerIdx = 0;
    }
    activeDrawerIndexRef.current = drawerIdx;

    const drawer = candidates[drawerIdx];
    
    // 제시어 무작위 선출
    let word = getLocalRandomWord(categoryRef.current);
    // 중복 방지 (단어장의 단어를 다 썼을 경우 리셋)
    let attempts = 0;
    while (usedWordsRef.current.has(word) && attempts < 50) {
      word = getLocalRandomWord(categoryRef.current);
      attempts++;
    }
    usedWordsRef.current.add(word);
    currentWordRef.current = word;

    // 클라이언트 표시용 힌트 글자 만들기 (예: "떡볶이" -> "_ _ _ (3글자)")
    const hintText = Array(word.length).fill("_").join(" ");

    // 로컬 상태 업데이트 (호스트 본인용)
    setTurnStatus("DRAWING");
    setDrawerId(drawer.id);
    setDrawerName(drawer.name);
    setWordLength(word.length);
    setWordHint(hintText);
    setTimeLeft(roundTimeRef.current);
    
    if (drawer.id === "host" || isHost) {
      setCurrentWord(word);
    } else {
      setCurrentWord("");
    }

    // 다른 학생들에게 새 턴 알림
    connectionsMapRef.current.forEach((conn, studentId) => {
      if (conn.open) {
        conn.send({
          type: "START_TURN",
          drawerId: drawer.id,
          drawerName: drawer.name,
          wordLength: word.length,
          hint: hintText,
          timeLeft: roundTimeRef.current,
          round: currentRound,
          turn: turnIndexRef.current + 1,
          word: studentId === drawer.id ? word : "" // 출제자 학생에게만 단어 제공
        });
      }
    });

    // 캔버스 초기화
    if (canvasRef.current) {
      canvasRef.current.clear();
    }

    // 타이머 시작
    startTimer();
  };

  // 타이머 실행 (호스트 전용)
  const startTimer = () => {
    stopTimer();
    
    let secondsLeft = roundTimeRef.current;
    setTimeLeft(secondsLeft);

    timerIntervalRef.current = setInterval(() => {
      secondsLeft--;
      setTimeLeft(secondsLeft);

      // 전체 학생들에게 타이머 틱 동기화
      broadcastToAll({
        type: "TIMER_TICK",
        timeLeft: secondsLeft
      });

      if (secondsLeft <= 10 && secondsLeft > 0) {
        playSound("tick");
      }

      if (secondsLeft <= 0) {
        stopTimer();
        // 시간 초과 처리
        handleTimeOut();
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // 시간 초과 처리
  const handleTimeOut = () => {
    setTurnStatus("TRANSITION");
    setTransitionMsg(`⏰ 시간 초과! 정답은 [${currentWordRef.current}]였습니다.`);
    addSystemChatMessage(`⏰ 시간 초과! 정답은 [${currentWordRef.current}]였습니다.`);

    broadcastToAll({
      type: "TIME_OUT",
      word: currentWordRef.current
    });

    // 5초 대기 후 다음 턴으로
    setTimeout(() => {
      nextTurn();
    }, 5000);
  };

  // 다음 턴 전환 제어
  const nextTurn = () => {
    stopTimer();

    // 턴 인덱스 증가
    turnIndexRef.current += 1;
    activeDrawerIndexRef.current += 1;

    const studentCandidates = playersStateRef.current.filter((p) => p.id !== "host");

    // 모든 학생 플레이어가 한 번씩 그렸다면 1라운드 종료
    if (activeDrawerIndexRef.current >= studentCandidates.length) {
      activeDrawerIndexRef.current = 0;
      
      const nextRound = currentRound + 1;
      if (nextRound > totalRoundsRef.current) {
        // 게임 완전 종료!
        handleGameOver();
        return;
      }
      setCurrentRound(nextRound);
    }

    startNewTurn();
  };

  // Firestore에 학생들의 최종 게임 결과 저장
  const saveScoresToFirestore = async (sortedPlayers) => {
    try {
      const scoresCol = collection(db, "catch_scores");
      const promises = sortedPlayers.map((player) => {
        return addDoc(scoresCol, {
          nickname: player.name,
          score: player.score,
          roomCode: roomCode,
          timestamp: serverTimestamp()
        });
      });
      await Promise.all(promises);
      console.log("Firestore에 게임 성적 저장 성공!");
    } catch (e) {
      console.error("Firestore에 게임 성적 저장 실패:", e);
    }
  };

  // 게임 오버 처리
  const handleGameOver = () => {
    setGameStage("OVER");
    
    // 선생님을 제외하고 점수별 내림차순 정렬하여 우승 포디움 생성
    const studentsOnly = playersStateRef.current.filter((p) => p.id !== "host");
    const sorted = [...studentsOnly].sort((a, b) => b.score - a.score);
    setPlayers(sorted); // 추가: 호스트(교사) 로컬 화면 스코어 목록도 순위순 갱신
    
    broadcastToAll({
      type: "GAME_OVER",
      players: sorted
    });

    // Firestore에 성적 기록
    saveScoresToFirestore(sorted);

    // 교사 오디오 및 Confetti
    playSound("gameover");
    triggerConfetti();
  };

  // Confetti 꽃가루 효과 연출
  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  // 드로잉이 가능한 상태인지 여부 반환
  const checkIsDrawer = () => {
    if (gameStage !== "PLAYING" || turnStatus !== "DRAWING") return false;
    if (isHost && drawerId === "host") return true;
    if (!isHost && peerRef.current && peerRef.current.id === drawerId) return true;
    return false;
  };

  if (!mounted) {
    return <div style={{ minHeight: "100vh", background: "#0a0e1a" }} />;
  }

  return (
    <div className="app-container">
      {/* 글로벌 상단 헤더 */}
      <header className="app-header">
        <div className="logo-container" onClick={resetGameState}>
          <div className="logo-badge">Deokso</div>
          <h1 className="logo-text">덕소중 캐치마인드<span className="logo-subtext">그림퀴즈</span></h1>
        </div>

        {gameStage === "LOBBY" ? (
          <div>
            <button 
              onClick={() => window.location.href = "/admin"} 
              className="btn btn-outline btn-sm"
              style={{ display: "flex", alignItems: "center", gap: "0.25rem", border: "1px solid rgba(255,255,255,0.15)", color: "#f8fafc" }}
            >
              ⚙️ 관리자 페이지
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span className="status-badge connected">
              {isHost ? "선생님 방장" : "참가 학생"}
            </span>
            <button className="btn btn-danger btn-sm" onClick={resetGameState}>
              🚪 방 나가기
            </button>
          </div>
        )}
      </header>

      <main className="main-content">

        {/* =======================================================
            [LOBBY] 로비 화면 (방 만들기 / 방 입장)
            ======================================================= */}
        {gameStage === "LOBBY" && (
          <div className="lobby-grid">
            {/* 학생용 입장하기 카드 */}
            <div className="lobby-card student-card">
              <h2 className="card-title">✏️ 학생용 게임 참가</h2>
              <p className="card-desc">
                선생님이 스크린에 띄워주신 4자리 참여 코드와 나의 닉네임을 입력하고 게임 대기실로 입장하세요.
              </p>

              <div className="form-group">
                <label className="form-label">참여 코드 (4자리 숫자)</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="예: 1234"
                  className="form-input"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">내 닉네임</label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="닉네임 입력 (최대 10자)"
                  className="form-input"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

              <button 
                className="btn btn-secondary btn-block" 
                onClick={handleJoinRoom}
                disabled={peerLoading}
                style={{ marginTop: "1rem" }}
              >
                {peerLoading ? "방 연결 시도 중..." : "🚀 대기실 입장하기"}
              </button>

              {peerError && <p style={{ color: "var(--error-color)", marginTop: "1rem", fontSize: "0.9rem" }}>{peerError}</p>}
            </div>
          </div>
        )}

        {/* =======================================================
            [WAITING] 게임 대기실 화면
            ======================================================= */}
        {gameStage === "WAITING" && (
          <div className="waiting-container">
            <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>덕소중 캐치마인드 대기실 🎮</h2>
            <p style={{ color: "var(--text-secondary)" }}>
              {isHost ? "학생들에게 참여 코드를 화면에 띄워주고 접속을 안내해주세요!" : "선생님이 게임을 시작할 때까지 대기하세요."}
            </p>

            <div className="code-display">
              <span className="code-label">참여 코드 (Room Code)</span>
              <span className="code-value">{roomCode}</span>
            </div>

            <div className="students-section">
              <div className="section-header">
                <span>접속한 참여자 목록</span>
                <span className="student-count-badge">{players.length}명 접속 중</span>
              </div>
              
              <div className="students-grid">
                {players.map((p) => (
                  <div key={p.id} className="student-card">
                    <div className="student-avatar">{p.avatar}</div>
                    <span className="student-name">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {isHost ? (
              <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
                <button 
                  className="btn btn-outline" 
                  onClick={resetGameState}
                >
                  방 폭파하기
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleStartGame}
                  style={{ paddingLeft: "3rem", paddingRight: "3rem" }}
                >
                  🚀 게임 시작하기
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", marginTop: "2rem" }}>
                <div className="status-badge connected">선생님의 게임 시작을 대기하고 있습니다...</div>
              </div>
            )}
          </div>
        )}

        {/* =======================================================
            [PLAYING] 게임 진행중 화면
            ======================================================= */}
        {gameStage === "PLAYING" && (
          <div className="game-grid">
            
            {/* 좌측 순위표 패널 */}
            <div className="game-panel">
              <div className="panel-header">
                <span>🏆 실시간 순위</span>
                <span className="student-count-badge">R {currentRound}/{totalRounds}</span>
              </div>
              <div className="rank-list">
                {[...players].filter((p) => p.id !== "host").sort((a, b) => b.score - a.score).map((p, idx) => {
                  const isMe = (!isHost && peerRef.current && p.id === peerRef.current.id) || (isHost && p.id === "host");
                  const isPlayerDrawer = p.id === drawerId;
                  return (
                    <div 
                      key={p.id} 
                      className={`rank-item ${isPlayerDrawer ? "is-drawer" : ""} ${isMe ? "is-me" : ""}`}
                    >
                      <div className="rank-number">{idx + 1}</div>
                      <span className="rank-avatar">{p.avatar}</span>
                      <div className="rank-info">
                        <span className="rank-name">{p.name}</span>
                        <span className="rank-points">{p.score} 점</span>
                      </div>
                      {isPlayerDrawer && <span className="drawer-indicator">그림</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 중앙 화이트보드 캔버스 영역 */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              
              {/* 제시어 및 타이머 바 */}
              <div className="game-info-bar">
                <div className="info-round">
                  <span>라운드 {currentRound}</span>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "500", marginTop: "0.2rem" }}>
                    출제자: {drawerName}
                  </div>
                </div>

                <div className="info-word-container">
                  <span className="word-label">
                    {checkIsDrawer() ? "🎨 나에게 보낸 제시어" : isHost ? "🎓 제시어 (선생님 화면)" : "💡 문제 글자 수"}
                  </span>
                  
                  {checkIsDrawer() || isHost ? (
                    <span className="word-value">{currentWord}</span>
                  ) : (
                    <span className="word-value is-hint">{wordHint}</span>
                  )}
                </div>

                <div className={`info-timer ${timeLeft <= 10 ? "low-time" : ""}`}>
                  {timeLeft}
                </div>
              </div>

              {/* 캔버스 본체 */}
              <div style={{ display: "flex", flex: 1, position: "relative" }}>
                <Canvas
                  ref={canvasRef}
                  isDrawer={checkIsDrawer()}
                  drawerName={drawerName}
                  onDrawEvent={handleCanvasDrawEvent}
                />

                {/* 라운드 전환 (답 확인) 오버레이 화면 */}
                {turnStatus === "TRANSITION" && (
                  <div className="canvas-overlay-msg" style={{ background: "rgba(10, 14, 26, 0.95)" }}>
                    <p className="overlay-title" style={{ fontSize: "2.4rem", color: "var(--warning-color)" }}>
                      ROUND RESULT
                    </p>
                    <p className="overlay-desc" style={{ fontSize: "1.4rem", fontWeight: "700", margin: "1rem 0" }}>
                      {transitionMsg}
                    </p>
                    <div style={{ 
                      width: "60px", 
                      height: "60px", 
                      border: "4px solid rgba(255,255,255,0.1)", 
                      borderTopColor: "var(--accent-color)", 
                      borderRadius: "50%", 
                      animation: "spin 1s linear infinite" 
                    }} />
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>잠시 후 다음 턴이 시작됩니다...</p>
                  </div>
                )}
              </div>
            </div>

            {/* 우측 실시간 채팅창 패널 */}
            <div className="game-panel">
              <div className="panel-header">
                <span>💬 실시간 채팅 및 정답 입력</span>
              </div>
              <div className="chat-container">
                <div className="chat-messages">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`chat-msg ${msg.type}`}>
                      {msg.type === "chat" ? (
                        <>
                          <span className={`chat-msg-sender ${msg.isDrawer ? "is-drawer" : ""}`}>
                            {msg.sender}:
                          </span>
                          <span className="chat-msg-content">{msg.text}</span>
                        </>
                      ) : (
                        <span>{msg.text}</span>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                
                <form className="chat-input-form" onSubmit={handleChatSubmit}>
                  <input
                    type="text"
                    placeholder={
                      checkIsDrawer() 
                        ? "출제자는 정답을 칠 수 없습니다." 
                        : "채팅 또는 정답 단어 입력..."
                    }
                    className="chat-input"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={checkIsDrawer()}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-sm"
                    disabled={checkIsDrawer()}
                  >
                    전송
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}

        {/* =======================================================
            [OVER] 게임 오버 / 최종 시상대 화면
            ======================================================= */}
        {gameStage === "OVER" && (
          <div className="podium-container">
            <h2 className="podium-title">🏆 최종 게임 결과 🏆</h2>

            <div className="podium-wrapper">
              {/* 2등 단상 */}
              {players[1] && (
                <div className="podium-place second">
                  <div className="podium-avatar">{players[1].avatar}</div>
                  <span className="podium-player-name">{players[1].name}</span>
                  <span className="podium-player-score">{players[1].score} 점</span>
                  <div className="podium-pedestal">2</div>
                </div>
              )}

              {/* 1등 단상 */}
              {players[0] && (
                <div className="podium-place first">
                  <div className="podium-avatar">{players[0].avatar}</div>
                  <span className="podium-player-name">{players[0].name}</span>
                  <span className="podium-player-score">{players[0].score} 점</span>
                  <div className="podium-pedestal">1</div>
                </div>
              )}

              {/* 3등 단상 */}
              {players[2] && (
                <div className="podium-place third">
                  <div className="podium-avatar">{players[2].avatar}</div>
                  <span className="podium-player-name">{players[2].name}</span>
                  <span className="podium-player-score">{players[2].score} 점</span>
                  <div className="podium-pedestal">3</div>
                </div>
              )}
            </div>

            {/* 나머지 순위 리스트 */}
            {players.length > 3 && (
              <div className="game-panel" style={{ maxWidth: "450px", margin: "0 auto 2.5rem", padding: "0.5rem" }}>
                <div className="panel-header" style={{ background: "transparent", borderBottom: "none" }}>
                  <span>기타 순위</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.5rem" }}>
                  {players.slice(3).map((p, idx) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 1rem", background: "rgba(255,255,255,0.02)", borderRadius: "var(--radius-sm)" }}>
                      <span>{idx + 4}등 - {p.avatar} {p.name}</span>
                      <span style={{ color: "var(--accent-color)", fontWeight: "bold" }}>{p.score} 점</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button className="btn btn-outline" onClick={resetGameState}>
                로비로 돌아가기
              </button>
              {isHost && (
                <button className="btn btn-primary" onClick={handleStartGame}>
                  🔄 게임 다시하기
                </button>
              )}
            </div>
          </div>
        )}

      </main>

      {/* 로딩 인디케이터 오버레이 */}
      {peerLoading && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(10, 14, 26, 0.8)",
          backdropFilter: "blur(4px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "1.5rem",
          zIndex: 100
        }}>
          <div style={{
            width: "50px",
            height: "50px",
            border: "4px solid rgba(255,255,255,0.1)",
            borderTopColor: "var(--accent-color)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }} />
          <p style={{ fontSize: "1.1rem", fontWeight: "600" }}>
            {isHost ? "새로운 방을 생성하고 네트워크를 구축 중입니다..." : "게임 룸에 접속 중입니다..."}
          </p>
        </div>
      )}

      {/* 회전 로딩용 CSS 애니메이션 추가 */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
}

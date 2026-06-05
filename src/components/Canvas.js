import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from "react";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 450;

const COLORS = [
  { name: "검정", hex: "#000000" },
  { name: "빨강", hex: "#ef4444" },
  { name: "파랑", hex: "#3b82f6" },
  { name: "초록", hex: "#10b981" },
  { name: "노랑", hex: "#eab308" },
  { name: "주황", hex: "#f97316" },
  { name: "보라", hex: "#a855f7" },
  { name: "지우개", hex: "#ffffff", isEraser: true }
];

const Canvas = forwardRef(({ isDrawer, onDrawEvent, drawerName }, ref) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  
  // 실행 취소(Undo)를 위한 그리기 기록 저장소
  // 각 획(Stroke)은 선분(segment)들의 배열로 저장됩니다.
  const [strokeHistory, setStrokeHistory] = useState([]);
  const currentStrokeRef = useRef([]);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // 캔버스 초기 설정
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 캔버스 가상 해상도 고정 (어디서나 동일한 좌표 비율 보장)
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const context = canvas.getContext("2d");
    context.lineCap = "round";
    context.lineJoin = "round";
    contextRef.current = context;

    // 초기 흰색 배경 칠하기
    clearCanvas(true);
  }, []);

  // 외부(부모 컴포넌트)에서 호출할 수 있는 함수들 정의
  useImperativeHandle(ref, () => ({
    // 네트워크를 통해 수신된 선 그리기 명령 실행
    drawLine: (x1, y1, x2, y2, lineColor, lineSize) => {
      drawOnContext(x1, y1, x2, y2, lineColor, lineSize);
      
      // 관전자도 로컬 기록에 선분 추가 (나중에 실행취소 수신 시 다시 그릴 때 사용)
      if (currentStrokeRef.current.length === 0) {
        currentStrokeRef.current = [];
      }
      currentStrokeRef.current.push({ x1, y1, x2, y2, color: lineColor, size: lineSize });
    },
    
    // 네트워크로 수신된 획 종료(마우스업) 신호 처리
    endReceivedStroke: () => {
      if (currentStrokeRef.current.length > 0) {
        setStrokeHistory(prev => [...prev, currentStrokeRef.current]);
        currentStrokeRef.current = [];
      }
    },

    // 캔버스 전체 지우기
    clear: () => {
      clearCanvas(true);
    },

    // 실행 취소 (이전 획 지우기)
    undo: () => {
      undoStroke(true);
    }
  }));

  // 실제 Canvas 2D 컨텍스트에 픽셀을 그리는 헬퍼 함수
  const drawOnContext = (x1, y1, x2, y2, strokeColor, strokeSize) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeSize;
    ctx.stroke();
    ctx.closePath();
  };

  // 캔버스 초기화 함수
  const clearCanvas = (localOnly = false) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setStrokeHistory([]);
    currentStrokeRef.current = [];

    if (!localOnly && isDrawer && onDrawEvent) {
      onDrawEvent({ type: "CLEAR" });
    }
  };

  // 실행 취소 함수
  const undoStroke = (localOnly = false) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    // 히스토리에서 마지막 획 제거
    const updatedHistory = [...strokeHistory];
    if (updatedHistory.length === 0) return;
    
    updatedHistory.pop();
    setStrokeHistory(updatedHistory);

    // 캔버스 하얗게 지우고 처음부터 다시 그리기
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    updatedHistory.forEach(stroke => {
      stroke.forEach(seg => {
        drawOnContext(seg.x1, seg.y1, seg.x2, seg.y2, seg.color, seg.size);
      });
    });

    if (!localOnly && isDrawer && onDrawEvent) {
      onDrawEvent({ type: "UNDO" });
    }
  };

  // 마우스/터치 좌표를 800x450 해상도 좌표로 맵핑하는 함수
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // 터치와 마우스 구분 처리
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // 캔버스 크기 변화율에 따른 스케일링 계산
    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;

    return { x, y };
  };

  // 마우스/터치 시작
  const startDrawing = (e) => {
    if (!isDrawer) return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    lastPosRef.current = { x, y };
    setIsDrawing(true);
    currentStrokeRef.current = [];
  };

  // 마우스/터치 이동 (그리기 동작)
  const draw = (e) => {
    if (!isDrawer || !isDrawing) return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    const x1 = lastPosRef.current.x;
    const y1 = lastPosRef.current.y;
    const x2 = x;
    const y2 = y;

    // 로컬 캔버스에 즉시 그리기
    drawOnContext(x1, y1, x2, y2, color, brushSize);

    // 현재 획 정보에 선분 누적
    const segment = { x1, y1, x2, y2, color, size: brushSize };
    currentStrokeRef.current.push(segment);

    // 부모 컴포넌트에 그리기 데이터 전송 (부모가 피어들에게 브로드캐스트)
    if (onDrawEvent) {
      onDrawEvent({
        type: "DRAW",
        data: segment
      });
    }

    lastPosRef.current = { x, y };
  };

  // 마우스/터치 종료
  const stopDrawing = () => {
    if (!isDrawer || !isDrawing) return;
    setIsDrawing(false);

    if (currentStrokeRef.current.length > 0) {
      // 획이 정상 종료되면 획 히스토리에 추가
      setStrokeHistory(prev => [...prev, currentStrokeRef.current]);
      
      // 부모 컴포넌트에 획 종료 이벤트 전달
      if (onDrawEvent) {
        onDrawEvent({ type: "END_STROKE" });
      }
    }
  };

  return (
    <div className="canvas-container">
      {/* 출제자 그리기 제어판 (출제자에게만 노출) */}
      {isDrawer && (
        <div className="canvas-toolbar">
          <div className="toolbar-group">
            <span style={{ fontSize: "0.85rem", fontWeight: "bold" }}>🎨 도구:</span>
            <div className="color-picker">
              {COLORS.map((col) => (
                <button
                  key={col.hex}
                  className={`color-option ${color === col.hex ? "active" : ""}`}
                  style={{
                    backgroundColor: col.isEraser ? "#ffffff" : col.hex,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.6rem",
                    color: "#000"
                  }}
                  onClick={() => setColor(col.hex)}
                  title={col.name}
                >
                  {col.isEraser && "🧼"}
                </button>
              ))}
            </div>
          </div>

          <div className="toolbar-group">
            <div className="brush-slider-wrapper">
              <span>선 굵기:</span>
              <input
                type="range"
                min="2"
                max="30"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="brush-slider"
              />
              <span>{brushSize}px</span>
            </div>
            
            <button className="btn btn-outline btn-sm" onClick={() => undoStroke(false)}>
              ↩️ 되돌리기
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => clearCanvas(false)}>
              🗑️ 전체지우기
            </button>
          </div>
        </div>
      )}

      {/* 실시간 드로잉 캔버스 */}
      <canvas
        ref={canvasRef}
        className="canvas-element"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      {/* 관전자(맞추는 학생)에게 노출되는 블러 오버레이 */}
      {!isDrawer && (
        <div className="canvas-overlay-msg" style={{ display: drawerName ? "none" : "flex" }}>
          <p className="overlay-title">덕소중 캐치마인드 🎮</p>
          <p className="overlay-desc">출제자가 그림을 그리기를 대기하고 있습니다.</p>
        </div>
      )}
    </div>
  );
});

Canvas.displayName = "Canvas";

export default Canvas;

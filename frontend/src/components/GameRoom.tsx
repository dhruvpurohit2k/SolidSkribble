import {
  Accessor,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Setter,
  Show,
} from "solid-js";
import { type Player } from "../utils/types";
import { WebSocketMessageType } from "../utils/websocketMessageType";
import { createEffect } from "solid-js";
import {
  recieveCanvasInput,
  recieveColor,
  recieveUndo,
  recieveStrokeWidth,
  setCanvasState,
} from "../utils/websocketMessageHandlers";
import ChatBox from "./ChatBox";
import ToolBox from "./ToolBox";
import { Canvas, Message, MouseEventType, Stroke } from "../utils/types";
import { useUserContext } from "../context/UserContext";
import { sleep } from "../utils/sleep";
import WordSelection from "./WordSelection";

function GameRoom({
  canvasStateData,
  canvasInputData,
  acceptWord,
  widthSignal,
  wordOptions,
  playerList,
  colorSignal,
  connection,
  undoSignal,
  messages,
  activePlayerId,
  addMessage,
  selectedWord,
  roundTime,
  roundNumber,
  currentRound,
}: GameRoomProps) {
  const strokes: Stroke[] = [];
  const [currentColor, setCurrentColor] = createSignal<string>("#000000");
  const [timerWidth, setTimerWidth] = createSignal<number>(100);
  const [currentWidth, setCurrentWidth] = createSignal<number>(2);
  const [wordIndex, setWordIndex] = createSignal<number>(-1);
  const [wordSelected, setWordSelected] = createSignal<boolean>(false);
  const encoder = new TextEncoder();
  let rect: DOMRect;
  let isDrawing = false;
  let conn = connection();
  let canvas: Canvas = {
    strokes: [],
    currentColor: currentColor(),
    currentWidth: currentWidth(),
  };
  let resizeObserver: ResizeObserver;
  let canvasRef: HTMLCanvasElement | undefined;
  let ctx: CanvasRenderingContext2D | null = null;
  let scaleFactorX: number;
  let scaleFactorY: number;
  const [wordSelection, setWordSelection] = createSignal<boolean>(false);
  createEffect(() => {
    if (canvasInputData() === null) return;
    canvasInputData();
    recieveCanvasInput(canvasInputData()!, canvas, ctx);
  });
  createEffect(() => {
    if (canvasStateData() === null) return;
    setCanvasState(
      canvasStateData()!,
      canvas,
      redraw,
      setCurrentColor,
      setCurrentWidth,
    );
  });

  createEffect(
    on(
      wordOptions,
      async () => {
        setWordSelection(true);
        const interval = setInterval(() => {
          setTimerWidth((width) => width - 1);
        }, 150);
        setTimeout(() => {
          if (wordSelected() !== true) {
            acceptWord(0);
            setWordSelection(false);
          }
          clearInterval(interval);
          setWordSelected(false);
          setWordIndex(-1);
          setTimerWidth(100);
        }, 15000);
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      colorSignal,
      () => {
        recieveColor(colorSignal()!, canvas, setCurrentColor);
      },
      { defer: true },
    ),
  );
  createEffect(
    on(widthSignal, () => {
      recieveStrokeWidth(widthSignal()!, canvas, setCurrentWidth);
    }),
  );
  createEffect(
    on(
      undoSignal,
      () => {
        recieveUndo(canvas, redraw);
      },
      { defer: true },
    ),
  );

  onMount(() => {
    if (canvasRef) {
      rect = canvasRef.getBoundingClientRect();
      ctx = canvasRef.getContext("2d");
      scaleFactorX = canvasRef.width / rect.width;
      scaleFactorY = canvasRef.height / rect.height;
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          rect = canvasRef.getBoundingClientRect();
          if (entry.target === canvasRef) {
            scaleFactorX = canvasRef.width / rect.width;
            scaleFactorY = canvasRef.height / rect.height;
          }
        }
      });
      resizeObserver.observe(canvasRef);
    }
  });
  onCleanup(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });
  const sendBuffer = new ArrayBuffer(6);
  const viewBuffer = new DataView(sendBuffer);
  function canvasClickDown(e: MouseEvent) {
    beginDrawing(
      (e.clientX - rect.left) * scaleFactorX,
      (e.clientY - rect.top) * scaleFactorY,
    );
  }
  function beginDrawing(x: number, y: number) {
    if (!ctx) return;
    if (x < 0 || y < 0) return;
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = canvas.currentWidth;
    ctx.strokeStyle = canvas.currentColor;
    const newStroke: Stroke = {
      coordinates: [[x, y]],
      color: canvas.currentColor,
      strokeWidth: canvas.currentWidth,
    };
    canvas.strokes.push(newStroke);
    viewBuffer.setUint8(0, WebSocketMessageType.CANVASINPUT);
    viewBuffer.setUint8(1, MouseEventType.PRESSED);
    viewBuffer.setUint16(2, x, false);
    viewBuffer.setUint16(4, y, false);
    conn?.send(sendBuffer);
  }
  function canvasMousePress(e: MouseEvent) {
    if (!isDrawing) return;
    // const D = 25;
    const x = (e.clientX - rect.left) * scaleFactorX;
    const y = (e.clientY - rect.top) * scaleFactorY;
    // const lastPoint = canvas.strokes.at(-1)?.coordinates.at(-1)!;
    // const dx = x - lastPoint[0];
    // const dy = y - lastPoint[1];
    // const d = dx * dx + dy * dy;
    // if (d < D) return;
    draw(x, y);
  }
  function draw(x: number, y: number) {
    if (!isDrawing || !ctx) return;
    if (x < 0 || y < 0) return;
    ctx.lineWidth = canvas.currentWidth;
    ctx.strokeStyle = canvas.currentColor;
    ctx.lineTo(x, y);
    ctx.stroke();
    canvas.strokes.at(-1)!.coordinates.push([x, y]);
    viewBuffer.setUint8(0, WebSocketMessageType.CANVASINPUT);
    viewBuffer.setUint8(1, MouseEventType.DRAWING);
    viewBuffer.setUint16(2, x, false);
    viewBuffer.setUint16(4, y, false);
    conn?.send(sendBuffer);
  }
  function canvasClickUp() {
    stopDrawing();
    viewBuffer.setUint8(0, WebSocketMessageType.CANVASINPUT);
    viewBuffer.setUint8(1, MouseEventType.RELEASED);
    viewBuffer.setUint16(2, 0, false);
    viewBuffer.setUint16(4, 0, false);
    conn?.send(sendBuffer);
  }
  function stopDrawing() {
    isDrawing = false;
    ctx?.closePath();
  }
  function undo() {
    if (canvas.strokes.length === 0) return;
    if (!ctx || !canvasRef) return;
    canvas.strokes.pop();
    redraw();
    viewBuffer.setUint8(0, WebSocketMessageType.CANVASUNDO);
    viewBuffer.setUint8(1, 0);
    viewBuffer.setUint16(2, 0, false);
    viewBuffer.setUint16(4, 0, false);
    conn?.send(sendBuffer);
  }
  function redraw() {
    if (ctx === null || canvasRef === undefined) return;
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    canvas.strokes.forEach((stroke) => {
      ctx!.lineWidth = stroke.strokeWidth;
      ctx!.strokeStyle = stroke.color;
      ctx?.beginPath();
      stroke.coordinates.forEach((point, i) => {
        if (i === 0) {
          ctx?.moveTo(point[0], point[1]);
        } else {
          ctx?.lineTo(point[0], point[1]);
        }
      });
      ctx?.stroke();
    });
  }

  function colorSetter(color: string) {
    setCurrentColor(color);
    canvas.currentColor = currentColor();
    const colorString = JSON.stringify({
      color: canvas.currentColor,
    });
    const encodedString = encoder.encode(colorString);
    const buffer = new ArrayBuffer(encodedString.byteLength + 1);
    const view = new Uint8Array(buffer);
    view[0] = WebSocketMessageType.STROKECOLOR;
    view.set(encodedString, 1);
    conn?.send(buffer);
  }

  function widthSetter(width: number) {
    setCurrentWidth(width);
    canvas.currentWidth = currentWidth();
    const widthString = JSON.stringify({
      width: width,
    });
    const encodedString = encoder.encode(widthString);
    const buffer = new ArrayBuffer(encodedString.byteLength + 1);
    const view = new Uint8Array(buffer);
    view[0] = WebSocketMessageType.STROKEWIDTH;
    view.set(encodedString, 1);
    conn?.send(buffer);
  }

  return (
    <div class="mx-auto items-start grid p-2 grid-rows-[1fr_4fr_4fr] lg:grid-rows-[1fr_12fr] grid-cols-1 lg:grid-cols-[10fr_3fr] gap-2 h-full">
      <div class="bg-yellow-500 font-bold border p-1 flex items-start lg:col-span-2 rounded border-bg-light text-text-muted gap-1 shadow-[10px_10px_0px_#000]">
        <For each={playerList}>
          {(player, i) => (
            <div
              class={[
                " h-full flex flex-col animate-[top-slide-in_1s_ease-in-out_both] p-2 items-center rounded font-marker text-xl shadow-[5px_5px_0px_#000]",
                player.inActive
                  ? "bg-neutral-800 text-white"
                  : player.id === activePlayerId()
                    ? "bg-red-700 text-black border border-black"
                    : "bg-orange-400 text-black",
              ].join(" ")}
              style={{
                "animation-delay": `${i() * 500}ms`,
              }}
            >
              <p>{player.name}</p>
              <p>{player.points}</p>
            </div>
          )}
        </For>
      </div>
      <Show when={wordSelection()} fallback={<></>}>
        <WordSelection
          setWordIndex={setWordIndex}
          wordIndex={wordIndex}
          timerWidth={timerWidth}
          wordOptions={wordOptions}
          acceptWord={acceptWord}
          setWordSelection={setWordSelection}
          setWordSelected={setWordSelected}
        />
      </Show>
      <div class="relative col-start-1 flex flex-col gap-2 ">
        <div class="flex justify-around">
          <div class=" text-2xl font-marker bg-orange-500 text-yellow-200 rounded shadow-[10px_10px_0px_#000] items-center flex px-5 py-2 border border-black">
            ROUND : {currentRound()} / {roundNumber()}
          </div>
          <Show when={selectedWord() !== ""}>
            <p class="text-yellow-500 font-marker text-3xl px-10 py-2 text-center font-bold bg-red-500 p-1 self-center shadow-[10px_10px_0px_#000] after:content-[' '] after:h-full after:w-full after:top-0 after:left-0 after:absolute relative after:border-5 after:border-yellow-500 rounded after:rounded">
              {selectedWord()}
            </p>
          </Show>
          <div class=" text-xl relative font-marker bg-orange-500 text-yellow-200 rounded shadow-[10px_10px_0px_#000] min-w-[12ch] items-center flex px-5 py-2 border border-black justify-center">
            <p>TIMER : </p>
            <p class="ml-auto">{roundTime()}</p>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          class={[
            "bg-white w-full rounded cursor-default border-bg-dark border shadow-[10px_10px_0px_#000]",
            useUserContext()?.id.value() !== activePlayerId()
              ? "pointer-events-none"
              : "",
          ].join(" ")}
          onMouseDown={canvasClickDown}
          height={900}
          width={1600}
          onMouseMove={canvasMousePress}
          onMouseUp={canvasClickUp}
          onMouseOut={canvasClickUp}
        ></canvas>
        <Show
          when={useUserContext()?.id.value() === activePlayerId()}
          fallback={<></>}
        >
          <ToolBox
            class="bg-yellow-500 gap-10 shadow-[10px_10px_0px_#000] items-center font-bold py-2 px-5 flex rounded"
            colorSetter={colorSetter}
            undoHandler={undo}
            widthSetter={widthSetter}
            currentColor={currentColor}
            currentWidth={currentWidth}
          />
        </Show>
      </div>
      <ChatBox
        class="bg-orange-500 shadow-[10px_10px_0px_#000] w-full justify-self-end h-full font-bold border rounded border-bg-light grid grid-rows-[1fr_auto] min-h-0"
        messages={messages()}
        addMessage={addMessage}
        isActivePlayer={activePlayerId() === useUserContext()?.id.value()}
      />
    </div>
  );
}
export default GameRoom;

type GameRoomProps = {
  connection: Accessor<WebSocket | undefined>;
  playerList: Player[];
  canvasInputData: Accessor<ArrayBuffer | null>;
  canvasStateData: Accessor<ArrayBuffer | null>;
  undoSignal: Accessor<number>;
  colorSignal: Accessor<string>;
  messages: Accessor<Message[]>;
  widthSignal: Accessor<number>;
  addMessage: (message: string) => void;
  activePlayerId: Accessor<number>;
  wordOptions: Accessor<string[]>;
  selectedWord: Accessor<string>;
  acceptWord: (index: number) => void;
  roundTime: Accessor<number>;
  roundNumber: Accessor<number>;
  currentRound: Accessor<number>;
};

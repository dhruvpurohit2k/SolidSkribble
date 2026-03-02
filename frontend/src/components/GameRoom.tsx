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
import ChatBox from "./ChatBoxt";
import ToolBox from "./ToolBox";
import { Canvas, Message, MouseEventType, Stroke } from "../utils/types";
import { useUserContext } from "../context/UserContext";
import { sleep } from "../utils/sleep";

function GameRoom({
  canvasStateData,
  canvasInputData,
  widthSignal,
  wordOptions,
  playerList,
  colorSignal,
  connection,
  undoSignal,
  messages,
  activePlayerId,
  addMessage,
}: GameRoomProps) {
  const strokes: Stroke[] = [];
  const [currentColor, setCurrentColor] = createSignal<string>("#000000");
  const [timerWidth, setTimerWidth] = createSignal<number>(100);
  const [currentWidth, setCurrentWidth] = createSignal<number>(2);
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
        await sleep(15000);
        setWordSelection(false);
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
    <div class="mx-auto items-start grid p-5 grid-rows-[1fr_4fr_4fr] lg:grid-rows-[1fr_12fr] grid-cols-1 lg:grid-cols-[10fr_3fr] gap-2 h-full">
      <div class="bg-bg font-bold border p-1 flex items-start lg:col-span-2 rounded shadow border-bg-light text-text-muted gap-1">
        <For each={playerList()}>
          {(player) => (
            <div
              class={[
                "bg-bg-light flex flex-col p-2 items-center rounded",
                player.id === activePlayerId()
                  ? "border-2 border-amber-300"
                  : "",
              ].join(" ")}
            >
              <p>{player.name}</p>
              <p>{player.points}</p>
            </div>
          )}
        </For>
      </div>
      <div class="relative col-start-1 flex flex-col gap-2 ">
        <Show when={wordSelection()} fallback={<></>}>
          <div class="absolute flex flex-col gap-10 top-[50%] right-[50%] py-5 translate-x-[50%] -translate-y-[50%] w-full bg-bg-dark/90 backdrop-blur-lg ">
            <div
              class="absolute bg-yellow-500 top-0 h-1"
              style={{ width: `${timerWidth()}%` }}
            ></div>
            <p class="text-text text-center text-3xl">Choose</p>
            <div class="flex items-center justify-center gap-20">
              <For each={wordOptions()}>
                {(word) => (
                  <p class="text-text px-10 py-5 bg-bg-light/50 hover:bg-bg-dark rounded duration-150">
                    {word}
                  </p>
                )}
              </For>
            </div>
          </div>
        </Show>
        <canvas
          ref={canvasRef}
          class={[
            "bg-white w-full rounded cursor-default border-bg-dark border ",
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
            class="bg-bg gap-10 items-center border border-bg-light text-text-muted font-bold py-2 px-5 flex"
            colorSetter={colorSetter}
            undoHandler={undo}
            widthSetter={widthSetter}
            currentColor={currentColor}
            currentWidth={currentWidth}
          />
        </Show>
      </div>
      <ChatBox
        class="bg-bg w-full justify-self-end text-text-muted h-full font-bold border rounded shadow border-bg-light grid grid-rows-[1fr_auto] min-h-0"
        messages={messages()}
        addMessage={addMessage}
      />
    </div>
  );
}
export default GameRoom;

type GameRoomProps = {
  connection: Accessor<WebSocket | undefined>;
  playerList: Accessor<Player[]>;
  canvasInputData: Accessor<ArrayBuffer | null>;
  canvasStateData: Accessor<ArrayBuffer | null>;
  undoSignal: Accessor<number>;
  colorSignal: Accessor<string>;
  messages: Accessor<Message[]>;
  widthSignal: Accessor<number>;
  addMessage: (message: string) => void;
  activePlayerId: Accessor<number>;
  wordOptions: Accessor<string[]>;
};

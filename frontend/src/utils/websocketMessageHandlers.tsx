import { Accessor, Setter } from "solid-js";
import { Score, type Player } from "./types";
import { Canvas, Stroke } from "../utils/types";
import { useUserContext } from "../context/UserContext";
import { Notification } from "./types";

const decoder = new TextDecoder("utf-8");
export function updatePlayers(
  data: ArrayBuffer,
  setter: Setter<Player[]>,
  username: string,
  setId: Setter<number>,
) {
  const jsonBuffer = data.slice(1);
  const jsonString = decoder.decode(jsonBuffer);
  const players = JSON.parse(jsonString) as Player[];
  for (const player of players) {
    if (username === player.name) {
      setId(player.id);
    }
  }
  setter(players);
}
export function setCanvasState(
  payload: ArrayBuffer,
  canvas: Canvas,
  redraw: () => void,
  setCurrentColor: Setter<string>,
  setCurrentWidth: Setter<number>,
) {
  const jsonBuffer = payload.slice(1);
  const jsonString = decoder.decode(jsonBuffer);
  const data = JSON.parse(jsonString) as Canvas;
  setCurrentColor(data.currentColor);
  setCurrentWidth(data.currentWidth);
  canvas.currentColor = data.currentColor;
  canvas.currentWidth = data.currentWidth;
  data.strokes.forEach((stroke) => {
    canvas.strokes.push({
      coordinates: stroke.coordinates,
      color: stroke.color,
      strokeWidth: stroke.strokeWidth,
    });
  });
  redraw();
}
export function recieveUndo(canvas: Canvas, redraw: () => void) {
  if (canvas.strokes.length == 0) return;
  canvas.strokes.pop();
  redraw();
}
export function recieveCanvasInput(
  payload: ArrayBuffer,
  canvas: Canvas,
  ctx: CanvasRenderingContext2D | null,
) {
  if (ctx == null) return;
  const view = new DataView(payload);
  const mouseEvent = view.getUint8(1);
  const x = view.getUint16(2, false);
  const y = view.getUint16(4, false);
  switch (mouseEvent) {
    case 0:
      ctx.lineWidth = canvas.currentWidth;
      ctx.strokeStyle = canvas.currentColor;
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvas.strokes.push({
        coordinates: [[x, y]],
        color: canvas.currentColor,
        strokeWidth: canvas.currentWidth,
      });
      break;
    case 1:
      ctx.lineWidth = canvas.currentWidth;
      ctx.strokeStyle = canvas.currentColor;
      ctx.lineTo(x, y);
      ctx.stroke();
      canvas.strokes.at(-1)!.coordinates.push([x, y]);
      break;
    case 2:
      ctx.closePath();
    default:
      break;
  }
}
export function recieveNotification(
  payload: ArrayBuffer,
  notificationQueueSetter: Setter<Notification[]>,
) {
  const notification = JSON.parse(
    decoder.decode(payload.slice(1)),
  ) as Notification;
  console.log(notification);
  notificationQueueSetter((oldNoti) => [...oldNoti, notification]);
}
export function recieveColor(
  color: string,
  canvas: Canvas,
  changeCurrentColor: Setter<string>,
) {
  changeCurrentColor(color);
  canvas.currentColor = color;
}

export function recieveStrokeWidth(
  width: number,
  canvas: Canvas,
  changeCurrentWidth: Setter<number>,
) {
  canvas.currentWidth = width;
  changeCurrentWidth(width);
}
export function recieveWords(
  payload: ArrayBuffer,
  setWordOptions: Setter<string[]>,
) {
  const jsonString = decoder.decode(payload);
  const { words } = JSON.parse(jsonString) as { words: string[] };
  setWordOptions(words);
}

export function recieveScoreBoard(
  payload: ArrayBuffer,
  scoreBoard: Setter<Score[]>,
  showBoard: Setter<boolean>,
) {
  const scores = JSON.parse(decoder.decode(payload.slice(1))) as Score[];
  console.log(scores);
  scoreBoard(scores);
  showBoard(true);
  setTimeout(() => {
    showBoard(false);
  }, 2500);
  // console.log("GOT SCORES -> ", scores);
}

export function recieveRoundTime(
  payload: ArrayBuffer,
  setRoundTime: Setter<number>,
) {
  const dataview = new DataView(payload);
  setRoundTime(dataview.getUint8(1));
}

export function startRound(
  roundTime: Accessor<number>,
  setRoundTime: Setter<number>,
) {
  const interval = setInterval(() => {
    setRoundTime((time) => {
      if (time <= 0) return 0;
      return time - 1;
    });
  }, 1000);
  setTimeout(() => {
    clearInterval(interval);
  }, roundTime() * 1000);
}
export function recieveNumberOfRounds(
  payload: ArrayBuffer,
  setNumRounds: Setter<number>,
) {
  const view = new DataView(payload);
  setNumRounds(view.getUint8(1));
}
export function payloadHandler(data: any) {}

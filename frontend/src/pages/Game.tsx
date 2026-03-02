import { createEffect, createSignal, on, Setter, Show } from "solid-js";
import GameRoom from "../components/GameRoom";
import Lobby from "../components/Lobby";
import { onMount } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { UserContext, useUserContext } from "../context/UserContext";
import {
  recieveNotification,
  updatePlayers,
} from "../utils/websocketMessageHandlers";
import { WebSocketMessageType } from "../utils/websocketMessageType";
import { Message, Player } from "../utils/types";
import { Notification } from "../utils/types";
function Game() {
  const params = useParams();
  const navigate = useNavigate();
  const userContext = useUserContext();
  const [gameStarted, setGameStarted] = createSignal<boolean>(false);
  const [players, setPlayers] = createSignal<Player[]>([]);
  const [connection, setConnection] = createSignal<WebSocket>();
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [showNotificaiton, setShowNotification] = createSignal<boolean>(false);
  const [canvasInputData, setCanvasInputData] =
    createSignal<ArrayBuffer | null>(null);
  const [canvasStateData, setCanvasStateData] =
    createSignal<ArrayBuffer | null>(null);
  const [undoSignal, setUndoSignal] = createSignal<number>(0);
  const [colorSignal, setColorSignal] = createSignal<string>("#000000");
  const [widthSignal, setWidthSignal] = createSignal<number>(1);
  const [leaderId, setLeaderId] = createSignal<number>(0);
  const [activePlayerId, setActivePlayerId] = createSignal<number>(0);
  const [notification, setNotification] = createSignal<Notification | null>(
    null,
  );
  const decoder = new TextDecoder("utf-8");

  createEffect(
    on(
      notification,
      () => {
        setShowNotification(true);
        setTimeout(() => {
          setShowNotification(false);
        }, 3000);
      },
      { defer: true },
    ),
  );

  onMount(async () => {
    const conn = new WebSocket(`ws://localhost:5000/game/${params.id}`);
    conn.binaryType = "arraybuffer";
    conn.onopen = (_) => {
      conn.send(userContext!.username.value());
    };
    conn.onmessage = (ev) => {
      const payload = ev.data as ArrayBuffer;
      const payloadView = new DataView(payload);
      const payloadType = payloadView.getUint8(0) as WebSocketMessageType;
      switch (payloadType) {
        case WebSocketMessageType.GAMESTATE:
          console.log("GOT GAME STARTED PAYLOAD");
          if (payloadView.getUint8(1) === 1) {
            setGameStarted(true);
          }
          break;
        case WebSocketMessageType.PLAYERUPDATE:
          updatePlayers(
            payload,
            setPlayers,
            userContext!.username.value(),
            userContext!.id.set,
          );
          break;
        case WebSocketMessageType.CANVASINPUT:
          setCanvasInputData(payload);
          break;
        case WebSocketMessageType.CANVASSTATE:
          setCanvasStateData(payload);
          break;
        case WebSocketMessageType.CANVASUNDO:
          setUndoSignal((undoSignal) => undoSignal + 1);
          break;
        case WebSocketMessageType.STROKECOLOR:
          const { color } = JSON.parse(decoder.decode(payload.slice(1))) as {
            color: string;
          };
          setColorSignal(color);
          break;

        case WebSocketMessageType.MESSAGEINPUT:
          const message = JSON.parse(
            decoder.decode(payload.slice(1)),
          ) as Message;
          setMessages((oldMessage) => [...oldMessage, message]);
          break;
        case WebSocketMessageType.STROKEWIDTH:
          const width = JSON.parse(decoder.decode(payload.slice(1))) as {
            width: number;
          };
          setWidthSignal(width.width);
          break;
        case WebSocketMessageType.LEADERCHANGE:
          const newLeaderId = payloadView.getUint8(1);
          setLeaderId(newLeaderId);
          console.log("LeaderSet TO ", newLeaderId);
          break;
        case WebSocketMessageType.ACTIVEPLAYERCHANGE:
          const newActivePlayerId = payloadView.getUint8(1);
          setActivePlayerId(newActivePlayerId);
          console.log("ActivePlayer set  TO ", newActivePlayerId);
          break;
        case WebSocketMessageType.NOTIFICATION:
          recieveNotification(payload, setNotification);
          break;
        default:
          alert("NOT IMPLEMENTED PAYLOADTYPE " + payloadType);
      }
    };
    conn.onerror = () => {
      navigate("/", { replace: true });
    };
    setConnection(conn);
  });
  function addMessage(message: string) {
    setMessages((oldMessages) => [
      ...oldMessages,
      { senderName: userContext?.username.value()!, content: message },
    ]);
    const jsonString = JSON.stringify({
      senderName: userContext?.username.value()!,
      content: message,
    });
    const encoder = new TextEncoder();
    const encodedString = encoder.encode(jsonString);
    const buffer = new ArrayBuffer(encodedString.length + 1);
    const view = new Uint8Array(buffer);
    view[0] = WebSocketMessageType.MESSAGEINPUT;
    view.set(encodedString, 1);
    connection()?.send(buffer);
  }
  return (
    <>
      <Show when={showNotificaiton()}>
        <div
          id="notification"
          class="absolute bg-bg-dark border border-highlight p-10 text-text right-10 top-20 max-w-[80%] animate-[notification-animation_500ms_ease-in-out]"
        >
          <p class="text-text text-xl">{notification()?.heading}</p>
          <p class="text-text text-2xl">{notification()?.content}</p>
        </div>
      </Show>
      <Show
        when={gameStarted()}
        fallback={
          <Lobby playerList={players} conn={connection} leaderId={leaderId} />
        }
      >
        {
          <GameRoom
            playerList={players}
            connection={connection}
            canvasInputData={canvasInputData}
            canvasStateData={canvasStateData}
            undoSignal={undoSignal}
            colorSignal={colorSignal}
            addMessage={addMessage}
            messages={messages}
            widthSignal={widthSignal}
            activePlayerId={activePlayerId}
          />
        }
      </Show>
    </>
  );
}

export default Game;

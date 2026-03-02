import { createEffect, createSignal, on, Setter, Show } from "solid-js";
import GameRoom from "../components/GameRoom";
import Lobby from "../components/Lobby";
import { onMount } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { UserContext, useUserContext } from "../context/UserContext";
import {
  recieveNotification,
  recieveWords,
  updatePlayers,
} from "../utils/websocketMessageHandlers";
import { WebSocketMessageType } from "../utils/websocketMessageType";
import { Message, Player } from "../utils/types";
import { Notification } from "../utils/types";
import { sleep } from "../utils/sleep";
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
  const [notificationQueue, setNotificationQueue] = createSignal<
    Notification[]
  >([]);
  const [wordOptions, setWordOptions] = createSignal<string[]>([]);
  const decoder = new TextDecoder("utf-8");

  createEffect(
    on(
      notificationQueue,
      async () => {
        if (showNotificaiton()) return;
        setShowNotification(true);
        let noti: Notification;
        let count = 0;
        while (notificationQueue().length > 0) {
          noti = notificationQueue()[0];
          setNotification(noti);
          await sleep(4000);
          setNotificationQueue((prevQueue) => prevQueue.slice(1));
          count++;
        }
        setShowNotification(false);
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
          recieveNotification(payload, setNotificationQueue);
          break;
        case WebSocketMessageType.WORDSELECTION:
          recieveWords(payload, setWordOptions);
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
          class="z-10 flex flex-col absolute bg-bg-dark/10 backdrop-blur-3xl text-text right-[50%] top-[50%] -translate-y-[50%] h-dvh w-dvw translate-x-[50%] animate-[notification-animation_4s_ease-in-out]"
        >
          <div class="mx-auto my-auto bg-bg-dark/80 w-full *:text-center p-10">
            {/*<p class="text-text text-xl">TEST NOTI</p>
            <p class="text-text text-2xl">TEST NOTI</p>*/}
            <p class="text-text text-xl">{notification()?.heading}</p>
            <p class="text-2xl text-yellow-500">{notification()?.content}</p>
          </div>
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
            wordOptions={wordOptions}
          />
        }
      </Show>
    </>
  );
}

export default Game;

import { createEffect, createSignal, For, on, Setter, Show } from "solid-js";
import GameRoom from "../components/GameRoom";
import Lobby from "../components/Lobby";
import { onMount } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { UserContext, useUserContext } from "../context/UserContext";
import {
  increaseCurrentRound,
  recieveGuessWord,
  recieveNotification,
  recieveNumberOfRounds,
  recieveRoundTime,
  recieveScoreBoard,
  recieveWords,
  startRound,
  updatePlayers,
} from "../utils/websocketMessageHandlers";
import { WebSocketMessageType } from "../utils/websocketMessageType";
import { Message, Player, Score } from "../utils/types";
import { Notification } from "../utils/types";
import { sleep } from "../utils/sleep";
import { onCleanup } from "solid-js";
import ScoreBoard from "../components/ScoreBoard";
import NotificationComponenet from "../components/Notification";
import { createStore } from "solid-js/store";
function Game() {
  const [roundTime, setRoundTime] = createSignal<number>(60);
  const params = useParams();
  const navigate = useNavigate();
  const userContext = useUserContext();
  const [gameStarted, setGameStarted] = createSignal<boolean>(false);
  const [players, setPlayers] = createStore<Player[]>([]);
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
  const [numRounds, setNumRounds] = createSignal<number>(3);
  const [currentRound, setCurrentRound] = createSignal<number>(1);
  const [scoreBoard, setScoreBoard] = createSignal<Score[]>([]);
  const [showScoreBoard, setShowScoreBoard] = createSignal<boolean>(false);
  const [notificationQueue, setNotificationQueue] = createSignal<
    Notification[]
  >([]);
  const [wordOptions, setWordOptions] = createSignal<string[]>([]);
  const [selectedWord, setSelectWord] = createSignal<string>("");
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
          await sleep(3000);
          setNotificationQueue((prevQueue) => prevQueue.slice(1));
          count++;
          await sleep(1000);
        }
        setShowNotification(false);
      },
      { defer: true },
    ),
  );

  onMount(async () => {
    const conn = new WebSocket(`ws://localhost:5000/game/${params.id}`);
    conn.binaryType = "arraybuffer";
    conn.onopen = (_) => {};
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
        case WebSocketMessageType.REQUESTTOKEN:
          connection()?.send(userContext?.token.value()!);
          break;
        case WebSocketMessageType.REQUESTUSERNAME:
          connection()?.send(userContext?.username.value()!);
          break;
        case WebSocketMessageType.SERVERDENIED:
          console.log("SERVER ERROR");
          break;
        case WebSocketMessageType.SCOREBOARD:
          recieveScoreBoard(
            payload,
            setScoreBoard,
            setShowScoreBoard,
            setPlayers,
          );
          break;
        case WebSocketMessageType.ROUNDTIMESELECTION:
          recieveRoundTime(payload, setRoundTime);
          break;
        case WebSocketMessageType.ROUNDSTARTSIGNAL:
          startRound(roundTime, setRoundTime);
          break;
        case WebSocketMessageType.ROUNDCOUNT:
          recieveNumberOfRounds(payload, setNumRounds);
          break;
        case WebSocketMessageType.GUESSWORD:
          recieveGuessWord(payload, setSelectWord);
          break;
        case WebSocketMessageType.INCREASEROUNDCOUNT:
          increaseCurrentRound(setCurrentRound);
          break;
        default:
          alert("NOT IMPLEMENTED PAYLOADTYPE " + payloadType);
      }
    };
    conn.onerror = () => {
      navigate("/", { replace: true });
    };
    setConnection(conn);
    onCleanup(() => {
      if (
        conn.OPEN === WebSocket.OPEN ||
        conn.readyState === WebSocket.CONNECTING
      ) {
        conn.close();
      }
    });
  });
  function addMessage(message: string) {
    // setMessages((oldMessages) => [
    //   ...oldMessages,
    //   { senderName: userContext?.username.value()!, content: message },
    // ]);
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
  function acceptWord(index: number) {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setUint8(0, WebSocketMessageType.WORDSELECTION);
    view.setUint8(1, index);
    console.log(index);
    connection()!.send(buffer);
  }
  return (
    <div class="overflow-x-hidden h-full flex flex-col">
      <Show when={showNotificaiton()}>
        <NotificationComponenet
          passedClass="z-100 flex flex-col absolute bg-red-700 right-[50%] top-[50%] -translate-y-[50%] shadow-[10px_10px_0px_#000] px-10 py-5 rounded-xl translate-x-[50%] animate-[notification-animation_4s_ease-in-out] border border-black"
          notification={notification}
        />
      </Show>
      <Show when={showScoreBoard()}>
        <ScoreBoard
          passedClass="flex flex-col gap-5 items-center absolute p-10 bg-yellow-500 right-[50%] top-[50%] -translate-y-[50%] translate-x-[50%] z-100 shadow-[20px_20px_0px_#000] after:border-30 p-20 rounded-xl after:rounded-xl  after:border-teal-500 after:content-[' '] after:h-full after:w-full after:absolute after:top-0 after:left-0 after:scale-100 animate-[roll-in_500ms_ease-in-out]"
          ScoreBoard={scoreBoard}
        />
      </Show>
      <Show
        when={gameStarted()}
        fallback={
          <Lobby
            playerList={players}
            conn={connection}
            leaderId={leaderId}
            roundTime={roundTime}
            setRoundTime={setRoundTime}
            numRounds={numRounds}
            setNumRounds={setNumRounds}
          />
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
            selectedWord={selectedWord}
            acceptWord={acceptWord}
            roundTime={roundTime}
            roundNumber={numRounds}
            currentRound={currentRound}
          />
        }
      </Show>
    </div>
  );
}

export default Game;

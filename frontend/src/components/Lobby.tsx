import { Accessor, createSignal, For, Setter, Show } from "solid-js";
import { useUserContext } from "../context/UserContext";
import { Player } from "../utils/types";
import { WebSocketMessageType } from "../utils/websocketMessageType";
import { useNavigate } from "@solidjs/router";
function Lobby({
  playerList,
  conn,
  leaderId,
  roundTime,
  setRoundTime,
  numRounds,
  setNumRounds,
}: GameDataProps) {
  const userContext = useUserContext();
  const navigator = useNavigate();
  return (
    <div class="my-auto mx-auto relative gap-10 bg-yellow-400 p-10 rounded *:text-text-muted flex flex-col lg:flex-row w-[clamp(240px,50%,1000px)] shadow-[50px_40px_0px_10px_#000] after:content-[' '] after:h-full after:w-full after:scale-95 after:border-4 after:border-yellow-200 after:absolute after:top-0 after:left-0 after:rounded *:z-10 animate-[right-slide-in_1s_ease-in-out] duration-150ms relative">
      <div class="flex flex-col max-h-100 ">
        <p class="text-center font-bold text-3xl mb-10 font-mono">
          PLAYERS IN THE LOBBY
        </p>
        <div class="flex flex-col items-center px-5 p-2 gap-2 corner-scoop rounded-[20px]">
          <For each={playerList} fallback={<></>}>
            {(player, i) => (
              <div
                class={[
                  "flex px-10 py-2 items-center justify-between w-full corner-scoop rounded-xl shadow-[10px_10px_0px_#000] animate-[right-slide-in_1s_cubic-bezier(0.175,0.885,0.32,1.075)_both]",
                  player.inActive
                    ? "bg-neutral-800 *:text-white"
                    : " bg-red-700",
                ].join(" ")}
                style={{ "animation-delay": `${i() + 1}s` }}
              >
                <p class="text-xl font-marker text-yellow-100 font-bold">
                  {player.name}
                </p>
                {player.id == leaderId() && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={24}
                    height={24}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FFD800"
                    stroke-width={2}
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="ml-auto icon icon-tabler icons-tabler-outline icon-tabler-crown"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4l4 -6" />
                  </svg>
                )}
              </div>
            )}
          </For>
        </div>
      </div>
      <Show
        when={userContext?.id.value() === leaderId()}
        fallback={
          <div class="flex items-center justify-center ">
            <p class="text-text-muted text-xl font-bold w-[max(20%,30ch)]">
              Waiting for the Leader to start the Game
            </p>
          </div>
        }
      >
        <div class="my-auto flex flex-1 flex-col gap-5">
          <p class="text-3xl font-mono font-bold text-center">GAME SETTINGS</p>
          <div class="self-center">
            <p class="font-bold font-mono text-xl text-center">ROUND TIME</p>
            <div class="flex gap-2 items-center justify-center ">
              <button
                class="bg-orange-500 shadow-[10px_10px_0px_#000] hover:bg-orange-700 text-orange-100 hover:scale-95 hover:shadow-none py-1 px-4 font-bold bg-bg-light rounded text-xl active:bg-bg-dark duration-150"
                onClick={() =>
                  setRoundTime((rt) => {
                    if (rt == 15) return 15;
                    else return rt - 15;
                  })
                }
              >
                -
              </button>
              <p class="p-1 text-center flex-1 font-bold rounded min-w-[7ch] text-4xl font-mono">
                {roundTime() + " sec"}
              </p>
              <button
                class="bg-orange-500 shadow-[10px_10px_0px_#000] hover:bg-orange-700 hover:scale-95 text-orange-100 hover:shadow-none py-1 px-3 font-bold bg-bg-light rounded text-xl active:bg-bg-dark duration-150"
                onClick={() =>
                  setRoundTime((rt) => {
                    if (rt == 180) return 180;
                    else return rt + 15;
                  })
                }
              >
                +
              </button>
            </div>
          </div>
          <div class="self-center">
            <p class="font-bold font-mono text-xl text-center">
              NUMBER OF ROUNDS
            </p>
            <div class="flex gap-2 items-center justify-center ">
              <button
                class="bg-orange-500 shadow-[10px_10px_0px_#000] text-orange-100  hover:bg-orange-700 hover:scale-95 hover:shadow-none py-1 px-4 font-bold bg-bg-light rounded text-xl active:bg-bg-dark duration-150"
                onClick={() =>
                  setNumRounds((rt) => {
                    if (rt == 1) return 1;
                    else return rt - 1;
                  })
                }
              >
                -
              </button>
              <p class="p-1 text-center flex-1 font-bold rounded min-w-[7ch] text-4xl font-mono">
                {numRounds() + " Rounds"}
              </p>
              <button
                class="bg-orange-500 shadow-[10px_10px_0px_#000] text-orange-100 hover:bg-orange-700 hover:scale-95 hover:shadow-none py-1 px-3 font-bold bg-bg-light rounded text-xl active:bg-bg-dark duration-150"
                onClick={() =>
                  setNumRounds((rt) => {
                    if (rt == 6) return 6;
                    else return rt + 1;
                  })
                }
              >
                +
              </button>
            </div>
          </div>
          <button
            class="shadow-[10px_10px_0px_#000] hover:scale-95 hover:shadow-none font-bold bg-orange-500 text-orange-100 hover:bg-orange-700 text-xl duration-150 p-2 rounded mx-auto"
            onClick={() => {
              let buffer = new ArrayBuffer(2);
              let view = new DataView(buffer);
              view.setUint8(0, WebSocketMessageType.ROUNDTIMESELECTION);
              view.setUint8(1, roundTime());
              conn()?.send(buffer);
              buffer = new ArrayBuffer(2);
              view = new DataView(buffer);
              view.setUint8(0, WebSocketMessageType.ROUNDCOUNT);
              view.setUint8(1, numRounds());
              conn()?.send(buffer);
              buffer = new ArrayBuffer(2);
              view = new DataView(buffer);
              view.setUint8(0, 0);
              view.setUint8(1, 1);
              conn()?.send(buffer);
            }}
          >
            START
          </button>
        </div>
      </Show>
      <button
        class="absolute -bottom-25 rounded right-0 bg-orange-500 text-orange-100 font-bold text-xl px-5 py-2 shadow-[10px_10px_0px_#000] hover:scale-95 hover:bg-orange-700 hover:shadow-none duration-150"
        onClick={() => {
          navigator("/", { replace: true });
        }}
      >
        BACK
      </button>
    </div>
  );
}

export default Lobby;

type GameDataProps = {
  conn: Accessor<WebSocket | undefined>;
  playerList: Player[];
  leaderId: Accessor<number>;
  roundTime: Accessor<number>;
  setRoundTime: Setter<number>;
  numRounds: Accessor<number>;
  setNumRounds: Setter<number>;
};

import { Accessor, createSignal, For, Show } from "solid-js";
import { useUserContext } from "../context/UserContext";
import { Player } from "../utils/types";
function Lobby({ playerList, conn, leaderId }: GameDataProps) {
  const [roundTime, setRoundTime] = createSignal<number>(60);
  const userContext = useUserContext();
  return (
    <div class=" my-auto mx-auto gap-10 bg-bg p-5 rounded *:text-text-muted flex flex-col lg:flex-row w-[clamp(240px,50%,1000px)]">
      <div class="flex flex-col max-h-100 flex-1 overflow-y-scroll">
        <p class="text-center font-bold text-2xl mb-10">Players in the Lobby</p>
        <div class="flex flex-col gap-5 items-center ">
          <For each={playerList()} fallback={<></>}>
            {(player) => (
              <div class="flex bg-bg-light w-[50%] rounded p-2">
                <p class="text-xl font-bold">{player.name}</p>
                {player.id == leaderId() && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={24}
                    height={24}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FFD700"
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
          <p class="text-text-xl font-bold text-center">GAME SETTINGS</p>
          <div>
            <p class="font-bold">ROUND TIME</p>
            <div class="flex gap-3 items-center justify-center">
              <button
                class="py-1 px-4 font-bold bg-bg-light rounded text-xl active:bg-bg-dark duration-150"
                onClick={() =>
                  setRoundTime((rt) => {
                    if (rt == 15) return 15;
                    else return rt - 15;
                  })
                }
              >
                -
              </button>
              <p class="p-1 text-center flex-1 font-bold rounded min-w-[7ch] text-2xl">
                {roundTime() + " sec"}
              </p>
              <button
                class="py-1 px-3 font-bold bg-bg-light rounded text-xl active:bg-bg-dark duration-150"
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
          <button
            class="font-bold text-xl bg-bg-light hover:bg-bg-dark duration-150 mt-5 p-2 rounded mx-auto"
            onClick={() => {
              const buffer = new ArrayBuffer(2);
              const view = new DataView(buffer);
              view.setUint8(0, 0);
              view.setUint8(1, 1);
              conn()?.send(buffer);
            }}
          >
            START
          </button>
        </div>
      </Show>
    </div>
  );
}

export default Lobby;

type GameDataProps = {
  conn: Accessor<WebSocket | undefined>;
  playerList: Accessor<Player[]>;
  leaderId: Accessor<number>;
};

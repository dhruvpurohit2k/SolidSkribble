import { createSignal, For } from "solid-js";
import { Player } from "../utils/types";
import { Navigate, useNavigate } from "@solidjs/router";

function EndScreen({ players }: EndScreenProps) {
  const [sortedPlayer, setSortedPlayer] = createSignal<Player[]>([]);
  const nav = useNavigate();
  setSortedPlayer(players.sort((a, b) => a.points - b.points));
  return (
    <div
      class="bg-yellow-400 z-10 translate-x-1/2 -translate-y-1/2 *:z-100 p-10 absolute top-[50%] right-[50%] shadow-[10px_10px_0px_#000] border border-black rounded
after:content-[' '] after:h-full after:w-full after:scale-95 after:border-5 after:border-yellow-200 after:absolute after:top-0 after:left-0 after:rounded
     flex flex-col gap-10"
    >
      <p class="font-mono font-bold text-4xl">RESULTS</p>
      <For each={sortedPlayer()}>
        {(player) => (
          <div class="flex *:text-3xl">
            <p class="font-marker text-black">{player.name}</p>
            <p class="ml-auto font-marker text-orange-700">{player.points}</p>
          </div>
        )}
      </For>
      <button
        class="px-2 py-1 shadow-[10px_10px_0px_#000] hover:shadow-none hover:scale-95 bg-orange-500 hover:bg-orange-700 self-center mt-auto duration-150 rounded"
        onClick={() => {
          nav("/", { replace: true });
        }}
      >
        Return
      </button>
    </div>
  );
}

export default EndScreen;

type EndScreenProps = {
  players: Player[];
};

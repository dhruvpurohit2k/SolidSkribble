import { Accessor, For } from "solid-js";
import { Player } from "../utils/types";

function ScoreBoard({ passedClass, players }: ScoreBoardProps) {
  return (
    <div class={passedClass}>
      <p class="text-6xl text-red-600 font-laquer">SCORE</p>
      <div>
        <For each={players()}>
          {(player) => (
            <div class="*:text-3xl flex gap-1">
              <p class="font-marker">{player.name} : </p>
              <p class="text-green-700 font-marker"> + {player.points}</p>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
export default ScoreBoard;
type ScoreBoardProps = {
  players: Accessor<Player[]>;
  passedClass: string;
};

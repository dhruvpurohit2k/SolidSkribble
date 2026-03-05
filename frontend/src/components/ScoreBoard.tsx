import { Accessor, For } from "solid-js";
import { Player, Score } from "../utils/types";

function ScoreBoard({ passedClass, ScoreBoard }: ScoreBoardProps) {
  return (
    <div class={passedClass}>
      <p class="text-6xl text-red-600 font-laquer">SCORE</p>
      <div>
        <For each={ScoreBoard()}>
          {(player) => (
            <div class="*:text-3xl flex gap-1">
              <p class="font-marker">{player.playerName} : </p>
              <p class="text-green-700 font-marker"> + {player.pointsAdded}</p>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
export default ScoreBoard;
type ScoreBoardProps = {
  ScoreBoard: Accessor<Score[]>;
  passedClass: string;
};

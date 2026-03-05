import { Accessor, For, Setter } from "solid-js";

function WordSelection({
  wordOptions,
  timerWidth,
  setWordIndex,
  wordIndex,
  setWordSelected,
  acceptWord,
  setWordSelection,
}: WordSelectionProps) {
  return (
    <div class="z-200 absolute flex flex-col gap-10 top-[50%] right-[50%] py-10 translate-x-[50%] -translate-y-[50%] w-[80%] bg-yellow-500 shadow-[10px_10px_0px_#000] border-4 border-orange-700 max-w-250">
      <div
        class="absolute bg-orange-500 top-2 h-2 scale-95 shadow-[5px_5px_0px_#000] rounded-xl"
        style={{ width: `${timerWidth()}%` }}
      ></div>
      <p class="self-center font-mono font-bold  border-b-black text-center text-9xl p-5 ">
        CHOOSE
      </p>
      <div class="flex self-center items-center justify-center gap-20 p-10">
        <For each={wordOptions()}>
          {(word, index) => (
            <button
              class={[
                "text-text px-10 py-5  shadow-[10px_10px_0px_#000] hover:shadow-none hover:scale-95 hover:bg-orange-700 rounded duration-150",
                index() == wordIndex() ? "bg-orange-400" : "bg-orange-500",
              ].join(" ")}
              onClick={(e) => {
                setWordSelected(true);
                setWordIndex(index);
                acceptWord(wordIndex());
                setWordSelection(false);
              }}
            >
              {word}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
export default WordSelection;
type WordSelectionProps = {
  wordOptions: Accessor<string[]>;
  timerWidth: Accessor<number>;
  wordIndex: Accessor<number>;
  setWordIndex: Setter<number>;
  setWordSelected: Setter<boolean>;
  setWordSelection: Setter<boolean>;
  acceptWord: (index: number) => void;
};

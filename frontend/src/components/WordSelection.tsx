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
    <div class="z-200 rounded-xl absolute flex flex-col gap-10 top-[50%] right-[50%] py-10 translate-x-[50%] -translate-y-[50%] max-w-[60%] bg-yellow-400 shadow-[10px_10px_0px_#000] after:content-[' '] after:h-full after:w-full after:scale-97 after:border-3 after:border-yellow-200 after:absolute after:top-0 after:left-0 after:rounded-xl max-w-250 *:z-10">
      <div
        class="absolute bg-orange-500 top-5 h-2 scale-95 shadow-[5px_5px_0px_#000] rounded-xl"
        style={{ width: `${timerWidth()}%` }}
      ></div>
      <p class="self-center font-marker font-bold  border-b-black text-center text-9xl p-5 ">
        CHOOSE
      </p>
      <div class="flex self-center items-center justify-center gap-20 p-10">
        <For each={wordOptions()}>
          {(word, index) => (
            <button
              class={[
                "px-10 py-5 font-bold text-xl text-yellow-100 shadow-[10px_10px_0px_#000] hover:shadow-none hover:scale-95 hover:bg-orange-700 rounded duration-150",
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

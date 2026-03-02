import { Accessor, createSignal } from "solid-js";

function ToolBox(props: ToolBoxProps) {
  return (
    <div class={props.class}>
      <input
        type="color"
        value={props.currentColor()}
        onChange={(e) => {
          props.colorSetter(e.target.value);
        }}
      />
      <div class="flex flex-col items-center">
        <input
          type="range"
          min="1"
          max="10"
          value={props.currentWidth()}
          onInput={(e) => {
            props.widthSetter(Number(e.target.value));
          }}
        />
        <p>{props.currentWidth()}</p>
      </div>
      <button
        class="bg-bg border border-highlight hover:bg-bg-light duration-150 ml-auto px-2 py-1 text-lg rounded"
        onClick={() => props.undoHandler()}
      >
        UNDO
      </button>
    </div>
  );
}

export default ToolBox;

type ToolBoxProps = {
  class?: string;
  colorSetter: (color: string) => void;
  undoHandler: () => void;
  widthSetter: (width: number) => void;
  currentColor: Accessor<string>;
  currentWidth: Accessor<number>;
};

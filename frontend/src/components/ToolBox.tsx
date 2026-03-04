import { Accessor, createSignal } from "solid-js";

function ToolBox(props: ToolBoxProps) {
  return (
    <div class={props.class}>
      <input
        type="color"
        value={props.currentColor()}
        class="h-10"
        onChange={(e) => {
          props.colorSetter(e.target.value);
        }}
      />
      <div class="flex gap-10 items-center">
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
        class="duration-150 ml-auto px-2 py-1 text-3xl text-red-500 font-laquer text-shadow-[2px_2px_0px_#000]"
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

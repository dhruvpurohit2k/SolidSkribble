import { createSignal, For, on } from "solid-js";
import { Message } from "../utils/types";
import { createEffect } from "solid-js";

function ChatBox(props: ChatBoxProps) {
  const [msg, setMsg] = createSignal<string>("");
  let msgArea: HTMLDivElement | undefined;
  createEffect(
    on(
      () => props.messages!.length,
      () => {
        if (msgArea) {
          msgArea.scrollTop = msgArea.scrollHeight;
        }
      },
      { defer: true },
    ),
  );
  return (
    <div class={props.class}>
      <div
        class="flex flex-col gap-2 overflow-y-auto px-2 py-1 min-h-0"
        ref={msgArea}
      >
        <For each={props.messages}>
          {(msg) => (
            <div class="">
              <p>{msg.senderName + " : " + msg.content}</p>
            </div>
          )}
        </For>
      </div>
      <input
        class="bg-bg-light w-full py-2 px-1 mt-auto text-lg outline-none"
        placeholder="Enter your guess here"
        value={msg()}
        onInput={(e) => setMsg(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (msg().trim() === "") return;
            props.addMessage(msg());
            setMsg("");
          }
        }}
      />
    </div>
  );
}

export default ChatBox;

type ChatBoxProps = {
  messages?: Message[];
  addMessage: (message: string) => void;
  class?: string;
};

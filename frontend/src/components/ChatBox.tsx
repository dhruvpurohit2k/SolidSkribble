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
        class="flex flex-col gap-1 overflow-y-auto py-5 min-h-0"
        ref={msgArea}
      >
        <For each={props.messages}>
          {(msg) => (
            <div class="animate-[right-slide-in_150ms_ease-in-out_both] font-marker text-yellow-500 text-xl bg-orange-700 p-2 rounded">
              <p>{msg.senderName + " : " + msg.content}</p>
            </div>
          )}
        </For>
      </div>
      <input
        class="bg-yellow-500 rounded w-[calc(100%-16px)] shadow-[5px_5px_1px_#000] mt-auto mx-2 mb-2 py-3 px-2 text-lg outline-none"
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

import { Accessor, createSignal, For, on, Show } from "solid-js";
import { Message } from "../utils/types";
import { createEffect } from "solid-js";
import { useUserContext } from "../context/UserContext";

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
        class="flex flex-col gap-1 overflow-y-auto py-5 px-1 min-h-0"
        ref={msgArea}
      >
        <For each={props.messages}>
          {(msg) => (
            <div class="animate-[right-slide-in_150ms_ease-in-out_both] font-marker text-yellow-300 text-lg p-2 gap-1 rounded flex">
              <Show
                when={msg.isGuess}
                fallback={
                  <>
                    <p class="">{msg.senderName + ":"}</p>
                    <p class="font-mono">{msg.content}</p>
                  </>
                }
              >
                <>
                  <p class="">{msg.senderName}</p>
                  <p class="">GUSSED!!!!</p>
                </>
              </Show>
            </div>
          )}
        </For>
      </div>
      <Show when={!props.isActivePlayer}>
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
      </Show>
    </div>
  );
}

export default ChatBox;

type ChatBoxProps = {
  messages?: Message[];
  addMessage: (message: string) => void;
  class?: string;
  isActivePlayer: boolean;
};

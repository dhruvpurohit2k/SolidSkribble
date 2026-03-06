import { createSignal, Show } from "solid-js";
import { useUserContext } from "../context/UserContext";
import { useNavigate } from "@solidjs/router";
function Login() {
  const [submitted, setSubmitted] = createSignal<boolean>(false);
  const navigate = useNavigate();
  const userContext = useUserContext();
  if (userContext === undefined) return;
  const username = userContext.username.value;
  const [joinLink, setJoinLink] = createSignal<string>("");
  const setUserName = userContext.username.set;
  if (username() !== "") setSubmitted(true);

  async function createNewRoom() {
    // navigate("/game/1", { replace: true });
    try {
      const res = await fetch("http://localhost:5000/createroom", {
        method: "PUT",
      });
      if (!res.ok) {
        throw new Error("Server failed to create new room.");
      }
      const data = await res.json();
      if (data.roomId) {
        navigate(`/game/${data.roomId}`, { replace: true });
      }
    } catch (err) {
      if (err instanceof Error) {
        alert(err);
      }
    }
  }

  return (
    <>
      <Show
        when={username() !== "" && submitted()}
        fallback={
          <div class="flex flex-col justify-center gap-10 lg:gap-20 h-full ">
            <p class="text-9xl animate-[wind-in_1s_ease-in-out] text-shadow-[10px_10px_1px_#000] text-center text-yellow-300 font-bold font-marker">
              Welcome to SolidScribble
            </p>
            <div class="*:z-10 [animation-delay:2s] corner-scoop rounded-[50px] animate-[popup_500ms_ease-in-out_both] shadow-[50px_40px_2px_5px_#000] relative bg-red-600 p-20 after:content-[' '] after:border-5 after:border-yellow-500 after:h-full after:w-full after:absolute after:top-0 after:left-0 after:scale-90 after:corner-scoop after:rounded-[50px] mx-auto p-10 lg:w-[70ch] shadow flex flex-col gap-5 ">
              <p class="text-yellow-300 font-bold text-center text-4xl mb-2 font-mono">
                Enter Username
              </p>
              <input
                type="text"
                value={username()}
                onChange={(e) => setUserName(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSubmitted(true);
                  }
                }}
                placeholder="USERNAME HERE!!"
                class="text-4xl text-center border-b-4 border-b-yellow-600 p-2 rounded font-marker w-full font-bold outline-none  text-yellow-100"
              />
              {/*<button
                class="text-yellow-500 hover:bg-bg-dark hover:text-text duration-150 p-2 rounded mx-auto mt-auto text-text-muted font-bold"
                onClick={() => {
                  if (username() !== undefined) setSubmitted(true);
                }}
              >
                SUBMIT
              </button>*/}
            </div>
          </div>
        }
      >
        <div class="animate-[right-slide-in_1s_ease-in-out_both] bg-yellow-400 shadow-[50px_40px_0px_10px_#000] relative mx-auto my-auto flex py-10 px-20 rounded w-[50%] flex-col gap-5 after:content-[' '] after:h-full after:w-full after:absolute after:border-3 after:border-yellow-200 after:top-0 after:left-0 after:scale-95 *:z-10">
          <div class="flex flex-col gap-1">
            <p class="text-black font-bold text-2xl font-mono">WELCOME</p>
            <p class="animate-[roll-in_1s_ease-in-out_both] [animation-delay:1s] bg-red-600 text-yellow-500 text-7xl text-center self-start py-2 px-5 font-bold font-marker shadow-[10px_10px_0px_#000] after:absolute relative after:scale-95 after:h-full after:w-full after:content-[' '] after:border-2 after:border-yellow-500 after:top-0 after:left-0 corner-scoop after:corner-scoop rounded-xl after:rounded-xl ">
              {username()}
            </p>
          </div>
          <button
            class="absolute hover:animate-pulse hover:scale-150 rounded-tr top-10 right-10 font-mono font-bold text-xs text-red-600 p-1 hover:bg-bg-dark hover:text-text duration-150 cursor-pointer"
            onClick={() => {
              setUserName("");
              setSubmitted(false);
            }}
          >
            Edit Username
          </button>
          <div class="grid grid-rows-3 lg:grid-cols-2 gap-5 mt-10">
            <div class="grid row-span-3 grid-rows-subgrid *:text-text gap-5">
              <p class="font-mono font-bold text-3xl text-center">
                Create New Room
              </p>
              <button
                class="shadow-[10px_10px_0px_#000] hover:shadow-none hover:scale-95 lg:row-start-3 bg-orange-400 text-white font-bold font-mono text-3xl rounded mx-auto p-2 hover:bg-bg-dark duration-150 cursor-pointer hover:bg-orange-800"
                onClick={() => createNewRoom()}
              >
                CREATE
              </button>
            </div>
            <div class="grid grid-rows-subgrid row-span-3 *:text-text gap-5">
              <p class="text-3xl text-center font-bold font-mono ">Join Room</p>
              <input
                type="text"
                value={joinLink()}
                placeholder="ROOM CODE"
                onChange={(e) => setJoinLink(e.target.value)}
                class="bg-yellow-200 text-center rounded w-full outline-none text-lg px-2 py-1 shadow-[10px_10px_0px_#000]"
              />
              <button
                class="font-marker shadow-[10px_10px_0px_#000] hover:shadow-none hover:scale-95 lg:row-start-3 bg-orange-400 text-white font-bold text-3xl rounded mx-auto p-2 hover:bg-bg-dark duration-150 cursor-pointer hover:bg-orange-800"
                onClick={() => {
                  if (joinLink().trim() == "") alert("Enter a room code");
                  navigate(`/game/${joinLink().trim()}`, { replace: true });
                }}
              >
                JOIN
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}

export default Login;

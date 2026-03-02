import { createSignal, Show } from "solid-js";
import { useUserContext } from "../context/UserContext";
import { useNavigate } from "@solidjs/router";
function Login() {
  const [submitted, setSubmitted] = createSignal<boolean>(false);
  const navigate = useNavigate();
  const userContext = useUserContext();
  if (userContext === undefined) return;
  const username = userContext.username.value;
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
          <div class="flex flex-col justify-center gap-10 lg:gap-20 h-full">
            <p class="lg:text-7xl text-5xl text-center text-text">
              Welcome to SolidScribble
            </p>
            <div class="bg-bg mx-auto p-10 lg:w-[70ch] rounded shadow flex flex-col gap-5 ">
              <p class="text-text text-2xl mb-2">Enter Username</p>
              <input
                type="text"
                value={username()}
                onChange={(e) => setUserName(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSubmitted(true);
                  }
                }}
                class="text-lg bg-bg-light p-2 rounded w-full font-bold outline-none text-text"
              />
              <button
                class="bg-bg-light hover:bg-bg-dark hover:text-text duration-150 p-2 rounded mx-auto mt-auto text-text-muted font-bold"
                onClick={() => {
                  if (username() !== undefined) setSubmitted(true);
                }}
              >
                SUBMIT
              </button>
            </div>
          </div>
        }
      >
        <div class="relative mx-auto my-auto bg-bg flex p-10 rounded w-[50%] shadow flex-col gap-5">
          <div class="flex flex-col gap-1">
            <p class="text-text-muted text-lg ">WELCOME</p>
            <p class="text-text text-5xl  font-bold">{username()}</p>
          </div>
          <button
            class="absolute rounded-tr top-0 right-0 text-xs text-text-muted p-1 hover:bg-bg-dark hover:text-text duration-150"
            onClick={() => {
              setUserName("");
              setSubmitted(false);
            }}
          >
            Edit Username
          </button>
          <div class="grid grid-rows-3 grid-cols-2 justify-between gap-5 mt-10">
            <div class="grid row-span-3 grid-rows-subgrid *:text-text gap-5">
              <p class="text-2xl text-center ">Create New Room</p>
              <button
                class="row-start-3 bg-bg-light rounded mx-auto p-2 hover:bg-bg-dark duration-150"
                onClick={() => createNewRoom()}
              >
                CREATE
              </button>
            </div>
            <div class="grid grid-rows-subgrid row-span-3 *:text-text gap-5">
              <p class="text-2xl text-center">Join Room</p>
              <input
                type="text"
                class="bg-bg-light rounded w-full outline-none text-lg px-2 py-1"
              />
              <button class="bg-bg-light rounded mx-auto p-2 hover:bg-bg-dark duration-150">
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

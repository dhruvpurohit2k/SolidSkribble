import {
  Accessor,
  createContext,
  Setter,
  useContext,
  type ParentProps,
} from "solid-js";
import { createSignal } from "solid-js";
import { v4 as uuidv4 } from "uuid";
const userContext = createContext<userContextType>();

export function UserContext(props: ParentProps) {
  const [username, setUserName] = createSignal<string>(
    localStorage.getItem("username") || "",
  );
  const [id, setId] = createSignal<number>(0);
  let prevtoken = localStorage.getItem("uuid");
  if (prevtoken === null) {
    prevtoken = uuidv4();
    localStorage.setItem("uuid", prevtoken);
  }
  const [token, setToken] = createSignal<string>(prevtoken);
  function updateUserName(name: string) {
    setUserName(name);
    localStorage.setItem("username", name);
  }
  return (
    <userContext.Provider
      value={{
        username: { value: username, set: updateUserName },
        id: { value: id, set: setId },
        token: { value: token },
      }}
    >
      {props.children}
    </userContext.Provider>
  );
}
type userContextType = {
  username: {
    value: Accessor<string>;
    set: (username: string) => void;
  };
  id: {
    value: Accessor<number>;
    set: Setter<number>;
  };
  token: {
    value: Accessor<string>;
  };
};
export const useUserContext = () => useContext(userContext);

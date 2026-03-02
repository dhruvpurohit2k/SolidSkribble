import {
  Accessor,
  createContext,
  Setter,
  useContext,
  type ParentProps,
} from "solid-js";
import { createSignal } from "solid-js";
const userContext = createContext<userContextType>();

export function UserContext(props: ParentProps) {
  const [username, setUserName] = createSignal<string>(
    localStorage.getItem("username") || "",
  );
  const [id, setId] = createSignal<number>(0);
  function updateUserName(name: string) {
    setUserName(name);
    localStorage.setItem("username", name);
  }
  return (
    <userContext.Provider
      value={{
        username: { value: username, set: updateUserName },
        id: { value: id, set: setId },
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
};
export const useUserContext = () => useContext(userContext);

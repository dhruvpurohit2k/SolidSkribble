import type { Component, ParentProps } from "solid-js";
import Header from "./components/Header";

const App: Component = (props: ParentProps) => {
  // document.documentElement.classList.add("light");
  return (
    <>
      <Header />
      <main class="mx-auto flex flex-col h-[calc(100%-40px)]">
        {props.children}
      </main>
    </>
  );
};

export default App;

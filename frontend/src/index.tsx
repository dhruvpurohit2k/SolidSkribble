/* @refresh reload */
import "./index.css";
import { render } from "solid-js/web";
import "solid-devtools";
import { Router, Route } from "@solidjs/router";
import { UserContext } from "./context/UserContext";
import App from "./App";
import Login from "./pages/Login";
import Game from "./pages/Game";
const root = document.getElementById("root");

render(
  () => (
    <UserContext>
      <Router root={App}>
        <Route path="/" component={Login} />
        <Route path="/game/:id" component={Game} />
        {/* <Route path="/login" component={Login} /> */}
      </Router>
    </UserContext>
  ),
  root!,
);

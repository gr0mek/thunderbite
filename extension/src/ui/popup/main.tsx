import { render } from "preact";
import { PopupApp } from "./PopupApp";

const root = document.getElementById("root");
if (root) render(<PopupApp />, root);

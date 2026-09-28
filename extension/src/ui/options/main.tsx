import { render } from "preact";
import { OptionsApp } from "./OptionsApp";

const root = document.getElementById("root");
if (root) render(<OptionsApp />, root);

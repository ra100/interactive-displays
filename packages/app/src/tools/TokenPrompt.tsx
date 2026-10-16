import { type FormEvent, useState } from "react";
import { saveToken } from "./token.ts";

// Asks for the editor token once; it is kept in this browser.
export const TokenPrompt = ({ onSaved, wrong }: { onSaved: () => void; wrong: boolean }) => {
  const [token, setToken] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token.trim()) return;
    saveToken(token.trim());
    onSaved();
  };

  return (
    <main className="tool tool--centered">
      <form className="token-prompt" onSubmit={submit}>
        <h1 className="token-prompt__title">Editor token</h1>
        <p className="token-prompt__help">
          This server is protected. Enter the <code>EDITOR_TOKEN</code> it was started with.
        </p>
        {wrong ? <p className="tool-error">That token was not accepted.</p> : null}
        <input
          className="tool-input"
          type="password"
          autoComplete="current-password"
          aria-label="Editor token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <button className="tool-button tool-button--primary" type="submit">
          Continue
        </button>
      </form>
    </main>
  );
};

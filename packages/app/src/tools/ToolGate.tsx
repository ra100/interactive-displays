import { PROTOCOL_VERSION, type ShowOverview } from "@interactive-displays/core";
import { type ReactNode, useEffect, useState } from "react";
import { StatusMessage } from "../display/StatusMessage.tsx";
import { readToken, takeTokenFromUrl } from "./token.ts";
import { TokenPrompt } from "./TokenPrompt.tsx";
import { type ToolConnection, useToolConnection } from "./useToolConnection.ts";
import { type Session, useSession } from "./useSession.ts";
import "./tools.css";

export interface Tools {
  overview: ShowOverview;
  connection: ToolConnection;
  session: Session;
}

// Everything the operator console and the editor need before they can show anything: the editor token if the
// server wants one, and the first show overview.
export const ToolGate = ({ role, children }: { role: "operator" | "builder"; children: (tools: Tools) => ReactNode }) => {
  const [attempt, setAttempt] = useState(() => {
    takeTokenFromUrl();
    return 0;
  });
  const session = useSession(attempt);
  const connection = useToolConnection(role, attempt);
  const retry = () => setAttempt((current) => current + 1);

  useEffect(() => {
    document.title = role === "operator" ? "Operator · Interactive Displays" : "Editor · Interactive Displays";
  }, [role]);

  if (!session) return <StatusMessage title="LOADING" />;
  const unauthorized = (session.tokenRequired && !session.tokenValid) || connection.error?.code === "UNAUTHORIZED";
  if (unauthorized) return <TokenPrompt onSaved={retry} wrong={readToken() !== undefined} />;
  if (connection.error && !connection.overview) return <StatusMessage title="SERVER ERROR" detail={connection.error.message} />;
  const { overview } = connection;
  if (!overview) return <StatusMessage title="CONNECTING" />;
  if (overview.protocol !== PROTOCOL_VERSION) {
    return <StatusMessage title="UPDATE AVAILABLE" detail="The server was upgraded. Reload this page." />;
  }
  return <>{children({ overview, connection, session })}</>;
};

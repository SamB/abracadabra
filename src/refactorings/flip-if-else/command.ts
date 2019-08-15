import * as vscode from "vscode";

import { newXXXCreateCommand } from "../../commands";
import { flipIfElse } from "./flip-if-else";

// Must match `command` field in `package.json`
export const commandKey = "abracadabra.flipIfElse";

export default vscode.commands.registerCommand(
  commandKey,
  newXXXCreateCommand(flipIfElse)
);
import * as vscode from "vscode";

import addBracesToArrowFunction from "./refactorings/add-braces-to-arrow-function/command";
import convertIfElseToTernaryCommand from "./refactorings/convert-if-else-to-ternary/command";
import convertTernaryToIfElseCommand from "./refactorings/convert-ternary-to-if-else/command";
import extractVariableCommand from "./refactorings/extract-variable/command";
import flipIfElseCommand from "./refactorings/flip-if-else/command";
import flipTernaryCommand from "./refactorings/flip-ternary/command";
import inlineVariableCommand from "./refactorings/inline-variable/command";
import mergeIfStatementsCommand from "./refactorings/merge-if-statements/command";
import moveStatementDownCommand from "./refactorings/move-statement-down/command";
import moveStatementUpCommand from "./refactorings/move-statement-up/command";
import negateExpressionCommand from "./refactorings/negate-expression/command";
import removeBracesFromArrowFunctionCommand from "./refactorings/remove-braces-from-arrow-function/command";
import removeRedundantElseCommand from "./refactorings/remove-redundant-else/command";
import renameSymbolCommand from "./refactorings/rename-symbol/command";
import splitIfStatementCommand from "./refactorings/split-if-statement/command";

import addBracesToArrowFunctionActionProviderFor from "./refactorings/add-braces-to-arrow-function/action-provider";
import convertIfElseToTernaryActionProviderFor from "./refactorings/convert-if-else-to-ternary/action-provider";
import convertTernaryToIfElseActionProviderFor from "./refactorings/convert-ternary-to-if-else/action-provider";
import flipIfElseActionProviderFor from "./refactorings/flip-if-else/action-provider";
import flipTernaryActionProviderFor from "./refactorings/flip-ternary/action-provider";
import mergeIfStatementsActionProviderFor from "./refactorings/merge-if-statements/action-provider";
import negateExpressionActionProviderFor from "./refactorings/negate-expression/action-provider";
import removeBracesFromArrowFunctionActionProviderFor from "./refactorings/remove-braces-from-arrow-function/action-provider";
import removeRedundantElseActionProviderFor from "./refactorings/remove-redundant-else/action-provider";
import splitIfStatementActionProviderFor from "./refactorings/split-if-statement/action-provider";

const SUPPORTED_LANGUAGES = [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact"
];

export function activate(context: vscode.ExtensionContext) {
  [
    addBracesToArrowFunction,
    convertIfElseToTernaryCommand,
    convertTernaryToIfElseCommand,
    extractVariableCommand,
    flipIfElseCommand,
    flipTernaryCommand,
    inlineVariableCommand,
    mergeIfStatementsCommand,
    moveStatementDownCommand,
    moveStatementUpCommand,
    negateExpressionCommand,
    removeBracesFromArrowFunctionCommand,
    removeRedundantElseCommand,
    renameSymbolCommand,
    splitIfStatementCommand
  ].forEach(command => context.subscriptions.push(command));

  SUPPORTED_LANGUAGES.forEach(language => {
    [
      addBracesToArrowFunctionActionProviderFor(language),
      convertIfElseToTernaryActionProviderFor(language),
      convertTernaryToIfElseActionProviderFor(language),
      flipIfElseActionProviderFor(language),
      flipTernaryActionProviderFor(language),
      mergeIfStatementsActionProviderFor(language),
      negateExpressionActionProviderFor(language),
      removeBracesFromArrowFunctionActionProviderFor(language),
      removeRedundantElseActionProviderFor(language),
      splitIfStatementActionProviderFor(language)
    ].forEach(actionProvider => context.subscriptions.push(actionProvider));
  });
}

export function deactivate() {}

import { UpdateWith, Update, Code } from "./i-update-code";
import { negateExpression } from "./negate-expression";
import { Selection } from "./selection";
import { ShowErrorMessage, ErrorReason } from "./i-show-error-message";

describe("Negate Expression", () => {
  let showErrorMessage: ShowErrorMessage;
  let updateWith: UpdateWith;
  let updates: Update[] = [];
  let updatedExpression = "";

  beforeEach(() => {
    showErrorMessage = jest.fn();
    updates = [];
    updatedExpression = "";
    updateWith = jest
      .fn()
      .mockImplementation(
        (_, getUpdates) => (updates = getUpdates(updatedExpression))
      );
  });

  it.each<[string, Selection]>([
    ["all expression is selected", new Selection([0, 4], [0, 10])],
    ["cursor is on left identifier", Selection.cursorAt(0, 4)],
    ["cursor is on operator", Selection.cursorAt(0, 7)],
    ["cursor is on right identifier", Selection.cursorAt(0, 9)]
  ])("should select expression if %s", async (_, selection) => {
    const code = `if (a == b) {}`;

    await doNegateExpression(code, selection);

    expect(updateWith).toBeCalledWith(
      new Selection([0, 4], [0, 10]),
      expect.any(Function)
    );
  });

  it.each<[string, Assertion]>([
    ["loose equality", { expression: "a == b", expected: "!(a != b)" }],
    ["strict equality", { expression: "a === b", expected: "!(a !== b)" }],
    ["loose inequality", { expression: "a != b", expected: "!(a == b)" }],
    ["strict inequality", { expression: "a !== b", expected: "!(a === b)" }],
    ["lower than", { expression: "a < b", expected: "!(a >= b)" }],
    ["lower or equal", { expression: "a <= b", expected: "!(a > b)" }],
    ["greater than", { expression: "a > b", expected: "!(a <= b)" }],
    ["greater or equal", { expression: "a >= b", expected: "!(a < b)" }],
    [
      "logical and",
      {
        expression: "a == b && b == c",
        selection: Selection.cursorAt(0, 12),
        expected: "!(a != b || b != c)"
      }
    ],
    [
      "logical or",
      {
        expression: "a == b || b == c",
        selection: Selection.cursorAt(0, 12),
        expected: "!(a != b && b != c)"
      }
    ],
    [
      "an already negated expression",
      {
        expression: "!(a != b && b != c)",
        selection: Selection.cursorAt(0, 14),
        expected: "a == b || b == c"
      }
    ],
    [
      "identifiers (boolean values)",
      {
        expression: "isValid || isCorrect",
        selection: Selection.cursorAt(0, 13),
        expected: "!(!isValid && !isCorrect)"
      }
    ],
    [
      "negated identifiers (boolean values)",
      {
        expression: "!isValid || isCorrect",
        selection: Selection.cursorAt(0, 14),
        expected: "!(isValid && !isCorrect)"
      }
    ]
  ])("should negate %s", async (_, { expression, selection, expected }) => {
    updatedExpression = expression;
    const code = `if (${expression}) {}`;
    const DEFAULT_SELECTION = Selection.cursorAt(0, 4);

    await doNegateExpression(code, selection || DEFAULT_SELECTION);

    expect(updates).toEqual([
      {
        code: expected,
        selection: new Selection([0, 4], [0, 4 + expression.length])
      }
    ]);
  });

  it("should negate the left-side of a logical expression", async () => {
    const code = `if (a == b || b == c) {}`;
    const selection = Selection.cursorAt(0, 6);

    await doNegateExpression(code, selection);

    expect(updateWith).toBeCalledWith(
      new Selection([0, 4], [0, 10]),
      expect.any(Function)
    );
  });

  it("should negate the right-side of a logical expression", async () => {
    const code = `if (a == b || b == c) {}`;
    const selection = Selection.cursorAt(0, 15);

    await doNegateExpression(code, selection);

    expect(updateWith).toBeCalledWith(
      new Selection([0, 14], [0, 20]),
      expect.any(Function)
    );
  });

  it("should negate the whole logical expression if cursor is on identifier", async () => {
    const code = `if (isValid || b == c) {}`;
    const selection = Selection.cursorAt(0, 6);

    await doNegateExpression(code, selection);

    expect(updateWith).toBeCalledWith(
      new Selection([0, 4], [0, 21]),
      expect.any(Function)
    );
  });

  it("should show an error message if selection can't be negated", async () => {
    const code = `console.log("Nothing to negate here!")`;
    const selection = Selection.cursorAt(0, 0);

    await doNegateExpression(code, selection);

    expect(showErrorMessage).toBeCalledWith(
      ErrorReason.DidNotFoundNegatableExpression
    );
  });

  async function doNegateExpression(code: Code, selection: Selection) {
    await negateExpression(code, selection, updateWith, showErrorMessage);
  }
});

interface Assertion {
  expression: Code;
  selection?: Selection;
  expected: Code;
}
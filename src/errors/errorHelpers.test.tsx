/*
 * Copyright (C) 2023 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {
  formatSchemaValidationMessage,
  getErrorMessage,
  getErrorMessageWithCauses,
  hasSpecificErrorCause,
  isCustomAggregateError,
  isErrorObject,
  selectError,
  selectErrorFromErrorEvent,
  selectErrorFromRejectionEvent,
  selectSpecificError,
  shouldErrorBeIgnored,
} from "@/errors/errorHelpers";
import { range } from "lodash";
import { deserializeError, serializeError } from "serialize-error";
import {
  InputValidationError,
  OutputValidationError,
  type SchemaValidationError,
} from "@/bricks/errors";
import { configureStore, isPlainObject } from "@reduxjs/toolkit";
import axios, { type AxiosError } from "axios";
import {
  BusinessError,
  CancelError,
  InvalidDefinitionError,
  MultipleElementsFoundError,
  NoElementsFoundError,
} from "@/errors/businessErrors";
import { ContextError } from "@/errors/genericErrors";
import {
  ClientRequestError,
  RemoteServiceError,
} from "@/errors/clientRequestErrors";
import { uuidv4 } from "@/types/helpers";
import { renderHook } from "@testing-library/react-hooks";
import { appApi, useGetPackageQuery } from "@/services/api";
import { Provider } from "react-redux";
import { waitForEffect } from "@/testUtils/testHelpers";
import { isAxiosError } from "@/errors/networkErrorHelpers";
import React from "react";
import { appApiMock } from "@/testUtils/appApiMock";

function testStore() {
  return configureStore({
    reducer: {
      [appApi.reducerPath]: appApi.reducer,
    },
    middleware(getDefaultMiddleware) {
      return getDefaultMiddleware().concat(appApi.middleware);
    },
    preloadedState: {},
  });
}

const TEST_MESSAGE = "Test message";

function createUncaughtRejection(reason: string | Error) {
  const promise = Promise.reject(reason);
  // eslint-disable-next-line promise/prefer-await-to-then -- Test only
  promise.catch(() => {}); // Or else it will crash Node
  return { promise, reason };
}

function nest(error: Error, level = 1): Error {
  if (level === 0) {
    return error;
  }

  return nest(
    new ContextError("Something happened", { cause: error }),
    level - 1,
  );
}

describe("hasSpecificErrorCause CancelError", () => {
  // Just a helper around a new API to preserve the old CancelError-specific tests
  const hasCancelRootCause = (error: unknown) =>
    hasSpecificErrorCause(error, CancelError);

  test("can detect cancel root cause", () => {
    const error = new CancelError(TEST_MESSAGE);
    for (const level of range(3)) {
      expect(hasCancelRootCause(nest(error, level))).toBe(true);
    }
  });

  test("do not detect other causes", () => {
    const error = new Error(TEST_MESSAGE);
    for (const level of range(3)) {
      expect(hasCancelRootCause(nest(error, level))).toBe(false);
    }
  });

  test("handles message", () => {
    expect(hasCancelRootCause(TEST_MESSAGE)).toBe(false);
  });

  test("can detect cancel root cause in serialized error", () => {
    const error = new CancelError(TEST_MESSAGE);
    for (const level of range(3)) {
      expect(hasCancelRootCause(serializeError(nest(error, level)))).toBe(true);
    }
  });

  test("handles other serialized errors", () => {
    const error = new Error(TEST_MESSAGE);
    for (const level of range(3)) {
      expect(hasCancelRootCause(serializeError(nest(error, level)))).toBe(
        false,
      );
    }
  });
});

describe("hasSpecificErrorCause BusinessError", () => {
  // Just a helper around a new API to preserve the old BusinessError-specific tests
  const hasBusinessRootCause = (error: unknown) =>
    hasSpecificErrorCause(error, BusinessError);

  const errorTable = [
    new BusinessError(TEST_MESSAGE),
    new NoElementsFoundError("#test"),
    new MultipleElementsFoundError("#test"),
    new InputValidationError(TEST_MESSAGE, { type: "string" }, 42, []),
    new OutputValidationError(TEST_MESSAGE, { type: "string" }, 42, []),
  ].map((error) => ({ error, name: error.name }));

  test("can detect business root cause", () => {
    const error = new BusinessError(TEST_MESSAGE);
    for (const level of range(3)) {
      expect(hasBusinessRootCause(nest(error, level))).toBe(true);
    }
  });

  test("do not detect other causes", () => {
    const error = new Error(TEST_MESSAGE);
    expect(hasBusinessRootCause(error)).toBe(false);
    for (const level of range(3)) {
      expect(hasBusinessRootCause(nest(error, level))).toBe(false);
    }
  });

  test("handles message", () => {
    expect(hasBusinessRootCause(TEST_MESSAGE)).toBe(false);
  });

  test.each(errorTable)("can detect subclass $name", ({ error }) => {
    for (const level of range(3)) {
      expect(hasBusinessRootCause(nest(error, level))).toBe(true);
    }
  });

  test.each(errorTable)("can detect serialized error $name", ({ error }) => {
    for (const level of range(3)) {
      expect(hasBusinessRootCause(serializeError(nest(error, level)))).toBe(
        true,
      );
    }
  });

  test.each(errorTable)("can detect deserialized error $name", ({ error }) => {
    for (const level of range(3)) {
      const deserialized = deserializeError(serializeError(nest(error, level)));
      expect(hasBusinessRootCause(deserialized)).toBe(true);
    }
  });

  test("handles serialized errors", () => {
    const error = new Error(TEST_MESSAGE);
    for (const level of range(3)) {
      expect(hasBusinessRootCause(serializeError(nest(error, level)))).toBe(
        false,
      );
    }
  });
});

describe("getErrorMessage", () => {
  beforeEach(() => {
    appApiMock.resetHandlers();
  });

  test("handles string", () => {
    expect(getErrorMessage(TEST_MESSAGE)).toBe(TEST_MESSAGE);
  });

  test("handles vanilla error", () => {
    expect(getErrorMessage(new Error(TEST_MESSAGE))).toBe(TEST_MESSAGE);
  });

  test("handles null/undefined", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
    expect(getErrorMessage(undefined)).toBe("Unknown error");
  });

  test("handles axios error", async () => {
    appApiMock
      .onGet()
      .reply(404, { detail: "These aren't the droids you're looking for" });

    try {
      await axios.create().get("/");
      expect.fail("Expected error");
    } catch (error) {
      expect(getErrorMessage(error)).toBe(
        "These aren't the droids you're looking for",
      );
    }
  });

  test("handles serialized axios error", async () => {
    appApiMock
      .onGet()
      .reply(404, { detail: "These aren't the droids you're looking for" });

    try {
      await axios.create().get("/");
      expect.fail("Expected error");
    } catch (error) {
      // `axios-mock-adapter` produces an error with name="Error" and prototype=AxiosError. When serialized, the
      // isAxiosError is also dropped because it's on the prototype, and not the instance. As a result, error
      // fails the isAxiosError(...) check getErrorMessage uses getErrorMessage
      expect(getErrorMessage(serializeError(error))).toBe(
        "Request failed with status code 404",
      );
    }
  });

  test("handles error message from RTK", async () => {
    appApiMock
      .onGet()
      .reply(404, { detail: "These aren't the droids you're looking for" });

    const store = testStore();

    const id = uuidv4();

    const { result } = renderHook(() => useGetPackageQuery({ id }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitForEffect();

    const { error, data } = result.current;
    expect(data).toBeUndefined();
    expect(isAxiosError(error)).toBe(true);

    // Unlike the non-RTK test case, the error here is detected as an AxiosError in the test suite because the base
    // query overrides the name to be AxiosError so it's detected by isAxiosError(...)
    expect(getErrorMessage(serializeError(error))).toBe(
      "These aren't the droids you're looking for",
    );
  });

  test("if error object, return error message", () => {
    const errorObject = { name: "Error", message: "error message" };
    const message = getErrorMessage(errorObject, "default message");
    expect(message).toEqual(errorObject.message);
  });

  test("if InputValidationError, prefer error message property if it exists", () => {
    const inputValidationError = {
      name: "InputValidationError",
      message: "error message",
      schema: {},
      errors: [{ error: "error", keywordLocation: "#/foo" }],
    } as InputValidationError;
    const message = getErrorMessage(inputValidationError, "default message");
    expect(message).toEqual(inputValidationError.message);
  });

  test("if InputValidationError with no message property, return first error", () => {
    const firstError = { error: "error", keywordLocation: "#/foo" };
    const secondError = { error: "second error", keywordLocation: "#/bar" };
    const inputValidationError = {
      schema: {},
      errors: [firstError, secondError],
    } as InputValidationError;
    const message = getErrorMessage(inputValidationError, "default message");
    expect(message).toBe(`${firstError.keywordLocation}: ${firstError.error}`);
  });
});

const validationError = {
  keywordLocation: "#/foo",
  error: "Property bar does not match schema",
} as SchemaValidationError["errors"][number];

describe("formatSchemaValidationMessage", () => {
  test("it returns a message in the form of 'keywordLocation: error'", () => {
    const message = formatSchemaValidationMessage(validationError);
    expect(message).toBe(
      `${validationError.keywordLocation}: ${validationError.error}`,
    );
  });

  test("it returns just the error if no keyword location", () => {
    const message = formatSchemaValidationMessage({
      ...validationError,
      keywordLocation: undefined,
    });
    expect(message).toEqual(validationError.error);
  });

  test("it returns empty string if no error or keyword location", () => {
    const message = formatSchemaValidationMessage(
      {} as SchemaValidationError["errors"][number],
    );
    expect(message).toBe("");
  });
});

describe("getErrorMessageWithCauses", () => {
  const firstError = "There was an error while fetching the page";
  const secondError = "Maybe you are not connected to the internet?";
  const thirdError = "The network request failed (NO_NETWORK)";
  test("handles string", () => {
    expect(getErrorMessageWithCauses(firstError)).toBe(firstError);
  });

  test("handles vanilla error", () => {
    expect(getErrorMessageWithCauses(new Error(firstError))).toBe(firstError);
  });

  test("handles null/undefined", () => {
    expect(getErrorMessageWithCauses(null)).toBe("Unknown error");
    expect(getErrorMessageWithCauses(undefined)).toBe("Unknown error");
  });

  test("handles good causes", () => {
    expect(
      getErrorMessageWithCauses(
        new Error(firstError, { cause: new Error(secondError) }),
      ),
    ).toMatchInlineSnapshot(`
      "There was an error while fetching the page.
      Maybe you are not connected to the internet?"
    `);
    expect(
      getErrorMessageWithCauses(
        new Error(firstError, {
          cause: new Error(secondError, { cause: new Error(thirdError) }),
        }),
      ),
    ).toMatchInlineSnapshot(`
      "There was an error while fetching the page.
      Maybe you are not connected to the internet?
      The network request failed (NO_NETWORK)."
    `);
  });

  test("handles questionable causes", () => {
    expect(
      getErrorMessageWithCauses(new Error(firstError, { cause: null })),
    ).toBe(firstError);
    expect(
      getErrorMessageWithCauses(new Error(firstError, { cause: undefined })),
    ).toBe(firstError);
    expect(getErrorMessageWithCauses(new Error(firstError, { cause: "idk" })))
      .toMatchInlineSnapshot(`
        "There was an error while fetching the page.
        idk."
      `);
    expect(getErrorMessageWithCauses(new Error(firstError, { cause: 420 })))
      .toMatchInlineSnapshot(`
        "There was an error while fetching the page.
        420."
      `);
  });

  test("ignores duplicate error messages", () => {
    expect(
      getErrorMessageWithCauses(
        new Error(firstError, { cause: new Error(firstError) }),
      ),
    ).toBe(`${firstError}.`);
  });
});

describe("isErrorObject", () => {
  test("handles error", () => {
    expect(isErrorObject(new Error(TEST_MESSAGE))).toBe(true);
  });

  test("handles primitives", () => {
    expect(isErrorObject(null)).toBe(false);
    expect(isErrorObject(TEST_MESSAGE)).toBe(false);
  });
});

describe("selectError", () => {
  it("passes through error", () => {
    const error = new Error("test");
    expect(selectError(error)).toBe(error);
  });

  it("deserializes error object", () => {
    const error = new Error("test");
    expect(selectError(serializeError(error))).toBeInstanceOf(Error);
    expect(serializeError(selectError(serializeError(error)))).toStrictEqual(
      serializeError(error),
    );
  });

  it("wraps primitive", () => {
    expect(selectError(undefined)).toMatchInlineSnapshot("[Error: undefined]");
    expect(selectError(null)).toMatchInlineSnapshot("[Error: null]");
    expect(selectError(123)).toMatchInlineSnapshot("[Error: 123]");
    expect(selectError("test")).toMatchInlineSnapshot("[Error: test]");
    expect(selectError({ my: "object" })).toMatchInlineSnapshot(
      '[Error: {"my":"object"}]',
    );
  });
});

describe("selectErrorFromErrorEvent", () => {
  it("extracts error from ErrorEvent", () => {
    const error = new Error("This won’t be caught");
    const errorEvent = new ErrorEvent("error", {
      error,
    });

    expect(selectErrorFromErrorEvent(errorEvent)).toBe(error);
  });

  it("handles ErrorEvent with null message and error", () => {
    const errorEvent = new ErrorEvent("error", {
      error: null,
      message: null,
    });

    const selectedError = selectErrorFromErrorEvent(errorEvent);
    expect(selectedError).toMatchInlineSnapshot("[Error: Unknown error event]");
  });

  it("handles error event with message but no error object", () => {
    const eventMessage = "ResizeObserver loop limit exceeded";

    // Seen on Chrome 100.0.4896.127. The message is provided, but there's no error object
    const errorEvent = new ErrorEvent("error", {
      filename: "https://dashboard.brex.com/card/transactions/yours",
      lineno: 0,
      colno: 10,
      error: null,
      message: eventMessage,
    });

    const selectedError = selectErrorFromErrorEvent(errorEvent);

    expect(selectedError.message).toBe(eventMessage);

    // This particular error should be ignored by recordError because it's in the IGNORED_ERROR_PATTERNS

    // It should work with raw error messages
    expect(shouldErrorBeIgnored(getErrorMessage(selectedError))).toBeTrue();

    // It should work with error objects
    expect(shouldErrorBeIgnored(selectedError)).toBeTrue();

    // It should ignore specified-but-empty contexts
    expect(shouldErrorBeIgnored(selectedError, {})).toBeTrue();

    // It should not ignore non-empty contexts
    expect(
      shouldErrorBeIgnored(getErrorMessage(selectedError), {
        label: "Don’t ignore me",
      }),
    ).toBeFalse();
  });

  it("wraps primitive from ErrorEvent and creates stack", () => {
    const error = "It’s a non-error";
    const errorEvent = new ErrorEvent("error", {
      filename: "yoshi://mushroom-kingdom/bowser.js",
      lineno: 2,
      colno: 10,
      error,
    });

    const selectedError = selectErrorFromErrorEvent(errorEvent);
    expect(selectedError).toMatchInlineSnapshot("[Error: It’s a non-error]");
    expect(selectedError.stack).toMatchInlineSnapshot(`
      "Error: It’s a non-error
          at unknown (yoshi://mushroom-kingdom/bowser.js:2:10)"
    `);
  });
});

describe("selectErrorFromRejectionEvent", () => {
  it("extracts error from PromiseRejectionEvent", () => {
    const error = new Error("This won’t be caught");
    const errorEvent = new PromiseRejectionEvent(
      "error",
      createUncaughtRejection(error),
    );

    expect(selectErrorFromRejectionEvent(errorEvent)).toBe(error);
  });

  it("handles PromiseRejectionEvent with null reason", () => {
    const errorEvent = new PromiseRejectionEvent(
      "error",
      createUncaughtRejection(null),
    );

    const selectedError = selectErrorFromRejectionEvent(errorEvent);
    expect(selectedError).toMatchInlineSnapshot(
      "[Error: Unknown promise rejection]",
    );
  });

  it("wraps primitive from PromiseRejectionEvent", () => {
    const errorEvent = new PromiseRejectionEvent(
      "error",
      createUncaughtRejection("It's a non-error"),
    );

    expect(selectErrorFromRejectionEvent(errorEvent)).toMatchInlineSnapshot(
      "[Error: It's a non-error]",
    );
  });
});

describe("selectSpecificError", () => {
  test("selects the first matching instance", () => {
    const instances = new Error("first", {
      cause: new TypeError("second", {
        cause: new Error("third", {
          cause: new RemoteServiceError("fourth", {
            cause: {
              name: "AxiosError",
              message: "fifth",
              isAxiosError: true,
            } as AxiosError,
          }),
        }),
      }),
    });

    // Test both real errors and serialized errors, even though we do not
    // want serialized errors to be flowing around #3372
    const testedErrors = [instances, serializeError(instances)];
    for (const error of testedErrors) {
      expect(selectSpecificError(error, SyntaxError)).toBeNull();

      expect(selectSpecificError(error, TypeError)).toMatchObject({
        name: "TypeError",
        message: "second",
      });

      expect(selectSpecificError(error, Error)).toMatchObject({
        name: "Error",
        message: "first",
      });

      expect(selectSpecificError(error, RemoteServiceError)).toMatchObject({
        name: "RemoteServiceError",
        message: "fourth",
      });

      // All ClientRequestErrors can be caught with this thanks to dedicated detection code,
      // even if we do not currently have `instanceof`-based detection
      expect(selectSpecificError(error, ClientRequestError)).toMatchObject({
        name: "RemoteServiceError",
        message: "fourth",
      });

      // All BusinessErrors can be caught with this thanks to dedicated detection code,
      // even if we do not currently have `instanceof`-based detection
      expect(selectSpecificError(error, BusinessError)).toMatchObject({
        name: "RemoteServiceError",
        message: "fourth",
      });
    }
  });
});

describe("serialization", () => {
  test("serializes error cause", () => {
    const inputValidationError = new InputValidationError(
      "test input validation error",
      null,
      null,
      [],
    );
    const contextError = new ContextError("text context error", {
      cause: inputValidationError,
    });

    const serializedError = serializeError(contextError);

    // Use the isPlainObject from "@reduxjs/toolkit" because it's Redux that requires the object in the state to be
    // serializable. We want it to be serializable and especially serializable for redux.
    expect(isPlainObject(serializedError)).toBeTruthy();
    expect(isPlainObject(serializedError.cause)).toBeTruthy();
  });

  test("detect cancellation error in context error", () => {
    const contextError = new ContextError("text context error", {
      cause: new CancelError(),
    });

    const serializedError = serializeError(contextError);
    expect(isPlainObject(serializedError.cause)).toBeTruthy();

    expect(selectSpecificError(serializedError, CancelError)).not.toBeNull();
    expect(selectSpecificError(serializedError, BusinessError)).not.toBeNull();
    expect(hasSpecificErrorCause(serializedError, CancelError)).toBeTrue();

    const deserialized = deserializeError(serializedError);
    expect(hasSpecificErrorCause(deserialized, CancelError)).toBeTrue();
  });

  test("hasSpecificErrorCause on serialized error", () => {
    const error = {
      name: "ContextError",
      context: {
        extensionPointId: "@internal/c28568c9-9efa-4eed-bc5c-530faffa342e",
        label: "Cancel current action",
        extensionLabel: "ycombinator.com side panel",
        extensionId: "3f95b12b-d104-4f74-ab5e-bcb6384709d8",
        blockId: "@pixiebrix/cancel",
        blockVersion: "1.7.0",
      },
      message: "Action cancelled",
      stack:
        "ContextError: Action cancelled\n    at E (chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:841650)\n    at k (chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:842810)\n    at async S.runExtension (chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:809937)\n    at async chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:810518\n    at async Promise.all (index 0)\n    at async S.refreshPanels (chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:810479)",
      cause: {
        name: "CancelError",
        message: "Action cancelled",
        stack:
          "CancelError: Action cancelled\n    at Y.effect (chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:597161)\n    at Y.run (chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:861221)\n    at chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:839698\n    at chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:840404\n    at async x (chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:838831)\n    at async k (chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:842786)\n    at async S.runExtension (chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:809937)\n    at async chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:810518\n    at async Promise.all (index 0)\n    at async S.refreshPanels (chrome-extension://mpjjildhmpddojocokjkgmlkkkfjnepo/contentScript.js:2:810479)",
      },
    };

    expect(hasSpecificErrorCause(error, CancelError)).toBeTrue();
  });
});

describe("isCustomAggregateError", () => {
  it("returns false for normal error", () => {
    expect(isCustomAggregateError(new Error("normal error"))).toBeFalse();
  });

  it("returns true for aggregate error", () => {
    expect(
      isCustomAggregateError(new InvalidDefinitionError("aggregate error", [])),
    ).toBeTrue();
  });
});

import { jest } from "@jest/globals";

global["__TEST__"] = true;
global["__PRODUCT__"] = false;

jest.setTimeout(10000);

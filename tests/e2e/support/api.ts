import { expect, type APIRequestContext } from "@playwright/test";

// The e2e server is shared by every spec, so anything a test changes it puts back.
export const setState = async (request: APIRequestContext, state: string) => {
  const response = await request.post("/api/state", { data: { state } });
  expect(response.ok()).toBe(true);
};

export const identify = async (request: APIRequestContext, displayId: string) => {
  const response = await request.post(`/api/displays/${displayId}/identify`);
  expect(response.ok()).toBe(true);
};

export const assignDisplay = async (request: APIRequestContext, displayId: string, screen: string | null) => {
  const response = await request.put(`/api/displays/${displayId}`, { data: { screen } });
  expect(response.ok()).toBe(true);
};

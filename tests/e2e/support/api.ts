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

// A fresh screen for a test to change, so the seeded ones other specs rely on stay as they are.
export const createScreen = async (request: APIRequestContext, id: string, name: string, baseUrl = "") => {
  const response = await request.post(`${baseUrl}/api/screens`, {
    data: {
      schemaVersion: 2,
      id,
      name,
      root: {
        id: "root",
        type: "container",
        layout: { kind: "stack", direction: "column" },
        children: [
          { node: { id: "title", type: "widget", kind: "title", props: { text: name.toUpperCase() } } },
          { node: { id: "note", type: "widget", kind: "text", props: { text: "Nothing to report." } } },
        ],
      },
    },
  });
  expect(response.status()).toBe(201);
  const published = await request.post(`${baseUrl}/api/screens/${id}/publish`, { data: {} });
  expect(published.ok()).toBe(true);
};

export const deleteScreen = async (request: APIRequestContext, id: string) => {
  await request.delete(`/api/screens/${id}`);
};

import { test, expect } from "@playwright/test";
import fixtures from "./fixtures/project-validation.json" with { type: "json" };
import {
  validateProject,
  projectIntegrity,
  removeProjectCards,
} from "../src/utils/projectValidation";
for (const fixture of fixtures)
  test(`validation: ${fixture.name}`, () => {
    const result = validateProject(fixture.project);
    expect(!!result.project).toBe(fixture.valid);
    if (result.project) expect(result.project.schemaVersion).toBe(1);
  });
test("integrity: deletion detaches map and timeline cards, keeps mention text, and is reversible", () => {
  const project = validateProject(fixtures[0].project).project!;
  project.decks = [
    { id: "deck", name: "Deck", cardIds: ["card"], createdAt: 1, updatedAt: 1 },
  ];
  project.timelineTracks = [{ id: "track", name: "Track", order: 0 }];
  project.timelineNodes = [
    { id: "event", trackId: "track", x: 0, title: "Event", cardId: "card" },
  ];
  project.documents = [
    {
      id: "doc",
      title: "Doc",
      category: "story",
      content: '<span data-card-id="card">Harbor</span>',
      associatedCardIds: ["card"],
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  project.worldMaps = [
    {
      id: "map",
      name: "Map",
      imageUrl: "",
      pins: [{ id: "pin", title: "Harbor", cardId: "card", x: 10, y: 10 }],
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  const removed = removeProjectCards(project, ["card"]);
  expect(removed.worldMaps![0].pins).toHaveLength(1);
  expect(removed.worldMaps![0].pins[0].cardId).toBeUndefined();
  expect(removed.timelineNodes![0].cardId).toBeUndefined();
  expect(removed.decks![0].cardIds).toEqual([]);
  expect(removed.documents![0].content).toContain("Harbor");
  expect(projectIntegrity(removed).map((i) => i.path)).toContain(
    "documents[0].content:card",
  );
  expect(project.cards).toHaveLength(1);
  expect(projectIntegrity(project)).toEqual([]);
});
test("validation: rejects nonfinite numbers and malformed arrays", () => {
  const project = structuredClone(fixtures[0].project);
  project.cards[0].x = Infinity;
  expect(validateProject(project).project).toBeUndefined();
  expect(
    validateProject({ ...fixtures[0].project, cards: {} }).project,
  ).toBeUndefined();
});

import { test, expect } from "@playwright/test";

const quizExportPayload = {
  quiz_id: 33,
  title: "E2E Quiz",
  access_code: "E2E33",
  background: { color: "#1e1e2e", image: "", text_color: "#ffffff" },
  music_url: "",
  text_color: "#ffffff",
  slides: [
    {
      slide_id: 101,
      slide_type: 1,
      show_leaderboard_after: true,
      leaderboard: [],
      question: {
        question_id: 101,
        text: "What is 2 + 2?",
        title: "Q1",
        time_limit: 30,
        max_point: 100,
        min_point: 10,
        access_code: "E2E33",
        question_type: "single",
        image_url: "",
        faster_answers_more_points: true,
        partial_scoring: false,
        options: [
          { option_id: 1, text: "3", is_correct: false, votes: 0, image_url: "", order: 1 },
          { option_id: 2, text: "4", is_correct: true, votes: 0, image_url: "", order: 2 },
        ],
      },
    },
    {
      slide_id: 102,
      slide_type: 3,
      title: "Leaderboard",
      leaderboard: [],
    },
    {
      slide_id: 103,
      slide_type: 2,
      title: "Content",
      content_text: "Content slide",
      content_image_url: "",
      leaderboard: [],
    },
  ],
};

const questionMessage = {
  type: 2,
  question_id: 101,
  run_id: 9001,
  question_text: "What is 2 + 2?",
  question_time: 30,
  remaining_seconds: 22,
  started_at: Math.floor(Date.now() / 1000) - 8,
  options: [
    { option_id: 1, option_text: "3", answer: false, number_of_submits: 0 },
    { option_id: 2, option_text: "4", answer: true, number_of_submits: 0 },
  ],
};

async function mockQuizExport(page) {
  await page.route("**/quizzes/33/export/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(quizExportPayload),
    });
  });
}

async function installMockWebSocket(page, scenario) {
  await page.addInitScript((rawScenario) => {
    const scenario = rawScenario || {};

    const parseJson = (data) => {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    };

    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.onopen = null;
        this.onclose = null;
        this.onmessage = null;
        this.onerror = null;

        const roleMatch = /\/ws\/[^/]+\/([^/?#]+)/.exec(url);
        this.role = roleMatch ? roleMatch[1] : "unknown";

        const counterKey = `__mock_ws_count_${this.role}`;
        const nextCount = Number(localStorage.getItem(counterKey) || "0") + 1;
        localStorage.setItem(counterKey, String(nextCount));
        this.connectionIndex = nextCount;

        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.onopen && this.onopen({ type: "open" });
          this._scheduleMessages();
        }, 20);
      }

      _emitMessage(payload) {
        if (this.readyState !== MockWebSocket.OPEN) return;
        if (payload == null) return;

        if (typeof payload === "string") {
          this.onmessage && this.onmessage({ data: payload, type: "message" });
          return;
        }

        this.onmessage &&
          this.onmessage({ data: JSON.stringify(payload), type: "message" });
      }

      _scheduleMessages() {
        const byRole = scenario[this.role] || {};
        const queue = this.connectionIndex === 1 ? byRole.first || [] : byRole.next || [];

        for (const item of queue) {
          const delay = Number(item?.delay ?? 0);
          const payload = item?.data;
          setTimeout(() => this._emitMessage(payload), delay);
        }
      }

      send(raw) {
        if (this.readyState !== MockWebSocket.OPEN) return;
        const msg = typeof raw === "string" ? parseJson(raw) : raw;
        if (!msg || typeof msg !== "object") return;

        const byRole = scenario[this.role] || {};
        const nav = byRole.navigation || {};
        const navQueue = nav[msg.action] || [];
        for (const item of navQueue) {
          const delay = Number(item?.delay ?? 0);
          const payload = item?.data;
          setTimeout(() => this._emitMessage(payload), delay);
        }
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose && this.onclose({ code: 1000, reason: "closed", type: "close" });
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: MockWebSocket,
    });
  }, scenario);
}

test("manager refresh during question does not flash join lobby and stays synced", async ({ page }) => {
  await mockQuizExport(page);

  await page.addInitScript(() => {
    const markerKey = "__manager_join_flash__";
    const watch = () => {
      try {
        const text = document?.body?.innerText || "";
        if (text.includes("Waiting for players to join...")) {
          sessionStorage.setItem(markerKey, "1");
        }
      } catch {
        // ignore
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });

  await installMockWebSocket(page, {
    manager: {
      first: [{ delay: 120, data: questionMessage }],
      next: [
        { delay: 80, data: { type: 7, users: [{ user_id: "u1", name: "ali", character: "A" }] } },
        { delay: 1000, data: { ...questionMessage, remaining_seconds: 18 } },
      ],
    },
  });

  await page.goto("/manager/presentation/33");
  await expect(page.getByText("What is 2 + 2?")).toBeVisible();

  await page.reload();
  await expect(page.getByText("What is 2 + 2?")).toBeVisible();

  const joinFlash = await page.evaluate(() => sessionStorage.getItem("__manager_join_flash__"));
  expect(joinFlash).not.toBe("1");
});

test("manager leaderboard slide number stays aligned with leaderboard slide", async ({ page }) => {
  await mockQuizExport(page);
  await installMockWebSocket(page, {
    manager: {
      first: [
        { delay: 100, data: questionMessage },
        {
          delay: 700,
          data: {
            type: 1,
            results: [
              { user_id: "u1", name: "ali", character: "A", total_points: 50, new_points: 50, rank: 1 },
            ],
          },
        },
      ],
    },
  });

  await page.goto("/manager/presentation/33");
  await expect(page.getByText("Leaderboard")).toBeVisible();
  await expect(page.getByText(/\b2\s*\/\s*3\b/)).toBeVisible();
});

test("player refresh during question stays on question instead of join page", async ({ page }) => {
  await page.addInitScript(() => {
    const profile = {
      room_id: "33",
      name: "e2e-player",
      avatar: "A",
      user_id: "e2e-user-33",
    };
    localStorage.setItem("presentation_player_profile_v1", JSON.stringify(profile));
    localStorage.setItem("player_name", profile.name);
    localStorage.setItem("character", profile.avatar);
    localStorage.setItem("user_id", profile.user_id);
  });

  await installMockWebSocket(page, {
    player: {
      first: [{ delay: 80, data: questionMessage }],
      next: [{ delay: 120, data: { type: 7, users: [] } }],
    },
  });

  await page.goto("/player/presentation/33");
  await expect(page.getByText("What is 2 + 2?")).toBeVisible();

  await page.reload();
  await expect(page.getByText("What is 2 + 2?")).toBeVisible();
  await expect(page.locator('input[type="text"]')).toHaveCount(0);
});
